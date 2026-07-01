import { SystemState, Asset, AlertType, AssetType, VolatilityRating } from "./types";
import { DEMO_INITIAL_STATE } from "./demoData";

const DEMO_STORAGE_KEY = "marketops-demo-state-v1";
export const isDemoMode =
  import.meta.env.VITE_DEMO_MODE === "true" || import.meta.env.MODE === "demo";

function cloneDemoState(): SystemState {
  return JSON.parse(JSON.stringify(DEMO_INITIAL_STATE));
}

function getDemoState(): SystemState {
  const stored = localStorage.getItem(DEMO_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as SystemState;
    } catch (e) {
      console.error("Failed to parse demo state", e);
    }
  }
  return cloneDemoState();
}

function saveDemoState(state: SystemState) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

export const apiClient = {
  async getState(): Promise<SystemState> {
    if (isDemoMode) {
      return getDemoState();
    }
    const res = await fetch("/api/state");
    if (!res.ok) throw new Error("Failed to fetch state");
    return await res.json();
  },

  async executeTrade(trade: { symbol: string; type: "BUY" | "SELL"; quantity: number; reason: string }): Promise<SystemState> {
    if (isDemoMode) {
      const state = getDemoState();
      const asset = state.assets.find(a => a.symbol === trade.symbol);
      if (!asset) throw new Error("Asset not found");

      const qty = trade.quantity;
      const price = asset.currentPrice;
      const flatFee = asset.type === "crypto" ? parseFloat((qty * price * 0.001).toFixed(2)) : 4.90;
      const subTotal = qty * price;

      if (trade.type === "BUY") {
        const cost = subTotal + flatFee;
        if (state.portfolio.balance < cost) throw new Error("Ungenügende Liquidität");

        state.portfolio.balance -= cost;

        let pos = state.portfolio.positions.find(p => p.symbol === trade.symbol);
        if (pos) {
          const totalCost = pos.quantity * pos.avgBuyPrice + subTotal;
          pos.quantity += qty;
          pos.avgBuyPrice = totalCost / pos.quantity;
          pos.totalCost = pos.quantity * pos.avgBuyPrice;
          pos.currentValue = pos.quantity * price;
          pos.pnlAbsolute = pos.currentValue - pos.totalCost;
          pos.pnlPercent = (pos.pnlAbsolute / pos.totalCost) * 100;
        } else {
          state.portfolio.positions.push({
            symbol: asset.symbol,
            name: asset.name,
            type: asset.type,
            quantity: qty,
            avgBuyPrice: price,
            currentPrice: price,
            totalCost: cost,
            currentValue: subTotal,
            pnlAbsolute: subTotal - cost,
            pnlPercent: ((subTotal - cost) / cost) * 100
          });
        }
      } else {
        const cost = subTotal - flatFee;
        let pos = state.portfolio.positions.find(p => p.symbol === trade.symbol);
        if (!pos || pos.quantity < qty) throw new Error("Nicht genügend Anteile");

        state.portfolio.balance += cost;
        pos.quantity -= qty;
        if (pos.quantity === 0) {
          state.portfolio.positions = state.portfolio.positions.filter(p => p.symbol !== trade.symbol);
        } else {
          pos.totalCost = pos.quantity * pos.avgBuyPrice;
          pos.currentValue = pos.quantity * price;
          pos.pnlAbsolute = pos.currentValue - pos.totalCost;
          pos.pnlPercent = (pos.pnlAbsolute / pos.totalCost) * 100;
        }
      }

      state.portfolio.totalValue = state.portfolio.balance + state.portfolio.positions.reduce((acc, p) => acc + p.currentValue, 0);
      state.portfolio.pnlAbsolute = state.portfolio.totalValue - state.portfolio.startBalance;
      state.portfolio.pnlPercent = (state.portfolio.pnlAbsolute / state.portfolio.startBalance) * 100;

      state.trades.push({
        id: `demo-trade-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        symbol: asset.symbol,
        assetName: asset.name,
        type: trade.type,
        quantity: qty,
        price,
        fee: flatFee,
        reason: trade.reason
      });

      saveDemoState(state);
      return state;
    }

    const res = await fetch("/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trade)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Transaktion fehlgeschlagen.");
    }
    return await res.json();
  },

  async submitForecast(analysisId: string, expectedChangePercent: number): Promise<SystemState> {
    if (isDemoMode) {
      const state = getDemoState();
      const analysis = state.analyses.find(a => a.id === analysisId);
      if (!analysis) throw new Error("Analysis not found");
      const asset = state.assets.find(a => a.symbol === analysis.symbol);
      if (!asset) throw new Error("Asset not found");

      state.forecasts.push({
        id: `demo-forecast-${Date.now()}`,
        symbol: asset.symbol,
        assetName: asset.name,
        date: new Date().toISOString().split("T")[0],
        targetHorizon: analysis.horizon,
        direction: expectedChangePercent >= 0 ? "Bullish" : "Bearish",
        startPrice: asset.currentPrice,
        expectedChangePercent,
        score: analysis.score,
        status: "active",
        analysisId: analysis.id,
        modelName: analysis.modelName || "Sample Analysis (Demo Data)"
      });
      saveDemoState(state);
      return state;
    }

    const res = await fetch("/api/forecast/submit-from-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId, expectedChangePercent })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Erstellen der Prognose.");
    }
    return await res.json();
  },

  async addAlert(alert: { symbol: string; type: AlertType; threshold: number }): Promise<SystemState> {
    if (isDemoMode) {
      const state = getDemoState();
      const asset = state.assets.find(a => a.symbol === alert.symbol);
      if (!asset) throw new Error("Asset not found");
      state.alerts.push({
        id: `demo-alert-${Date.now()}`,
        symbol: alert.symbol,
        assetName: asset.name,
        type: alert.type,
        threshold: alert.threshold,
        dateAdded: new Date().toISOString().split("T")[0],
        active: true,
        triggered: false
      });
      saveDemoState(state);
      return state;
    }

    const res = await fetch("/api/alerts/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Erzeugen des Alarms.");
    }
    return await res.json();
  },

  async deleteAlert(id: string): Promise<SystemState> {
    if (isDemoMode) {
      const state = getDemoState();
      state.alerts = state.alerts.filter(a => a.id !== id);
      saveDemoState(state);
      return state;
    }

    const res = await fetch("/api/alerts/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Löschen des Alarms.");
    }
    return await res.json();
  },

  async resetPortfolio(): Promise<SystemState> {
    if (isDemoMode) {
      const state = cloneDemoState();
      saveDemoState(state);
      return state;
    }

    const res = await fetch("/api/portfolio/reset", { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Zurücksetzen.");
    }
    return await res.json();
  },

  async addWatchlistAsset(asset: {
    symbol: string;
    name: string;
    type: AssetType;
    price: number;
    volatility: VolatilityRating;
    status: 'Bullish' | 'Neutral' | 'Bearish';
  }): Promise<SystemState> {
    if (isDemoMode) {
      const state = getDemoState();
      if (state.assets.find(a => a.symbol === asset.symbol)) throw new Error("Bereits in Watchlist.");
      // Just mock history for the new asset
      const history = [];
      for (let i = 0; i < 30; i++) {
        history.push({ date: `2024-01-${(i + 1).toString().padStart(2, '0')}`, price: asset.price });
      }
      state.assets.push({
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
        currentPrice: asset.price,
        prevClosePrice: asset.price,
        price7DaysAgo: asset.price,
        price30DaysAgo: asset.price,
        dailyChangePercent: 0,
        change7DaysPercent: 0,
        change30DaysPercent: 0,
        volatility: asset.volatility,
        status: asset.status,
        history,
        currency: "USD"
      });
      saveDemoState(state);
      return state;
    }

    const res = await fetch("/api/watchlist/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(asset)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Hinzufügen des Tickers.");
    }
    return await res.json();
  },

  async removeWatchlistAsset(symbol: string): Promise<SystemState> {
    if (isDemoMode) {
      const state = getDemoState();
      state.assets = state.assets.filter(a => a.symbol !== symbol);
      saveDemoState(state);
      return state;
    }

    const res = await fetch("/api/watchlist/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Entfernen des Tickers.");
    }
    return await res.json();
  },

  async getAnalysisContext(symbol: string, horizon: string): Promise<{ generatedPrompt: string }> {
    if (isDemoMode) {
      return { generatedPrompt: `Dies ist ein simulierter Analyse-Prompt für ${symbol} mit Horizont ${horizon} im Demo-Modus.` };
    }

    const res = await fetch(`/api/analysis-context/${symbol}?horizon=${horizon}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Laden des Analyse-Kontextes.");
    }
    return await res.json();
  },

  async importAnalysis(symbol: string, pastedResult: string, horizon: string): Promise<{ analysis: any }> {
    if (isDemoMode) {
      try {
        const parsed = JSON.parse(pastedResult);
        const state = getDemoState();
        const asset = state.assets.find(a => a.symbol === symbol);
        if (!asset) throw new Error("Asset not found");

        const newAnalysis = {
          id: `demo-analysis-${Date.now()}`,
          symbol: asset.symbol,
          assetName: asset.name,
          date: new Date().toISOString().split("T")[0],
          score: parsed.score || 85,
          recommendation: parsed.recommendation || "Kaufen",
          summary: parsed.summary || "Sample demo analysis.",
          bullCase: parsed.bullCase || "Sample bull case.",
          bearCase: parsed.bearCase || "Sample bear case.",
          technicalAnalysis: parsed.technicalAnalysis || "Sample technical info.",
          fundamentalAnalysis: parsed.fundamentalAnalysis || "Sample fundamental info.",
          newsSentiment: parsed.newsSentiment || "Positive",
          riskRating: parsed.riskRating || "high",
          horizon: horizon as any,
          modelsScores: {
            gpt: 80,
            claude: 85,
            gemini: 90,
            technical: 85
          },
          expectedReturnPercent: parsed.expectedReturnPercent || 15,
          expectedDirection: parsed.expectedDirection || "Bullish",
          targetPriceOptional: parsed.targetPriceOptional || null,
          modelName: "Sample Analysis (Demo Data)"
        };
        state.analyses.unshift(newAnalysis);
        saveDemoState(state);
        return { analysis: newAnalysis };
      } catch (e) {
        throw new Error("Invalid JSON in demo import");
      }
    }

    const res = await fetch(["/api", "analysis", "import"].join("/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, pastedResult, horizon })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Importieren der Analyse.");
    }
    return await res.json();
  }
};
