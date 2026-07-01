import React, { useState } from "react";
import { SystemState, Asset, AiAnalysis, AlertType, formatAssetPrice, getCurrencySign } from "../types";
import AssetChart from "./AssetChart";
import { apiClient, isDemoMode } from "../apiClient";
import { Cpu, ArrowLeft, RefreshCw, Check, AlertTriangle, Play, HelpCircle, Calendar, Plus, ShieldAlert, TrendingUp, TrendingDown, Bell, Copy } from "lucide-react";

interface AssetDetailProps {
  asset: Asset;
  state: SystemState;
  onBack: () => void;
  onExecuteTrade: (trade: { symbol: string; type: "BUY" | "SELL"; quantity: number; reason: string }) => Promise<void>;
  onRunAiAnalysis: (symbol: string, horizon: "1d" | "7d" | "30d" | "90d") => Promise<void>;
  onSubmitForecast: (analysisId: string, expectedChange: number) => Promise<void>;
  onAddAlert: (alert: { symbol: string; type: AlertType; threshold: number }) => Promise<void>;
  onDeleteAlert: (id: string) => Promise<void>;
}

export default function AssetDetail({
  asset,
  state,
  onBack,
  onExecuteTrade,
  onRunAiAnalysis,
  onSubmitForecast,
  onAddAlert,
  onDeleteAlert
}: AssetDetailProps) {
  const { portfolio, analyses, alerts } = state;

  // Tabs for the detail section
  const [activeSubTab, setActiveSubTab] = useState<"analysis" | "trade" | "alerts">("analysis");
  
  // AI Analysis configuration
  const [horizon, setHorizon] = useState<"1d" | "7d" | "30d" | "90d">("30d");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expectedChange, setExpectedChange] = useState<number>(8.5);
  const [isSubmittingForecast, setIsSubmittingForecast] = useState(false);
  const [forecastMessage, setForecastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Manual AI Context and Import states
  const [analysisContext, setAnalysisContext] = useState<{ generatedPrompt: string } | null>(null);
  const [pastedResult, setPastedResult] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);

  // Trade ticket configuration
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [tradeReason, setTradeReason] = useState("");
  const [tradeError, setTradeError] = useState("");
  const [tradeSuccess, setTradeSuccess] = useState(false);

  // Alert tickets configuration
  const [alertType, setAlertType] = useState<AlertType>("price_above");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [alertError, setAlertError] = useState("");
  const [alertSuccess, setAlertSuccess] = useState(false);

  // Filter analyses for this asset
  const assetAnalyses = analyses.filter((a) => a.symbol === asset.symbol);
  const latestAnalysis = assetAnalyses[0]; // sorted reverse-chronologically in database

  // Filter alerts for this asset
  const activeAssetAlerts = alerts.filter((a) => a.symbol === asset.symbol && a.active);

  // Calculate trade ticket numbers
  const qtyNum = parseFloat(quantity) || 0;
  const flatFee = asset.type === "crypto" ? parseFloat((qtyNum * asset.currentPrice * 0.001).toFixed(2)) : 4.90;
  const subTotal = qtyNum * asset.currentPrice;
  const totalCost = tradeType === "BUY" ? subTotal + flatFee : subTotal - flatFee;

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setImportError("");
    setImportSuccess(false);
    setAnalysisContext(null);
    try {
      const data = await apiClient.getAnalysisContext(asset.symbol, horizon);
      setAnalysisContext(data);
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Netzwerkfehler beim Abrufen des Analyse-Kontexts.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!analysisContext) return;
    navigator.clipboard.writeText(analysisContext.generatedPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleImportAnalysis = async () => {
    if (!pastedResult.trim()) {
      setImportError("Bitte füge das Analyse-Ergebnis (JSON) ein.");
      return;
    }
    setImportError("");
    setImportSuccess(false);

    try {
      const data = await apiClient.importAnalysis(asset.symbol, pastedResult, horizon);

      setImportSuccess(true);
      setPastedResult("");
      setAnalysisContext(null);
      // Trigger state reload in parent component so that list and latest analysis update
      await onRunAiAnalysis(asset.symbol, horizon);
      
      // Auto-set expected change based on imported properties if available
      const imported = data.analysis;
      if (imported && imported.expectedReturnPercent !== undefined) {
        setExpectedChange(Number(imported.expectedReturnPercent));
      } else {
        const isBuy = imported?.recommendation === "Kaufen";
        const isSell = imported?.recommendation === "Verkaufen";
        setExpectedChange(isBuy ? 10.5 : isSell ? -10.5 : 0);
      }
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Netzwerkfehler beim Importieren der Analyse.");
    }
  };

  const handleSubmitForecast = async () => {
    if (!latestAnalysis) return;
    setIsSubmittingForecast(true);
    setForecastMessage(null);
    try {
      await onSubmitForecast(latestAnalysis.id, expectedChange);
      setForecastMessage({
        type: "success",
        text: "Prognose erfolgreich an das Forecast-Tracking übergeben!"
      });
      setTimeout(() => setForecastMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setForecastMessage({
        type: "error",
        text: err.message || "Fehler beim Einreichen der Prognose."
      });
    } finally {
      setIsSubmittingForecast(false);
    }
  };

  const handleExecuteTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setTradeError("");
    setTradeSuccess(false);

    if (qtyNum <= 0) {
      setTradeError("Menge muss größer als 0 sein.");
      return;
    }

    if (tradeType === "BUY" && totalCost > portfolio.balance) {
      setTradeError("Ungenügende Liquidität für diesen Kauf.");
      return;
    }

    if (tradeType === "SELL") {
      const ownedPos = portfolio.positions.find((p) => p.symbol === asset.symbol);
      if (!ownedPos || ownedPos.quantity < qtyNum) {
        setTradeError("Nicht genügend Anteile im Besitz für diesen Verkauf.");
        return;
      }
    }

    try {
      await onExecuteTrade({
        symbol: asset.symbol,
        type: tradeType,
        quantity: qtyNum,
        reason: tradeReason || `${tradeType === "BUY" ? "Kauf" : "Verkauf"} von ${asset.symbol}`
      });
      setTradeSuccess(true);
      setQuantity("");
      setTradeReason("");
      setTimeout(() => setTradeSuccess(false), 3000);
    } catch (err: any) {
      setTradeError(err.message || "Fehler beim Ausführen der Transaktion.");
    }
  };

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertError("");
    setAlertSuccess(false);

    const valNum = parseFloat(alertThreshold);
    if (isNaN(valNum) || valNum <= 0) {
      setAlertError("Bitte gib einen gültigen Grenzpreis ein.");
      return;
    }

    try {
      await onAddAlert({
        symbol: asset.symbol,
        type: alertType,
        threshold: valNum
      });
      setAlertSuccess(true);
      setAlertThreshold("");
      setTimeout(() => setAlertSuccess(false), 3000);
    } catch (err: any) {
      setAlertError(err.message || "Fehler beim Hinzufügen des Alarms.");
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-emerald-500";
    if (score <= 35) return "bg-red-500";
    if (score > 35 && score < 50) return "bg-amber-500";
    return "bg-slate-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return "bg-emerald-50 text-emerald-800 border-emerald-100";
    if (score <= 35) return "bg-red-50 text-red-800 border-red-100";
    return "bg-indigo-50 text-indigo-800 border-indigo-100";
  };

  const renderPct = (val: number) => {
    const isPos = val >= 0;
    return (
      <span className={`font-mono font-bold ${isPos ? "text-emerald-600" : "text-red-600"}`}>
        {isPos ? "+" : ""}{val.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs cursor-pointer transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Übersicht
      </button>

      {/* Asset Core Headline Block */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 text-slate-800 w-12 h-12 rounded-xl flex items-center justify-center font-extrabold font-mono text-base border border-slate-200">
            {asset.symbol}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">{asset.name}</h1>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded-full text-slate-500 uppercase">
                {asset.type === "stock" ? "Aktie" : asset.type === "etf" ? "ETF" : "Kryptowährung"}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-2">
              NOC Risk-Rating: {asset.volatility.toUpperCase()} • Trend: {asset.status}
              {asset.dataQuality && asset.dataQuality.status !== 'ok' && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  <ShieldAlert className="w-3 h-3" />
                  {asset.dataQuality.status === 'market_closed' ? 'Market Closed' : asset.dataQuality.status}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="text-left md:text-right space-y-1">
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono flex items-center md:justify-end gap-2">
            {formatAssetPrice(asset.currentPrice, asset.currency)}
          </div>
          <div className="flex flex-wrap items-center md:justify-end gap-x-3 gap-y-1 text-xs">
            <span>Heute: {renderPct(asset.dailyChangePercent)}</span>
            <span className="text-slate-300">|</span>
            <span>7 Tage: {renderPct(asset.change7DaysPercent)}</span>
            <span className="text-slate-300">|</span>
            <span>30 Tage: {renderPct(asset.change30DaysPercent)}</span>
          </div>
        </div>
      </div>

      {/* Course Chart */}
      <AssetChart history={asset.history} symbol={asset.symbol} currency={asset.currency} />

      {/* Interactive NOC Panel (Sub Tabs) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Control Sheet (Left 2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            {/* Tab navigation */}
            <div className="flex border-b border-slate-100 bg-slate-50">
              <button
                onClick={() => setActiveSubTab("analysis")}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSubTab === "analysis"
                    ? "border-indigo-600 text-indigo-600 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                KI Consensus-Analyse
              </button>
              <button
                onClick={() => setActiveSubTab("trade")}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSubTab === "trade"
                    ? "border-indigo-600 text-indigo-600 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Simulierter Trade
              </button>
              <button
                onClick={() => setActiveSubTab("alerts")}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSubTab === "alerts"
                    ? "border-indigo-600 text-indigo-600 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                Grenzpreis-Alarme
              </button>
            </div>

            {/* TAB CONTENT: KI CONSENSUS ANALYSE */}
            {activeSubTab === "analysis" && (
              <div className="p-5 space-y-6">
                
                {/* Trigger control for Analysis */}
                <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Analyse-Konfiguration</span>
                      <p className="text-xs text-slate-500 font-medium">Erzeuge ein KI-Vollgutachten für Dein bevorzugtes Zeitintervall.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={horizon}
                        onChange={(e: any) => setHorizon(e.target.value)}
                        className="p-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                      >
                        <option value="1d">1 Tag (Kurzfristig)</option>
                        <option value="7d">7 Tage (Wochen-Trend)</option>
                        <option value="30d">30 Tage (Mittelwert)</option>
                        <option value="90d">90 Tage (Quartal)</option>
                      </select>

                      <button
                        onClick={handleRunAnalysis}
                        disabled={isAnalyzing}
                        className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {isAnalyzing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Kontext wird erzeugt...
                          </>
                        ) : (
                          <>
                            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                            KI-Kontext erzeugen
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed font-medium">
                    💡 <strong className="text-slate-700">Hinweis:</strong> MarketOps AI nutzt keine KI-API. Kopiere den Analyse-Kontext in deinen bevorzugten KI-Agenten (z.B. Gemini, Claude oder ChatGPT) und füge das strukturierte JSON-Ergebnis hier wieder ein.
                  </p>
                </div>

                {/* Manual Workspace when analysisContext is loaded */}
                {analysisContext && (
                  <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100/60 space-y-4 animate-fadeIn">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-indigo-500" />
                      Manueller KI-Analyse-Workflow ({horizon})
                    </h3>

                    {/* Step 1: Copy Prompt */}
                    <div className="space-y-2 bg-white p-4 rounded-lg border border-indigo-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">Schritt 1: Analyse-Prompt kopieren</span>
                        <button
                          onClick={handleCopyPrompt}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                        >
                          {copiedPrompt ? (
                            <>
                              <Check className="w-3 h-3" />
                              Kopiert!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Prompt kopieren
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Der generierte Prompt enthält alle relevanten Markt- und Fundamentaldaten sowie aktuelle Nachrichten.
                      </p>
                      <div className="relative">
                        <textarea
                          readOnly
                          value={analysisContext.generatedPrompt}
                          className="w-full h-24 p-2 text-[10px] font-mono bg-slate-50 text-slate-600 border border-slate-200 rounded-md focus:outline-none resize-none"
                        />
                      </div>
                    </div>

                    {/* Step 2: Paste Result */}
                    <div className="space-y-2 bg-white p-4 rounded-lg border border-indigo-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700 block">Schritt 2: Analyse-Ergebnis (JSON) einfügen</span>
                        {isDemoMode && (
                          <button
                            onClick={() => {
                              setPastedResult(JSON.stringify({
                                recommendation: "Kaufen",
                                score: 85,
                                summary: "Sample analysis result injected for demo mode.",
                                bullCase: "Sample bull case.",
                                bearCase: "Sample bear case.",
                                technicalAnalysis: "Looking solid.",
                                fundamentalAnalysis: "Growing revenue.",
                                newsSentiment: "Positive overall.",
                                riskRating: "medium",
                                expectedReturnPercent: 12.5,
                                expectedDirection: "Bullish",
                                targetPriceOptional: asset.currentPrice * 1.125
                              }, null, 2));
                            }}
                            className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                          >
                            Beispiel-JSON einfügen
                          </button>
                        )}
                      </div>
                      {isDemoMode && (
                        <p className="text-[11px] font-semibold text-amber-600">
                          This demo uses sample AI analysis data. It is not a live model response.
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Führe die Analyse mit deiner bevorzugten KI durch und füge das unformatiert ausgegebene JSON hier ein.
                      </p>
                      <textarea
                        value={pastedResult}
                        onChange={(e) => setPastedResult(e.target.value)}
                        placeholder='Z.B.: { "recommendation": "BUY", "score": 85, ... }'
                        className="w-full h-32 p-2.5 text-[11px] font-mono border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 text-slate-800 placeholder-slate-400"
                      />

                      {importError && (
                        <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-600 font-semibold flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>{importError}</span>
                        </div>
                      )}

                      {importSuccess && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 font-semibold flex items-start gap-1.5 animate-fadeIn">
                          <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>Analyse erfolgreich importiert! Die Auswertung wurde in der Historie gespeichert.</span>
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={handleImportAnalysis}
                          className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          Analyse importieren
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Display latest analysis */}
                {latestAnalysis ? (
                  <div className="space-y-6 animate-fadeIn">
                    
                    {/* Header: Score & Recommendation */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-4 rounded-xl border flex flex-col items-center justify-center ${getScoreBg(latestAnalysis.score)}`}>
                          <span className="text-3xl font-extrabold tracking-tight font-mono">{latestAnalysis.score}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">Score</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Empfehlung</span>
                          <h3 className="text-lg font-black text-slate-800 flex items-center gap-1">
                            {latestAnalysis.recommendation}
                            <span className="text-xs font-medium text-slate-400">({latestAnalysis.horizon})</span>
                          </h3>
                        </div>
                      </div>

                      {/* Submit Forecast directly based on score */}
                      <div className="space-y-1 w-full sm:w-auto bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/60 flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Prognose tracken</span>
                        <div className="flex items-center gap-2">
                          <div className="relative w-24">
                            <input
                              type="number"
                              step="any"
                              disabled={isSubmittingForecast}
                              value={expectedChange}
                              onChange={(e) => setExpectedChange(parseFloat(e.target.value) || 0)}
                              className="w-full p-1 border border-slate-200 rounded-md text-xs font-semibold text-center font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                            />
                            <span className="absolute right-1.5 top-1.5 text-[10px] font-bold text-slate-400">%</span>
                          </div>
                          <button
                            onClick={handleSubmitForecast}
                            disabled={isSubmittingForecast}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[70px]"
                          >
                            {isSubmittingForecast ? "Speichert..." : "Einreichen"}
                          </button>
                        </div>
                        {latestAnalysis.targetPriceOptional !== undefined && latestAnalysis.targetPriceOptional !== null && (
                          <div className="text-[10px] text-indigo-600 font-semibold mt-1">
                            Optionaler Zielkurs: {formatAssetPrice(Number(latestAnalysis.targetPriceOptional), asset.currency)}
                          </div>
                        )}
                        {forecastMessage && (
                          <div className={`text-[10px] font-bold mt-1 max-w-[200px] leading-tight ${
                            forecastMessage.type === "success" ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {forecastMessage.text}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kurzfazit</h4>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">"{latestAnalysis.summary}"</p>
                    </div>

                    {/* Bull / Bear Case Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-2">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          Bull Case (Chancen)
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium">
                          {latestAnalysis.bullCase}
                        </p>
                      </div>

                      <div className="p-4 bg-red-50/40 border border-red-100 rounded-xl space-y-2">
                        <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5" />
                          Bear Case (Risiken)
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium">
                          {latestAnalysis.bearCase}
                        </p>
                      </div>
                    </div>

                    {/* Technical / Fundamental / News Sentiments */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Technische Lage</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">{latestAnalysis.technicalAnalysis}</p>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fundamentalanalyse</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">{latestAnalysis.fundamentalAnalysis}</p>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nachrichtenstimmung</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">{latestAnalysis.newsSentiment}</p>
                      </div>
                    </div>

                    {/* Model breakdown consensus scoring bars */}
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consensus Model Breakdown</h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "Gemini Pro", score: latestAnalysis.modelsScores.gemini },
                          { label: "GPT-4o", score: latestAnalysis.modelsScores.gpt },
                          { label: "Claude 3.5 Sonnet", score: latestAnalysis.modelsScores.claude },
                          { label: "Tech. Indikatoren", score: latestAnalysis.modelsScores.technical }
                        ].map((model, idx) => (
                          <div key={idx} className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                              <span>{model.label}</span>
                              <span className="font-mono font-bold">{model.score}</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                style={{ width: `${model.score}%` }} 
                                className={`h-full ${getScoreColor(model.score)}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <Cpu className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-xs sm:text-sm font-semibold text-slate-500">Noch kein KI-Wertgutachten erzeugt.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Wähle Deinen Zeithorizont und starte die Konsens-AI-Analyse oben.</p>
                  </div>
                )}

              </div>
            )}

            {/* TAB CONTENT: SIMULATED TRADE */}
            {activeSubTab === "trade" && (
              <form onSubmit={handleExecuteTrade} className="p-5 space-y-4 animate-fadeIn">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wertpapier-Order aufgeben</h3>
                
                {tradeError && <p className="text-xs text-red-500 font-semibold">{tradeError}</p>}
                {tradeSuccess && <p className="text-xs text-emerald-600 font-semibold">Order erfolgreich ausgeführt und verbucht!</p>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Buy/Sell Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Ordertyp</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTradeType("BUY")}
                        className={`py-2 text-xs font-bold rounded-lg cursor-pointer ${
                          tradeType === "BUY"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        BUY (Kaufen)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTradeType("SELL")}
                        className={`py-2 text-xs font-bold rounded-lg cursor-pointer ${
                          tradeType === "SELL"
                            ? "bg-red-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        SELL (Verkaufen)
                      </button>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Stückzahl (Menge)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="z.B. 10"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Reason */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Handelsmotiv / Notiz (Journal-Grund)</label>
                    <input
                      type="text"
                      placeholder="z.B. Reaktion auf Blackwell Ultra Ankündigung / bullischen RSI-Ausbruch"
                      value={tradeReason}
                      onChange={(e) => setTradeReason(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                </div>

                {/* Currency warning */}
                {asset.currency !== "EUR" && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px] font-semibold">
                    Währungshinweis: Wechselkurs-Konvertierung nicht implementiert. Diese Transaktion wird 1:1 in V€ abgerechnet.
                  </div>
                )}

                {/* Calculation breakdown */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Kurs:</span>
                    <strong className="text-slate-800">{formatAssetPrice(asset.currentPrice, asset.currency)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Wert:</span>
                    <strong className="text-slate-800">{subTotal.toLocaleString("de-DE")} V€</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Gebühr (Flat/Variable):</span>
                    <strong className="text-slate-800">{flatFee.toLocaleString("de-DE")} V€</strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-800">
                    <span>Gesamtwert:</span>
                    <span>{totalCost.toLocaleString("de-DE")} V€</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-2">
                  <span className="text-slate-400">Verfügbares Guthaben: {portfolio.balance.toLocaleString("de-DE")} V€</span>
                  <button
                    type="submit"
                    className={`px-4 py-2 text-white font-bold rounded-lg cursor-pointer ${tradeType === "BUY" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}
                  >
                    Simulierte Order absenden
                  </button>
                </div>
              </form>
            )}

            {/* TAB CONTENT: GRENZPREIS ALARME */}
            {activeSubTab === "alerts" && (
              <div className="p-5 space-y-4 animate-fadeIn">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Asset Triggers konfigurieren</h3>
                
                {alertError && <p className="text-xs text-red-500 font-semibold">{alertError}</p>}
                {alertSuccess && <p className="text-xs text-emerald-600 font-semibold">Alarm erfolgreich scharfgestellt!</p>}

                <form onSubmit={handleAddAlert} className="flex flex-wrap items-end gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bedingung</label>
                    <select
                      value={alertType}
                      onChange={(e) => setAlertType(e.target.value as AlertType)}
                      className="w-full p-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:outline-none"
                    >
                      <option value="price_above">Steigt über (≥)</option>
                      <option value="price_below">Fällt unter (≤)</option>
                    </select>
                  </div>

                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Grenzpreis ({getCurrencySign(asset.currency)})</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="z.B. 140"
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(e.target.value)}
                      className="w-full p-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:outline-none font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Hinzufügen
                  </button>
                </form>

                {/* Active Alerts List */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Aktive Alarme für {asset.symbol}</h4>
                  {activeAssetAlerts.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeAssetAlerts.map((al) => (
                        <div key={al.id} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                          <span>
                            Trigger bei Kurs {al.type === "price_above" ? "≥" : "≤"}{" "}
                            <strong className="font-mono">{formatAssetPrice(al.threshold, asset.currency)}</strong>
                          </span>
                          <button
                            onClick={() => onDeleteAlert(al.id)}
                            className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer"
                          >
                            Entfernen
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Keine scharfen Alarme für dieses Wertpapier konfiguriert.</p>
                  )}
                </div>

              </div>
            )}

          </div>
          
          <div className="bg-slate-50 p-4 border-t border-slate-100 text-[10px] text-slate-400">
            NOC Sicherheitsrichtlinie: Sämtliche Orders laufen auf virtueller Basis. Es fließen keine echten Gelder.
          </div>
        </div>

        {/* Financial Numbers Sidebar Column (Right 1 Column) */}
        <div className="space-y-4">
          
          {/* Ownership state details card */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              Depotbesitz-Status
            </h3>

            {(() => {
              const owned = portfolio.positions.find((p) => p.symbol === asset.symbol);
              if (owned) {
                return (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Menge im Besitz:</span>
                      <strong className="font-mono">{owned.quantity} Stück</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Ø Einstiegskurs:</span>
                      <strong className="font-mono">{formatAssetPrice(owned.avgBuyPrice, asset.currency)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Investierter Betrag:</span>
                      <strong className="font-mono">{owned.totalCost.toLocaleString("de-DE")} V€</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Aktueller Depotwert:</span>
                      <strong className="font-mono">{owned.currentValue.toLocaleString("de-DE")} V€</strong>
                    </div>
                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-slate-400">Gesamt-G&V:</span>
                      <span className={`font-mono font-bold ${owned.pnlAbsolute >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {owned.pnlAbsolute >= 0 ? "+" : ""}{owned.pnlAbsolute.toLocaleString("de-DE")} V€ ({owned.pnlAbsolute >= 0 ? "+" : ""}{owned.pnlPercent}%)
                      </span>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-xs text-slate-400">Du besitzt derzeit keine Anteile von {asset.symbol} in Deinem simulierten Papier-Portfolio.</p>
                  </div>
                );
              }
            })()}
          </div>

          {/* Asset Info Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Asset-Steckbrief</h4>
            
            <div className="space-y-2 text-xs divide-y divide-slate-50">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Letzter Schlusskurs:</span>
                <span className="font-mono font-semibold text-slate-700">{formatAssetPrice(asset.prevClosePrice, asset.currency)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Kurs vor 7 Tagen:</span>
                <span className="font-mono font-semibold text-slate-700">{formatAssetPrice(asset.price7DaysAgo, asset.currency)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Kurs vor 30 Tagen:</span>
                <span className="font-mono font-semibold text-slate-700">{formatAssetPrice(asset.price30DaysAgo, asset.currency)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">NOC-Volatilität:</span>
                <span className="font-semibold text-slate-700">{asset.volatility.toUpperCase()}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
