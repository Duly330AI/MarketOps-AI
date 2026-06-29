import React, { useEffect, useState } from "react";
import { SystemState, Asset, AssetType, VolatilityRating, AlertType } from "./types";
import Dashboard from "./components/Dashboard";
import Watchlist from "./components/Watchlist";
import PaperPortfolio from "./components/PaperPortfolio";
import ForecastTracker from "./components/ForecastTracker";
import TradeJournal from "./components/TradeJournal";
import AlertManager from "./components/AlertManager";
import AssetDetail from "./components/AssetDetail";

import {
  LayoutDashboard,
  LineChart,
  Briefcase,
  TrendingUp,
  History,
  Bell,
  Cpu,
  Clock,
  Menu,
  X,
  RotateCcw,
  RefreshCw,
  Wallet
} from "lucide-react";

export default function App() {
  const [state, setState] = useState<SystemState | null>(null);
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load backend state on mount
  const fetchState = async () => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (e) {
      console.error("Failed to fetch state from Express backend:", e);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, []);

  const handleExecuteTrade = async (trade: { symbol: string; type: "BUY" | "SELL"; quantity: number; reason: string }) => {
    const res = await fetch("/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trade)
    });
    if (res.ok) {
      const data = await res.json();
      setState(data);
    } else {
      const err = await res.json();
      throw new Error(err.error || "Transaktion fehlgeschlagen.");
    }
  };

  const handleRunAiAnalysis = async (symbol: string, horizon: "1d" | "7d" | "30d" | "90d") => {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, horizon })
    });
    if (res.ok) {
      // Re-fetch complete state to populate analyses reverse-chronologically
      await fetchState();
    } else {
      const err = await res.json();
      throw new Error(err.error || "Fehler bei der KI-Analyse.");
    }
  };

  const handleSubmitForecast = async (analysisId: string, expectedChangePercent: number) => {
    const res = await fetch("/api/forecast/submit-from-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId, expectedChangePercent })
    });
    if (res.ok) {
      const data = await res.json();
      setState(data);
    }
  };

  const handleAddAlert = async (alert: { symbol: string; type: AlertType; threshold: number }) => {
    const res = await fetch("/api/alerts/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert)
    });
    if (res.ok) {
      const data = await res.json();
      setState(data);
    } else {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Erzeugen des Alarms.");
    }
  };

  const handleDeleteAlert = async (id: string) => {
    const res = await fetch("/api/alerts/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (res.ok) {
      const data = await res.json();
      setState(data);
    }
  };

  const handleResetPortfolio = async () => {
    if (confirm("Möchtest Du Dein Paper-Portfolio und das Trade Journal wirklich auf 10.000 V€ (Paper Cash) zurücksetzen?")) {
      const res = await fetch("/api/portfolio/reset", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setState(data);
        alert("Portfolio erfolgreich zurückgesetzt.");
      }
    }
  };

  const handleAddWatchlistAsset = async (asset: {
    symbol: string;
    name: string;
    type: AssetType;
    price: number;
    volatility: VolatilityRating;
    status: 'Bullish' | 'Neutral' | 'Bearish';
  }) => {
    const res = await fetch("/api/watchlist/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(asset)
    });
    if (res.ok) {
      const data = await res.json();
      setState(data);
    } else {
      const err = await res.json();
      alert(err.error || "Fehler beim Hinzufügen des Tickers.");
    }
  };

  const handleRemoveWatchlistAsset = async (symbol: string) => {
    const res = await fetch("/api/watchlist/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol })
    });
    if (res.ok) {
      const data = await res.json();
      setState(data);
    }
  };

  const handleSelectAsset = (symbol: string) => {
    setSelectedAssetSymbol(symbol);
    setMobileMenuOpen(false);
  };

  const handleNavigate = (tab: string) => {
    setCurrentTab(tab);
    setSelectedAssetSymbol(null);
    setMobileMenuOpen(false);
  };

  if (isFetching || !state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <Cpu className="w-5 h-5 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="text-sm font-semibold tracking-wide uppercase text-slate-400">Booting MarketOps AI console...</p>
      </div>
    );
  }

  const selectedAsset = state.assets.find((a) => a.symbol === selectedAssetSymbol);

  // Main sidebar options
  const sidebarItems = [
    { id: "dashboard", label: "Dashboard NOC", icon: LayoutDashboard },
    { id: "watchlist", label: "Watchlist Märkte", icon: LineChart },
    { id: "portfolio", label: "Paper Depot", icon: Briefcase },
    { id: "forecasts", label: "Forecast Tracking", icon: TrendingUp },
    { id: "journal", label: "Trade Journal", icon: History },
    { id: "alerts", label: "Triggers & Alarme", icon: Bell }
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* SIDEBAR FOR DESKTOP */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0 select-none">
        {/* Sidebar Brand Logo */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md animate-pulse">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-black text-white text-base tracking-tight">MarketOps AI</h1>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Console v1.0</span>
          </div>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id && !selectedAssetSymbol;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User context footer */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 space-y-1.5 font-medium bg-slate-950/40">
          <div className="flex justify-between">
            <span>Depotwert:</span>
            <strong className="text-white font-mono">{state.portfolio.totalValue.toLocaleString("de-DE")} V€</strong>
          </div>
          <div className="flex justify-between">
            <span>Verfügbar:</span>
            <strong className="text-white font-mono">{state.portfolio.balance.toLocaleString("de-DE")} V€</strong>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER & NAVIGATION */}
      <div className="flex flex-col flex-1 min-w-0">
        
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 bg-slate-900 lg:bg-white text-white lg:text-slate-800 h-16 border-b border-slate-800 lg:border-slate-100 flex items-center justify-between px-4 sm:px-6 shadow-xs select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5.5 h-5.5" /> : <Menu className="w-5.5 h-5.5" />}
            </button>
            
            <div className="flex items-center gap-2">
              <div className="lg:hidden w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center animate-pulse">
                <Cpu className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <span className="hidden lg:inline text-xs font-semibold text-slate-400 uppercase tracking-widest block font-mono">MarketOps AI Network Console</span>
                <span className="lg:hidden font-extrabold text-sm sm:text-base text-white tracking-tight">MarketOps AI</span>
                <span className="hidden lg:inline font-extrabold text-base text-slate-800 tracking-tight">
                  {selectedAssetSymbol ? `Asset Detail: ${selectedAssetSymbol}` : sidebarItems.find(i => i.id === currentTab)?.label}
                </span>
              </div>
            </div>
          </div>

          {/* Nav stats summary */}
          <div className="flex items-center gap-3">
            
            {/* Cash box indicator */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-800 lg:bg-slate-50 border border-slate-700 lg:border-slate-100 px-3 py-1.5 rounded-xl font-medium text-xs">
              <Wallet className="w-3.5 h-3.5 text-indigo-400 lg:text-indigo-600" />
              <span className="text-slate-400 lg:text-slate-500">Guthaben:</span>
              <strong className="font-mono text-white lg:text-slate-800">{state.portfolio.balance.toLocaleString("de-DE")} V€</strong>
            </div>

            {/* Time fast forward indicator */}
            <div className="flex items-center gap-1 bg-slate-800 lg:bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-indigo-400 lg:text-indigo-600" />
              <span className="font-mono text-indigo-300 lg:text-indigo-800">{new Date(state.lastUpdated).toLocaleTimeString()}</span>
            </div>

          </div>
        </header>

        {/* MOBILE SLIDE-OUT MENU DRAWER */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-30 flex">
            {/* Underlay shadow */}
            <div 
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            />
            {/* Drawer body */}
            <div className="relative flex flex-col w-64 bg-slate-900 text-slate-300 h-full p-4 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <span className="font-black text-white text-sm">MarketOps AI</span>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-1">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id && !selectedAssetSymbol;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile stats footer */}
              <div className="absolute bottom-4 left-4 right-4 p-4 border-t border-slate-800 text-xs text-slate-500 space-y-1.5 bg-slate-950/40 rounded-xl">
                <div className="flex justify-between">
                  <span>Depotwert:</span>
                  <strong className="text-white font-mono">{state.portfolio.totalValue.toLocaleString("de-DE")} V€</strong>
                </div>
                <div className="flex justify-between">
                  <span>Liquidität:</span>
                  <strong className="text-white font-mono">{state.portfolio.balance.toLocaleString("de-DE")} V€</strong>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* MAIN BODY SCROLLABLE WINDOW */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {selectedAsset ? (
            <AssetDetail
              asset={selectedAsset}
              state={state}
              onBack={() => setSelectedAssetSymbol(null)}
              onExecuteTrade={handleExecuteTrade}
              onRunAiAnalysis={handleRunAiAnalysis}
              onSubmitForecast={handleSubmitForecast}
              onAddAlert={handleAddAlert}
              onDeleteAlert={handleDeleteAlert}
            />
          ) : (
            <>
              {currentTab === "dashboard" && (
                <Dashboard
                  state={state}
                  onNavigate={handleNavigate}
                  onResetPortfolio={handleResetPortfolio}
                  onSelectAsset={handleSelectAsset}
                />
              )}
              {currentTab === "watchlist" && (
                <Watchlist
                  state={state}
                  onSelectAsset={handleSelectAsset}
                  onAddAsset={handleAddWatchlistAsset}
                  onRemoveAsset={handleRemoveWatchlistAsset}
                  onOpenTradeModal={(sym) => {
                    setSelectedAssetSymbol(sym);
                    setTimeout(() => {
                      const tradeTab = document.querySelector('[title="Simulierten Trade platzieren"]');
                      if (tradeTab) {
                        // Triggers the state update automatically inside detail sheet
                      }
                    }, 100);
                  }}
                />
              )}
              {currentTab === "portfolio" && (
                <PaperPortfolio
                  state={state}
                  onOpenTradeModal={handleSelectAsset}
                  onResetPortfolio={handleResetPortfolio}
                  onSelectAsset={handleSelectAsset}
                />
              )}
              {currentTab === "forecasts" && (
                <ForecastTracker
                  state={state}
                  onSelectAsset={handleSelectAsset}
                />
              )}
              {currentTab === "journal" && (
                <TradeJournal
                  state={state}
                  onSelectAsset={handleSelectAsset}
                />
              )}
              {currentTab === "alerts" && (
                <AlertManager
                  state={state}
                  onAddAlert={handleAddAlert}
                  onDeleteAlert={handleDeleteAlert}
                />
              )}
            </>
          )}
        </main>

        {/* Console global footer */}
        <footer className="bg-white border-t border-slate-100 py-4 px-6 text-center text-xs text-slate-400 select-none">
          MarketOps AI v0.1 Real Data MVP © 2026. Entwickelt für Forschungs- und Bildungszwecke im Paper-Trading NOC. Keine finanzielle Beratung.
        </footer>

      </div>

    </div>
  );
}
