import React, { useState } from "react";
import { SystemState, AlertType, formatAssetPrice } from "../types";
import { Bell, Trash2, ShieldAlert, Plus, Check, BellRing } from "lucide-react";

interface AlertManagerProps {
  state: SystemState;
  onAddAlert: (alert: { symbol: string; type: AlertType; threshold: number }) => void;
  onDeleteAlert: (id: string) => void;
}

export default function AlertManager({
  state,
  onAddAlert,
  onDeleteAlert
}: AlertManagerProps) {
  const { alerts, assets } = state;
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState<AlertType>("price_above");
  const [threshold, setThreshold] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const activeAlerts = alerts.filter((a) => a.active);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !threshold) {
      setErrorMsg("Bitte fülle alle Pflichtfelder aus.");
      return;
    }

    const valueNum = parseFloat(threshold);
    if (isNaN(valueNum) || valueNum <= 0) {
      setErrorMsg("Ungültiger Schwellenwert eingegeben.");
      return;
    }

    const upperSymbol = symbol.toUpperCase().trim();
    const assetExists = assets.some((a) => a.symbol === upperSymbol);
    if (!assetExists) {
      setErrorMsg(`Asset mit Symbol '${upperSymbol}' ist nicht in der Watchlist vorhanden.`);
      return;
    }

    onAddAlert({
      symbol: upperSymbol,
      type,
      threshold: valueNum
    });

    setSymbol("");
    setThreshold("");
    setErrorMsg("");
    setSuccessMsg("Alarm erfolgreich scharfgestellt.");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Grenzpreis- und NOC-Alarme</h2>
          <p className="text-xs text-slate-500 mt-1">Sichere Deine Positionen ab oder erfasse Einstiege über vollautomatische Preistriggers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Column */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs h-fit space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <BellRing className="w-4 h-4 text-amber-500 animate-bounce" />
            Neuen Alarm anlegen
          </h3>

          {errorMsg && <p className="text-xs text-red-500 font-semibold">{errorMsg}</p>}
          {successMsg && <p className="text-xs text-emerald-600 font-semibold">{successMsg}</p>}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Asset Symbol (z.B. BTC, NVDA)</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Asset auswählen --</option>
                 {assets.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.symbol} - {a.name} (Aktuell: {formatAssetPrice(a.currentPrice, a.currency)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Alarm-Bedingung</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AlertType)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="price_above">Kurs steigt über oder gleich (≥)</option>
                <option value="price_below">Kurs fällt unter oder gleich (≤)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Preis-Schwellenwert (in Asset-Währung)</label>
              <input
                type="number"
                step="any"
                placeholder="z.B. 130"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Scharfstellen
            </button>
          </form>
        </div>

        {/* Live Alarms Ledger Columns */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Alarms */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500 animate-pulse" />
              Scharfe Alarme ({activeAlerts.length})
            </h3>

            {activeAlerts.length > 0 ? (
              <div className="space-y-2">
                {activeAlerts.map((al) => {
                  const asset = assets.find((a) => a.symbol === al.symbol);
                  return (
                    <div key={al.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center transition-all hover:bg-slate-100/40">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-800 font-bold text-sm font-mono">{al.symbol}</strong>
                          <span className="text-xs text-slate-400 font-medium">{al.assetName}</span>
                        </div>
                        <span className="text-xs text-slate-500 mt-1 block">
                          Triggert, wenn Preis {al.type === "price_above" ? "steigt über ≥" : "fällt unter ≤"}{" "}
                          <strong className="text-slate-800 font-mono">{formatAssetPrice(al.threshold, asset?.currency)}</strong>
                        </span>
                      </div>

                      <button
                        onClick={() => onDeleteAlert(al.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">Derzeit sind keine Grenzpreisalarme scharfgestellt.</p>
            )}
          </div>

          {/* Triggered Alarms Log */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Ausgelöste Triggers ({triggeredAlerts.length})
            </h3>

            {triggeredAlerts.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {triggeredAlerts.map((al) => {
                  const asset = assets.find((a) => a.symbol === al.symbol);
                  return (
                    <div key={al.id} className="p-3.5 bg-amber-50/40 border border-amber-100 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-amber-800 font-bold font-mono">{al.symbol}</strong>
                          <span className="text-xs text-amber-700/80 font-medium">{al.assetName}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-snug">
                          Bedingung {al.type === "price_above" ? "Preis ≥" : "Preis ≤"}{" "}
                          <strong className="font-mono">{formatAssetPrice(al.threshold, asset?.currency)}</strong> erfüllt.
                          Auslösungskurs am {al.triggerDate}: <strong className="font-mono text-amber-800">{al.triggerValue ? formatAssetPrice(al.triggerValue, asset?.currency) : '-'}</strong>
                        </p>
                      </div>

                      <div className="p-1 text-amber-600 bg-amber-100 rounded-lg">
                        <Check className="w-4 h-4 font-bold" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">Bisher wurden noch keine Triggers ausgelöst.</p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
