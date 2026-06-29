import React from "react";
import { SystemState, Asset, Forecast, Alert, TradeLog, formatAssetPrice } from "../types";
import { TrendingUp, TrendingDown, Bell, Clock, Award, ShieldAlert, Zap, ArrowUpRight, Plus, RefreshCw } from "lucide-react";

interface DashboardProps {
  state: SystemState;
  onNavigate: (tab: string) => void;
  onResetPortfolio: () => void;
  onSelectAsset: (symbol: string) => void;
}

export default function Dashboard({
  state,
  onNavigate,
  onResetPortfolio,
  onSelectAsset
}: DashboardProps) {
  const { portfolio, assets, forecasts, alerts, trades, lastUpdated } = state;

  // Compute stats
  const activeForecasts = forecasts.filter(f => f.status === "active");
  const resolvedForecasts = forecasts.filter(f => f.status === "resolved");
  const correctResolvedCount = resolvedForecasts.filter(f => f.results?.isCorrect).length;
  const forecastAccuracy = resolvedForecasts.length > 0 
    ? Math.round((correctResolvedCount / resolvedForecasts.length) * 100) 
    : 0;

  const activeAlertsCount = alerts.filter(a => a.active).length;
  const triggeredAlerts = alerts.filter(a => a.triggered);

  // Top gainers/losers of day
  const sortedByDay = [...assets].sort((a, b) => b.dailyChangePercent - a.dailyChangePercent);
  const topGainers = sortedByDay.slice(0, 3).filter(a => a.dailyChangePercent > 0);
  const topLosers = [...sortedByDay].reverse().slice(0, 3).filter(a => a.dailyChangePercent < 0);

  // Format currency
  const fmt = (num: number) => num.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  const pnlColor = portfolio.pnlAbsolute >= 0 ? "text-emerald-600" : "text-red-600";
  const pnlBg = portfolio.pnlAbsolute >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";

  return (
    <div className="space-y-6">
      {/* Real Time Data Status Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase tracking-wider">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Market Data NOC</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Zuletzt aktualisiert: <span className="text-emerald-400 font-mono">{new Date(lastUpdated).toLocaleTimeString()}</span>
          </h2>
          <p className="text-xs text-slate-400">
            Das System nutzt echte Marktdaten für alle Kurse und Analysen. Stale Data wird gekennzeichnet.
          </p>
        </div>
      </div>

      {/* Bento Grid Core Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Wealth Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gesamtvermögen</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${pnlBg}`}>
              {portfolio.pnlAbsolute >= 0 ? "+" : ""}{portfolio.pnlPercent.toFixed(2)}%
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {fmt(portfolio.totalValue)}
            </div>
            <div className={`text-xs font-medium mt-1 flex items-center gap-1 ${pnlColor}`}>
              {portfolio.pnlAbsolute >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{portfolio.pnlAbsolute >= 0 ? "+" : ""}{fmt(portfolio.pnlAbsolute)} gesamt</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-100 pt-2.5 mt-1">
            <span>Cash-Bestand: {fmt(portfolio.balance)}</span>
            <button 
              onClick={onResetPortfolio} 
              className="text-slate-500 hover:text-red-500 transition-colors font-semibold cursor-pointer"
            >
              Reset (10k V€)
            </button>
          </div>
        </div>

        {/* Forecast Accuracy Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">KI Prognose-Qualität</span>
            <span className="text-indigo-600 bg-indigo-50 text-[10px] px-2 py-0.5 rounded-full font-mono">
              Evaluierungs-NOC
            </span>
          </div>
          <div className="my-3">
            {resolvedForecasts.length > 0 ? (
              <>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1.5">
                  <span>{forecastAccuracy}%</span>
                  <span className="text-sm font-semibold text-slate-400">Trefferquote</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{resolvedForecasts.length} abgeschlossene Analysen</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Noch keine Daten
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <span>0 abgeschlossene Prognosen. Evaluierung startet nach Fälligkeit.</span>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-100 pt-2.5 mt-1">
            <span>{activeForecasts.length} Prognosen im Tracking</span>
            <button 
              onClick={() => onNavigate("forecasts")} 
              className="text-indigo-600 hover:text-indigo-700 transition-colors font-semibold flex items-center cursor-pointer"
            >
              Alle Details <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Alarms Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aktive Alarme</span>
            <span className="text-amber-600 bg-amber-50 text-[10px] px-2 py-0.5 rounded-full font-mono">
              NOC Trigger
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span>{activeAlertsCount}</span>
              <span className="text-xs text-slate-400 font-normal">scharfe Triggers</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span>{triggeredAlerts.length} Alarme ausgelöst</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-100 pt-2.5 mt-1">
            <span>Zuletzt ausgelöst: {triggeredAlerts[0] ? triggeredAlerts[0].symbol : "Keine"}</span>
            <button 
              onClick={() => onNavigate("alerts")} 
              className="text-indigo-600 hover:text-indigo-700 transition-colors font-semibold flex items-center cursor-pointer"
            >
              Manage <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Open Positions Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aktive Portfolio-Werte</span>
            <span className="text-emerald-600 bg-emerald-50 text-[10px] px-2 py-0.5 rounded-full font-mono">
              Paper Trading
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {portfolio.positions.length}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>In {portfolio.positions.length} verschiedenen Werten investiert</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-100 pt-2.5 mt-1">
            <span>Trades gesamt: {trades.length}</span>
            <button 
              onClick={() => onNavigate("portfolio")} 
              className="text-indigo-600 hover:text-indigo-700 transition-colors font-semibold flex items-center cursor-pointer"
            >
              Portfolio <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Two Columns: Watchlist Quick Info & Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Market Movers Block (1 Column) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            Tagesgewinner & -verlierer
          </h3>
          
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block mb-2">Top Gewinner</span>
              {topGainers.length > 0 ? (
                <div className="space-y-2">
                  {topGainers.map(asset => (
                    <div 
                      key={asset.symbol} 
                      onClick={() => onSelectAsset(asset.symbol)}
                      className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-all duration-150 border border-transparent hover:border-slate-100"
                    >
                      <div>
                        <span className="font-bold text-slate-800 text-sm">{asset.symbol}</span>
                        <span className="text-[11px] text-slate-400 block">{asset.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm font-semibold">{formatAssetPrice(asset.currentPrice, asset.currency)}</span>
                        <span className="text-xs font-semibold text-emerald-600 block">+{asset.dailyChangePercent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Keine Gewinner am heutigen Tag.</p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-2">
              <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wider block mb-2">Top Verlierer</span>
              {topLosers.length > 0 ? (
                <div className="space-y-2">
                  {topLosers.map(asset => (
                    <div 
                      key={asset.symbol} 
                      onClick={() => onSelectAsset(asset.symbol)}
                      className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-all duration-150 border border-transparent hover:border-slate-100"
                    >
                      <div>
                        <span className="font-bold text-slate-800 text-sm">{asset.symbol}</span>
                        <span className="text-[11px] text-slate-400 block">{asset.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm font-semibold">{formatAssetPrice(asset.currentPrice, asset.currency)}</span>
                        <span className="text-xs font-semibold text-red-600 block">{asset.dailyChangePercent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Keine Verlierer am heutigen Tag.</p>
              )}
            </div>
          </div>
        </div>

        {/* Hot KI Forecasts & Core NOC monitoring (2 Columns) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-500" />
                Aktive KI-Prognosen im Tracking
              </h3>
              <button 
                onClick={() => onNavigate("forecasts")}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
              >
                Alle ansehen
              </button>
            </div>

            {activeForecasts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {activeForecasts.slice(0, 4).map(fc => {
                  const daysToWait = fc.targetHorizon === "1d" ? 1 : fc.targetHorizon === "7d" ? 7 : fc.targetHorizon === "30d" ? 30 : 90;
                  const start = new Date(fc.date);
                  start.setDate(start.getDate() + daysToWait);
                  const evalDateStr = start.toISOString().split("T")[0];

                  const isUp = fc.direction === "Bullish";
                  const color = isUp ? "text-emerald-600 bg-emerald-50" : fc.direction === "Bearish" ? "text-red-600 bg-red-50" : "text-slate-600 bg-slate-50";
                  const asset = assets.find(a => a.symbol === fc.symbol);

                  return (
                    <div key={fc.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-800 text-sm">{fc.symbol}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">Startpreis: {formatAssetPrice(fc.startPrice, asset?.currency)}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
                          {fc.direction}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Horizon: {fc.targetHorizon}</span>
                        <span>Soll-Datum: <strong className="font-mono text-slate-800">{evalDateStr}</strong></span>
                      </div>
                      <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full w-1/3 animate-pulse"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                <p className="text-sm text-slate-400">Keine aktiven Prognosen vorhanden.</p>
                <p className="text-xs text-slate-400 mt-1">Öffne ein Asset in der Watchlist und klicke auf "KI-Analyse starten", um ein Prognose-Tracking aufzusetzen.</p>
                <button
                  onClick={() => onNavigate("watchlist")}
                  className="mt-3 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500 transition-colors cursor-pointer"
                >
                  Watchlist öffnen
                </button>
              </div>
            )}
          </div>

          {/* Triggered alarms alerts feeds */}
          <div className="border-t border-slate-100 pt-4 mt-4">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              Zuletzt ausgelöste Alarme
            </h4>
            {triggeredAlerts.length > 0 ? (
              <div className="space-y-1.5 max-h-24 overflow-y-auto text-xs pr-1">
                {triggeredAlerts.slice(0, 3).map(al => {
                  const asset = assets.find(a => a.symbol === al.symbol);
                  return (
                    <div key={al.id} className="flex justify-between items-center p-1.5 bg-amber-50/50 border border-amber-100 rounded-lg text-slate-700">
                      <span className="font-semibold">{al.symbol}</span>
                      <span>
                        Preis hat {al.type === "price_above" ? "Überschritten" : "Unterschritten"}: {formatAssetPrice(al.threshold, asset?.currency)} (Triggerwert: {al.triggerValue ? formatAssetPrice(al.triggerValue, asset?.currency) : '-'})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{al.triggerDate}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Bisher keine Alarme ausgelöst. Du kannst Triggers in der Asset-Detailansicht oder unter Alarme konfigurieren.</p>
            )}
          </div>
        </div>

      </div>

      {/* News Feed overview */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-500" />
          Finanznachrichten & Sentiment Feed
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.news.slice(0, 3).map(item => {
            const sentimentColors = {
              positive: "bg-emerald-50 text-emerald-700 border-emerald-100",
              neutral: "bg-slate-50 text-slate-600 border-slate-100",
              negative: "bg-red-50 text-red-700 border-red-100"
            };
            return (
              <div key={item.id} className="p-4 bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-xl flex flex-col justify-between space-y-3 transition-all">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-indigo-600 font-mono text-xs">{item.symbol}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sentimentColors[item.sentiment]}`}>
                      {item.sentiment === "positive" ? "Bullish" : item.sentiment === "negative" ? "Bearish" : "Neutral"}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm line-clamp-1">{item.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{item.summary}</p>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                  <span>{item.date}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
