import React, { useState } from "react";
import { SystemState, Asset, AssetType, VolatilityRating } from "../types";
import MiniSparkline from "./MiniSparkline";
import { Plus, Search, Trash2, TrendingUp, TrendingDown, Eye, AlertTriangle, Cpu, CreditCard, ChevronRight } from "lucide-react";

interface WatchlistProps {
  state: SystemState;
  onSelectAsset: (symbol: string) => void;
  onAddAsset: (asset: {
    symbol: string;
    name: string;
    type: AssetType;
    price: number;
    volatility: VolatilityRating;
    status: 'Bullish' | 'Neutral' | 'Bearish';
  }) => void;
  onRemoveAsset: (symbol: string) => void;
  onOpenTradeModal: (symbol: string) => void;
}

export default function Watchlist({
  state,
  onSelectAsset,
  onAddAsset,
  onRemoveAsset,
  onOpenTradeModal
}: WatchlistProps) {
  const { assets } = state;
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);

  // New Asset State Form
  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AssetType>("stock");
  const [newPrice, setNewPrice] = useState("");
  const [newVol, setNewVol] = useState<VolatilityRating>("medium");
  const [newStatus, setNewStatus] = useState<'Bullish' | 'Neutral' | 'Bearish'>("Neutral");
  const [errorMsg, setErrorMsg] = useState("");

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.symbol.toLowerCase().includes(search.toLowerCase()) ||
      asset.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || asset.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol || !newName || !newPrice) {
      setErrorMsg("Bitte fülle alle Pflichtfelder aus.");
      return;
    }

    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg("Ungültiger Preis eingegeben.");
      return;
    }

    onAddAsset({
      symbol: newSymbol.toUpperCase().trim(),
      name: newName.trim(),
      type: newType,
      price: priceNum,
      volatility: newVol,
      status: newStatus
    });

    // Reset Form
    setNewSymbol("");
    setNewName("");
    setNewPrice("");
    setNewVol("medium");
    setNewStatus("Neutral");
    setErrorMsg("");
    setShowAddForm(false);
  };

  const getVolBadge = (vol: VolatilityRating) => {
    const styling = {
      low: "bg-slate-50 text-slate-600 border-slate-100",
      medium: "bg-blue-50 text-blue-700 border-blue-100",
      high: "bg-amber-50 text-amber-700 border-amber-100",
      extreme: "bg-red-50 text-red-700 border-red-100"
    };
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styling[vol]}`}>
        {vol === "low" ? "Niedrig" : vol === "medium" ? "Mittel" : vol === "high" ? "Hoch" : "Extrem"}
      </span>
    );
  };

  const getStatusBadge = (status: 'Bullish' | 'Neutral' | 'Bearish') => {
    const styling = {
      Bullish: "bg-emerald-50 text-emerald-700 border-emerald-100",
      Neutral: "bg-slate-50 text-slate-600 border-slate-100",
      Bearish: "bg-red-50 text-red-700 border-red-100"
    };
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styling[status]}`}>
        {status}
      </span>
    );
  };

  const renderPct = (val: number) => {
    const isPos = val >= 0;
    return (
      <span className={`font-mono font-semibold text-xs flex items-center ${isPos ? "text-emerald-600" : "text-red-600"}`}>
        {isPos ? "+" : ""}{val.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Watchlist Marktübersicht</h2>
          <p className="text-xs text-slate-500 mt-1">Überwache Kurse, Tagesänderungen, mittelfristige Trends und führe Konsens-KI-Analysen aus.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Asset hinzufügen
        </button>
      </div>

      {/* Slide-out/Toggle inline form to add new Tickers */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 max-w-2xl animate-fadeIn">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Neues Asset überwachen</h3>
          {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Symbol (z.B. GOOG, SOL, SPY)</label>
              <input
                type="text"
                placeholder="NVDA"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Asset Name</label>
              <input
                type="text"
                placeholder="Alphabet Inc."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Asset-Klasse</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as AssetType)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="stock">Aktie</option>
                <option value="etf">ETF (Fonds)</option>
                <option value="crypto">Kryptowährung</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Aktueller Kurs (€)</label>
              <input
                type="number"
                step="any"
                placeholder="150.25"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Volatilität</label>
              <select
                value={newVol}
                onChange={(e) => setNewVol(e.target.value as VolatilityRating)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
                <option value="extreme">Extrem</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Marktstatus (Grundsentiment)</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Bullish">Bullish</option>
                <option value="Neutral">Neutral</option>
                <option value="Bearish">Bearish</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500 shadow-xs"
            >
              Speichern & Backfill Chart
            </button>
          </div>
        </form>
      )}

      {/* Filters & Tickers List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Search & Class Filtering bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Suchen nach Name/Symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto w-full sm:w-auto">
            {[
              { id: "all", label: "Alle Assets" },
              { id: "stock", label: "Aktien" },
              { id: "etf", label: "ETFs" },
              { id: "crypto", label: "Crypto" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  filterType === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Large Table of Tickers */}
        {filteredAssets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 pl-6">Asset / Symbol</th>
                  <th className="p-4">Trend (30d)</th>
                  <th className="p-4">Kurs (€)</th>
                  <th className="p-4 text-center">Tagesperf.</th>
                  <th className="p-4 text-center">7-Tage</th>
                  <th className="p-4 text-center">30-Tage</th>
                  <th className="p-4 text-center">Volatilität</th>
                  <th className="p-4 text-center">NOC Status</th>
                  <th className="p-4 pr-6 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {filteredAssets.map((asset) => (
                  <tr key={asset.symbol} className="hover:bg-slate-50/50 transition-colors group">
                    {/* Symbol Info */}
                    <td 
                      className="p-4 pl-6 cursor-pointer"
                      onClick={() => onSelectAsset(asset.symbol)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 text-slate-800 w-9 h-9 rounded-xl flex items-center justify-center font-bold font-mono text-xs shadow-xs border border-slate-200">
                          {asset.symbol}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 text-xs sm:text-sm group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                            {asset.name}
                            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                            {asset.type === "stock" ? "Aktie" : asset.type === "etf" ? "ETF" : "Crypto"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Sparkline */}
                    <td className="p-4">
                      <div className="p-1.5 bg-slate-50/50 rounded-lg inline-block border border-slate-100">
                        <MiniSparkline history={asset.history} />
                      </div>
                    </td>

                    {/* Price */}
                    <td className="p-4 font-mono font-bold text-slate-800">
                      {asset.currentPrice.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>

                    {/* Changes */}
                    <td className="p-4 text-center">{renderPct(asset.dailyChangePercent)}</td>
                    <td className="p-4 text-center">{renderPct(asset.change7DaysPercent)}</td>
                    <td className="p-4 text-center">{renderPct(asset.change30DaysPercent)}</td>

                    {/* Volatility */}
                    <td className="p-4 text-center">{getVolBadge(asset.volatility)}</td>

                    {/* Status */}
                    <td className="p-4 text-center">{getStatusBadge(asset.status)}</td>

                    {/* Actions */}
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectAsset(asset.symbol)}
                          title="Asset Detailanalyse öffnen"
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer border border-slate-200"
                        >
                          <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                        </button>
                        <button
                          onClick={() => onOpenTradeModal(asset.symbol)}
                          title="Simulierten Trade platzieren"
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer border border-slate-200"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                        </button>
                        {/* Protect core symbols from being deleted, but let custom ones go */}
                        {!["NVDA", "MSFT", "BTC", "ETH", "SOL", "SPY"].includes(asset.symbol) && (
                          <button
                            onClick={() => onRemoveAsset(asset.symbol)}
                            title="Aus der Watchlist entfernen"
                            className="p-1.5 bg-slate-50 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg cursor-pointer border border-slate-200 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            <p className="text-sm font-semibold">Keine Assets gefunden.</p>
            <p className="text-xs text-slate-400 mt-1">Verringere die Filtereinstellungen oder füge ein neues Asset hinzu.</p>
          </div>
        )}
      </div>
    </div>
  );
}
