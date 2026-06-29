import React, { useState } from "react";
import { SystemState, Forecast } from "../types";
import { Award, CheckCircle, XCircle, TrendingUp, TrendingDown, Clock, BarChart3, HelpCircle, ShieldAlert } from "lucide-react";

interface ForecastTrackerProps {
  state: SystemState;
  onSelectAsset: (symbol: string) => void;
}

export default function ForecastTracker({
  state,
  onSelectAsset
}: ForecastTrackerProps) {
  const { forecasts, lastUpdated } = state;
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  const activeForecasts = forecasts.filter((f) => f.status === "active");
  const resolvedForecasts = forecasts.filter((f) => f.status === "resolved");

  // Detailed Stats Calculation
  const totalResolved = resolvedForecasts.length;
  const correctResolved = resolvedForecasts.filter((f) => f.results?.isCorrect).length;
  const hitRate = totalResolved > 0 ? Math.round((correctResolved / totalResolved) * 100) : 0;

  // Average drift calculation (actual change - expected change)
  let totalDrift = 0;
  resolvedForecasts.forEach((f) => {
    if (f.results) {
      totalDrift += Math.abs(f.results.drift);
    }
  });
  const avgDrift = totalResolved > 0 ? parseFloat((totalDrift / totalResolved).toFixed(2)) : 0;

  const filteredForecasts = forecasts.filter((f) => {
    if (filter === "active") return f.status === "active";
    if (filter === "resolved") return f.status === "resolved";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Tracker Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Hit Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Erfolgsquote (Hit-Rate)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{hitRate}%</span>
              <span className="text-xs font-semibold text-emerald-600">Konsens-Präzision</span>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-slate-500 mt-4 border-t border-slate-50 pt-3">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              {correctResolved} Richtig
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-red-500" />
              {totalResolved - correctResolved} Falsch
            </span>
          </div>
        </div>

        {/* Prediction Drift */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Durchschnittliche Abweichung</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{avgDrift}%</span>
              <span className="text-xs font-semibold text-indigo-500">Drift absolut</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-4 border-t border-slate-50 pt-3">
            Die durchschnittliche Differenz zwischen der prognostizierten Rendite und der tatsächlichen Kursbewegung.
          </p>
        </div>

        {/* Dynamic Timeline Info */}
        <div className="bg-slate-950 text-white p-5 rounded-2xl border border-slate-900 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Prognosen im Tracking</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold text-white tracking-tight">{activeForecasts.length}</span>
              <span className="text-xs font-semibold text-indigo-400 font-mono">AKTIV</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-4 border-t border-slate-800 pt-3">
            <span>Stand: {lastUpdated ? new Date(lastUpdated).toLocaleDateString("de-DE") : "-"}</span>
          </div>
        </div>

      </div>

      {/* Main Forecast log list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Header and Filter */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Prognose-Journal</h3>
            <p className="text-xs text-slate-400 mt-0.5">Wissenschaftliche Auswertung aller abgegebenen KI-Wertgutachten und deren Eintreffwahrscheinlichkeit.</p>
          </div>

          <div className="flex gap-1">
            {[
              { id: "all", label: "Alle" },
              { id: "active", label: "Aktive Triggers" },
              { id: "resolved", label: "Abgeschlossen" }
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFilter(opt.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filter === opt.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        {filteredForecasts.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredForecasts.map((fc) => {
              const isActive = fc.status === "active";
              
              // Calculate target date
              const start = new Date(fc.date);
              const horizonDays = fc.targetHorizon === "1d" ? 1 : fc.targetHorizon === "7d" ? 7 : fc.targetHorizon === "30d" ? 30 : 90;
              start.setDate(start.getDate() + horizonDays);
              const targetDateStr = start.toISOString().split("T")[0];

              const isUp = fc.direction === "Bullish";
              const dirColor = isUp ? "text-emerald-700 bg-emerald-50 border-emerald-100" : fc.direction === "Bearish" ? "text-red-700 bg-red-50 border-red-100" : "text-slate-600 bg-slate-50 border-slate-100";

              return (
                <div key={fc.id} className="p-5 hover:bg-slate-50/50 transition-all flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  
                  {/* Left Column: Asset information and prediction */}
                  <div className="space-y-2 max-w-md">
                    <div className="flex items-center gap-2">
                      <span 
                        onClick={() => onSelectAsset(fc.symbol)}
                        className="font-extrabold text-slate-800 hover:text-indigo-600 cursor-pointer text-sm sm:text-base font-mono"
                      >
                        {fc.symbol}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{fc.assetName}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dirColor}`}>
                        {fc.direction} ({fc.targetHorizon})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 font-medium">
                      <div>
                        <span>Eingestellt am: </span>
                        <strong className="text-slate-700 font-mono">{fc.date}</strong>
                      </div>
                      <div>
                        <span>Soll-Datum: </span>
                        <strong className="text-slate-700 font-mono">{targetDateStr}</strong>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      Erwartete Kursentwicklung: <strong className="text-slate-800">{fc.direction === "Bullish" ? "+" : ""}{fc.expectedChangePercent}%</strong> • Startkurs: <strong className="text-slate-700 font-mono">{fc.startPrice.toLocaleString("de-DE")} €</strong>
                    </div>
                  </div>

                  {/* Middle Column: Status metrics */}
                  <div className="flex items-center gap-3">
                    {isActive ? (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50/60 border border-indigo-100 px-3 py-1.5 rounded-xl font-semibold">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>Im Tracking...</span>
                      </div>
                    ) : (
                      <div className="space-y-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {fc.results?.isCorrect ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                              <CheckCircle className="w-3.5 h-3.5" />
                              KORREKT
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                              <XCircle className="w-3.5 h-3.5" />
                              ABWEICHUNG
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          Endkurs am {fc.results?.actualEvaluationDate || fc.results?.evaluationDate}: <strong className="text-slate-700 font-mono">{fc.results?.endPrice.toLocaleString("de-DE")} €</strong>
                          {fc.results?.priceFieldUsed === 'close' && (
                            <span className="block text-amber-500 font-semibold mt-0.5">⚠️ Unadjusted Fallback</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Outcomes Analysis details (resolved only) */}
                  <div className="w-full md:w-80 p-3.5 rounded-xl border border-slate-100 bg-slate-50 text-xs">
                    {isActive ? (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">NOC Hinweis</span>
                        <p className="text-slate-500 leading-relaxed text-[11px]">
                          Sobald das Datum den <strong className="font-mono text-slate-700">{targetDateStr}</strong> erreicht, wertet das System die Kursentwicklung automatisch aus.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex justify-between font-semibold text-[10px] text-slate-400 uppercase tracking-wider">
                          <span>Reale Entwicklung</span>
                          <span>Drift</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className={`font-mono font-bold ${Number(fc.results?.actualChangePercent) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {Number(fc.results?.actualChangePercent) >= 0 ? "+" : ""}{fc.results?.actualChangePercent}%
                          </span>
                          <span className="font-mono text-slate-600">
                            {Number(fc.results?.drift) > 0 ? "+" : ""}{fc.results?.drift}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 italic leading-snug pt-1 border-t border-slate-200/60">
                          "{fc.results?.conclusion}"
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <BarChart3 className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-sm font-semibold">Keine Prognosen in dieser Kategorie.</p>
            <p className="text-xs text-slate-400 mt-1">Führe eine KI-Analyse für beliebige Symbole aus der Watchlist durch, um Prognosen zu tracken.</p>
          </div>
        )}
      </div>
    </div>
  );
}
