import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

// Load environment variables
dotenv.config();

import {
  Asset,
  AssetType,
  VolatilityRating,
  RecommendationType,
  Position,
  PaperPortfolio,
  TradeLog,
  AiAnalysis,
  Forecast,
  Alert,
  NewsItem,
  SystemState,
  PriceHistoryPoint,
  AssetDataQuality
} from "./src/types";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = path.join(process.cwd(), "data", "db.json");

// Suppress yahoo-finance2 notices

function ensureDbDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "") {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiInstance;
}

function createInitialState(): SystemState {
  return {
    lastUpdated: new Date().toISOString(),
    assets: [],
    portfolio: {
      balance: 10000.00,
      startBalance: 10000.00,
      totalValue: 10000.00,
      positions: [],
      pnlAbsolute: 0,
      pnlPercent: 0
    },
    trades: [],
    analyses: [],
    forecasts: [],
    alerts: [],
    news: []
  };
}

function loadState(): SystemState {
  ensureDbDir();
  if (!fs.existsSync(DB_PATH)) {
    const examplePath = path.join(process.cwd(), "data", "db.example.json");
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, DB_PATH);
    }
  }
  if (fs.existsSync(DB_PATH)) {
    try {
      const data = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed.assets && parsed.portfolio) {
        parsed.assets = parsed.assets.map((asset: any) => ({
          ...asset,
          currency: asset.currency || (asset.symbol.endsWith(".DE") || asset.symbol.endsWith(".F") ? "EUR" : "USD")
        }));
        return parsed as SystemState;
      }
    } catch (e) {
      console.error("Failed to read db.json", e);
    }
  }
  const initialState = createInitialState();
  saveState(initialState);
  return initialState;
}

function saveState(state: SystemState) {
  ensureDbDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function recalculatePortfolio(portfolio: PaperPortfolio, assets: Asset[]): PaperPortfolio {
  let positionsValue = 0;
  const positions = portfolio.positions.map(pos => {
    const asset = assets.find(a => a.symbol === pos.symbol);
    const currentPrice = asset ? asset.currentPrice : pos.currentPrice;
    const currentValue = pos.quantity * currentPrice;
    const totalCost = pos.quantity * pos.avgBuyPrice;
    const pnlAbsolute = currentValue - totalCost;
    const pnlPercent = totalCost > 0 ? (pnlAbsolute / totalCost) * 100 : 0;
    
    positionsValue += currentValue;

    return {
      ...pos,
      currentPrice,
      currentValue: parseFloat(currentValue.toFixed(2)),
      pnlAbsolute: parseFloat(pnlAbsolute.toFixed(2)),
      pnlPercent: parseFloat(pnlPercent.toFixed(2))
    };
  });

  const totalValue = portfolio.balance + positionsValue;
  const pnlAbsolute = totalValue - portfolio.startBalance;
  const pnlPercent = (pnlAbsolute / portfolio.startBalance) * 100;

  return {
    ...portfolio,
    totalValue: parseFloat(totalValue.toFixed(2)),
    positions,
    pnlAbsolute: parseFloat(pnlAbsolute.toFixed(2)),
    pnlPercent: parseFloat(pnlPercent.toFixed(2))
  };
}

// Helper to calculate Simple Moving Average
function calculateSMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

// Helper to calculate Relative Strength Index
function calculateRSI(data: number[], period: number = 14): number | null {
  if (data.length <= period) return null;
  let gains = 0, losses = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  let rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Fetch live market data for a symbol
async function fetchLiveAssetData(symbol: string, existingAsset?: Asset): Promise<Asset | null> {
  console.log(`Fetching live data for ${symbol}...`);
  try {
    const quote: any = await yahooFinance.quote(symbol);
    console.log(`Quote for ${symbol}: price = ${quote?.regularMarketPrice}`);
    if (!quote || !quote.regularMarketPrice) {
      if (existingAsset) {
        return {
          ...existingAsset,
          currency: existingAsset.currency || "USD",
          dataQuality: {
            status: 'unavailable',
            lastFetchTime: new Date().toISOString(),
            source: 'yahoo-finance',
            warningMessage: 'Real-time price unavailable.'
          }
        };
      }
      return null;
    }

    const currentPrice = quote.regularMarketPrice;
    const prevClosePrice = quote.regularMarketPreviousClose || currentPrice;
    const dailyChangePercent = quote.regularMarketChangePercent || 0;

    const assetType = existingAsset?.type || (quote.quoteType === "CRYPTOCURRENCY" ? "crypto" : quote.quoteType === "ETF" ? "etf" : "stock");

    // Determine data quality status
    let status: 'ok' | 'delayed' | 'stale' | 'market_closed' | 'unavailable' = 'ok';
    let warningMessage;
    if (assetType !== 'crypto' && (quote.marketState === 'CLOSED' || quote.marketState === 'POSTPOST' || quote.marketState === 'PREPRE')) {
      status = 'market_closed';
    }

    // Fetch up to 210 days for 200 SMA
    const period1 = new Date();
    period1.setDate(period1.getDate() - 300); // 300 calendar days is approx 210 trading days
    const period2 = new Date();
    const queryOptions: any = { period1, period2 };
    let result = [];
    try {
       result = await yahooFinance.historical(symbol, queryOptions);
    } catch (e) {
       console.error("Historical data fetch failed:", e);
    }
    
    let isAdj = true;
    const history: PriceHistoryPoint[] = result.map(r => {
      const price = r.adjClose !== null && r.adjClose !== undefined ? r.adjClose : (r.close || currentPrice);
      if (r.adjClose === null || r.adjClose === undefined) isAdj = false;
      return {
        date: r.date.toISOString().split("T")[0],
        price,
        isAdj
      };
    });

    if (!isAdj && assetType !== 'crypto') {
      if (status === 'ok') status = 'stale';
      warningMessage = 'Using unadjusted close price as fallback.';
    }

    // Use only last 30 for the UI history
    const history30 = history.slice(-30);
    const price7DaysAgo = history30.length > 7 ? history30[history30.length - 8].price : (history30[0]?.price || currentPrice);
    const price30DaysAgo = history30[0]?.price || currentPrice;

    const dataQuality: AssetDataQuality = {
      status,
      lastMarketTime: quote.regularMarketTime?.toISOString() || new Date().toISOString(),
      lastFetchTime: new Date().toISOString(),
      source: 'yahoo-finance',
      warningMessage: (!isAdj && assetType !== 'crypto') ? 'unadjusted_fallback' : undefined
    };

    return {
      symbol: symbol.toUpperCase(),
      name: quote.longName || quote.shortName || symbol,
      type: assetType,
      currentPrice: parseFloat(currentPrice.toFixed(4)),
      prevClosePrice: parseFloat(prevClosePrice.toFixed(4)),
      price7DaysAgo: parseFloat(price7DaysAgo.toFixed(4)),
      price30DaysAgo: parseFloat(price30DaysAgo.toFixed(4)),
      dailyChangePercent: parseFloat(dailyChangePercent.toFixed(2)),
      change7DaysPercent: parseFloat((((currentPrice - price7DaysAgo) / price7DaysAgo) * 100).toFixed(2)),
      change30DaysPercent: parseFloat((((currentPrice - price30DaysAgo) / price30DaysAgo) * 100).toFixed(2)),
      volatility: existingAsset?.volatility || "medium",
      status: existingAsset?.status || "Neutral",
      history: history30,
      dataQuality,
      currency: (quote.currency || existingAsset?.currency || "USD").toUpperCase()
    };
  } catch (err) {
    console.error(`Failed to fetch live data for ${symbol}:`, err);
    if (existingAsset) {
        return {
            ...existingAsset,
            currency: existingAsset.currency || "USD",
            dataQuality: {
                status: 'stale',
                lastFetchTime: new Date().toISOString(),
                source: 'yahoo-finance',
                warningMessage: 'Failed to fetch new data.'
            }
        };
    }
    return null;
  }
}

// REST Endpoints
app.get("/api/debug", (req, res) => res.json({ msg: "I AM THE NEW SERVER" }));

app.get("/api/state", async (req, res) => {
  const state = loadState();
  console.log(`[API] /state called. Assets count: ${state.assets.length}`);
  
  // Refresh all assets with live market data
  const updatedAssets = [];
  for (const asset of state.assets) {
    console.log(`[API] /state calling fetchLiveAssetData for ${asset.symbol}`);
    const liveAsset = await fetchLiveAssetData(asset.symbol, asset);
    if (liveAsset) {
      updatedAssets.push(liveAsset);
    }
  }
  state.assets = updatedAssets;
  state.lastUpdated = new Date().toISOString();

  // Evaluate Active Alarms against real prices
  state.alerts.forEach(alert => {
    if (!alert.active || alert.triggered) return;
    const asset = state.assets.find(a => a.symbol === alert.symbol);
    if (!asset) return;

    let triggered = false;
    if (alert.type === "price_above" && asset.currentPrice >= alert.threshold) triggered = true;
    else if (alert.type === "price_below" && asset.currentPrice <= alert.threshold) triggered = true;

    if (triggered) {
      alert.triggered = true;
      alert.active = false;
      alert.triggerValue = asset.currentPrice;
      alert.triggerDate = state.lastUpdated;
    }
  });

  // Evaluate Active Forecasts against real historical prices (only if target date is reached)
  const now = new Date();
  for (const forecast of state.forecasts) {
    if (forecast.status === "resolved") continue;
    const asset = state.assets.find(a => a.symbol === forecast.symbol);
    if (!asset) continue;

    const forecastStart = new Date(forecast.date);
    const horizonDaysMap = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const horizonDays = horizonDaysMap[forecast.targetHorizon];
    const evaluationDate = new Date(forecastStart);
    evaluationDate.setDate(evaluationDate.getDate() + horizonDays);

    if (now >= evaluationDate) {
      let targetResult = null;
      try {
        const p1 = new Date(evaluationDate);
        p1.setDate(p1.getDate() - 1); // look slightly back
        const p2 = new Date(evaluationDate);
        p2.setDate(p2.getDate() + 5); // fetch up to 5 days ahead in case of weekend/holidays
        const queryOptions: any = { period1: p1, period2: p2 };
        
        const hist: any[] = await yahooFinance.historical(forecast.symbol, queryOptions);
        
        // Find the first trading day on or after the evaluation date
        const validDates = hist.filter(h => new Date(h.date) >= evaluationDate);
        if (validDates.length > 0) {
           targetResult = validDates[0];
        } else if (hist.length > 0) {
           targetResult = hist[hist.length - 1]; // fallback to latest available
        }
      } catch (e) {
        console.error("Failed to fetch historical data for forecast evaluation", e);
      }

      if (targetResult) {
        let isAdj = true;
        const endPrice = targetResult.adjClose !== null && targetResult.adjClose !== undefined 
          ? targetResult.adjClose 
          : (targetResult.close || 0);

        if ((targetResult.adjClose === null || targetResult.adjClose === undefined) && asset.type !== 'crypto') isAdj = false;

        const actualChangePercent = parseFloat((((endPrice - forecast.startPrice) / forecast.startPrice) * 100).toFixed(2));
        
        let isCorrect = false;
        let conclusion = "";
        if (forecast.direction === "Bullish") {
          isCorrect = actualChangePercent > 1.0;
          conclusion = isCorrect ? `Volltreffer! Der Kurs stieg um ${actualChangePercent.toFixed(2)}%.` : `Fehlprognose. Kursentwicklung: ${actualChangePercent.toFixed(2)}%.`;
        } else if (forecast.direction === "Bearish") {
          isCorrect = actualChangePercent < -1.0;
          conclusion = isCorrect ? `Volltreffer! Der Kurs fiel um ${Math.abs(actualChangePercent).toFixed(2)}%.` : `Fehlprognose. Kursentwicklung: ${actualChangePercent.toFixed(2)}%.`;
        } else {
          isCorrect = Math.abs(actualChangePercent) <= 1.5;
          conclusion = isCorrect ? `Korrekt. Der Markt pendelte seitwärts (${actualChangePercent.toFixed(2)}%).` : `Fehlprognose. Starke Bewegung von ${actualChangePercent.toFixed(2)}%.`;
        }

        forecast.status = "resolved";
        forecast.results = {
          endPrice: parseFloat(endPrice.toFixed(4)),
          actualChangePercent,
          isCorrect,
          drift: parseFloat((actualChangePercent - forecast.expectedChangePercent).toFixed(2)),
          evaluationDate: evaluationDate.toISOString().split("T")[0],
          conclusion,
          actualEvaluationDate: targetResult.date.toISOString().split("T")[0],
          priceFieldUsed: isAdj ? 'adjClose' : 'close'
        };
      }
    }
  }

  const updatedPortfolio = recalculatePortfolio(state.portfolio, state.assets);
  state.portfolio = updatedPortfolio;
  
  saveState(state);
  res.json(state);
});

// Add custom asset to watch list
app.post("/api/watchlist/add", async (req, res) => {
  const { symbol, name, type, volatility, status } = req.body;
  if (!symbol) return res.status(400).json({ error: "Missing symbol." });

  const state = loadState();
  const upperSymbol = symbol.toUpperCase();
  if (state.assets.find(a => a.symbol === upperSymbol)) {
    return res.status(400).json({ error: "Asset bereits in der Watchlist vorhanden." });
  }

  const liveAsset = await fetchLiveAssetData(upperSymbol, { 
    symbol: upperSymbol, 
    name: name || upperSymbol, 
    type, 
    currentPrice: 0, 
    prevClosePrice: 0, 
    price7DaysAgo: 0, 
    price30DaysAgo: 0, 
    dailyChangePercent: 0, 
    change7DaysPercent: 0, 
    change30DaysPercent: 0, 
    volatility: volatility || "medium", 
    status: status || "Neutral", 
    history: [],
    currency: "USD"
  });

  if (!liveAsset) {
    return res.status(400).json({ error: "Marktdaten konnten für dieses Symbol nicht geladen werden." });
  }

  state.assets.push(liveAsset);
  saveState(state);
  res.json(state);
});

app.post("/api/watchlist/remove", (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: "Symbol required." });
  const state = loadState();
  state.assets = state.assets.filter(a => a.symbol !== symbol);
  saveState(state);
  res.json(state);
});

// Executed Paper Trade Order against real live market price
app.post("/api/trade", async (req, res) => {
  const { symbol, type, quantity, reason } = req.body;
  if (!symbol || !type || !quantity || Number(quantity) <= 0 || !["BUY", "SELL"].includes(type)) {
    return res.status(400).json({ error: "Missing or invalid trade parameters." });
  }

  const state = loadState();
  const liveAsset = await fetchLiveAssetData(symbol);
  if (!liveAsset) {
    return res.status(404).json({ error: "Asset not found or market data unavailable." });
  }

  // Update asset in state with freshest price
  const assetIdx = state.assets.findIndex(a => a.symbol === symbol);
  if (assetIdx >= 0) state.assets[assetIdx] = liveAsset;

  const orderQty = Number(quantity);
  const tradePrice = liveAsset.currentPrice;
  
  let fee = 4.90;
  if (liveAsset.type === "crypto") {
    fee = parseFloat((orderQty * tradePrice * 0.001).toFixed(2));
  }

  const totalCost = orderQty * tradePrice;

  if (type === "BUY") {
    const requiredCash = totalCost + fee;
    if (state.portfolio.balance < requiredCash) {
      return res.status(400).json({ error: `Ungenügendes Guthaben. Erforderlich: ${requiredCash.toFixed(2)} €, Verfügbar: ${state.portfolio.balance.toFixed(2)} €` });
    }

    state.portfolio.balance = parseFloat((state.portfolio.balance - requiredCash).toFixed(2));
    const existingPosIdx = state.portfolio.positions.findIndex(p => p.symbol === symbol);
    
    if (existingPosIdx >= 0) {
      const pos = state.portfolio.positions[existingPosIdx];
      const newQty = pos.quantity + orderQty;
      const newTotalCost = (pos.quantity * pos.avgBuyPrice) + totalCost;
      const newAvgBuyPrice = parseFloat((newTotalCost / newQty).toFixed(4));
      
      state.portfolio.positions[existingPosIdx] = {
        ...pos,
        quantity: newQty,
        avgBuyPrice: newAvgBuyPrice,
        currentPrice: tradePrice,
        totalCost: parseFloat(newTotalCost.toFixed(2)),
        currentValue: parseFloat((newQty * tradePrice).toFixed(2)),
        pnlAbsolute: parseFloat(((newQty * tradePrice) - newTotalCost).toFixed(2)),
        pnlPercent: parseFloat(((((newQty * tradePrice) - newTotalCost) / newTotalCost) * 100).toFixed(2))
      };
    } else {
      state.portfolio.positions.push({
        symbol,
        name: liveAsset.name,
        type: liveAsset.type,
        quantity: orderQty,
        avgBuyPrice: tradePrice,
        currentPrice: tradePrice,
        totalCost: parseFloat(totalCost.toFixed(2)),
        currentValue: parseFloat(totalCost.toFixed(2)),
        pnlAbsolute: 0,
        pnlPercent: 0
      });
    }
  } else {
    const existingPosIdx = state.portfolio.positions.findIndex(p => p.symbol === symbol);
    if (existingPosIdx < 0 || state.portfolio.positions[existingPosIdx].quantity < orderQty) {
      return res.status(400).json({ error: "Nicht genügend Anteile im Besitz für diesen Verkauf." });
    }

    const pos = state.portfolio.positions[existingPosIdx];
    const saleRevenue = totalCost - fee;

    state.portfolio.balance = parseFloat((state.portfolio.balance + saleRevenue).toFixed(2));
    const remainingQty = pos.quantity - orderQty;
    
    if (remainingQty === 0) {
      state.portfolio.positions.splice(existingPosIdx, 1);
    } else {
      const newTotalCost = remainingQty * pos.avgBuyPrice;
      const newCurrentValue = remainingQty * tradePrice;
      state.portfolio.positions[existingPosIdx] = {
        ...pos,
        quantity: remainingQty,
        totalCost: parseFloat(newTotalCost.toFixed(2)),
        currentValue: parseFloat(newCurrentValue.toFixed(2)),
        pnlAbsolute: parseFloat((newCurrentValue - newTotalCost).toFixed(2)),
        pnlPercent: parseFloat((((newCurrentValue - newTotalCost) / newTotalCost) * 100).toFixed(2))
      };
    }
  }

  const newTradeLog: TradeLog = {
    id: `trade-${Date.now()}`,
    date: new Date().toISOString(),
    symbol,
    assetName: liveAsset.name,
    type,
    quantity: orderQty,
    price: tradePrice,
    fee,
    reason: reason || "Manuelle Orderplatzierung",
  };
  state.trades.unshift(newTradeLog);
  state.portfolio = recalculatePortfolio(state.portfolio, state.assets);
  saveState(state);
  res.json(state);
});

// Get analysis context and generated prompt for manual KI agent execution
app.get("/api/analysis-context/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const horizon = (req.query.horizon as string) || "30d";

  if (!symbol) {
    return res.status(400).json({ error: "Symbol is required." });
  }

  const upperSymbol = symbol.toUpperCase();
  const state = loadState();
  const asset = await fetchLiveAssetData(upperSymbol);

  if (!asset) {
    return res.status(404).json({ error: "Real market data unavailable for this asset." });
  }

  // Sync asset to state
  const assetIdx = state.assets.findIndex(a => a.symbol === upperSymbol);
  if (assetIdx >= 0) {
    state.assets[assetIdx] = asset;
  }

  // Fetch real news and quote
  let realNews = "";
  let newsList: any[] = [];
  let quote: any = {};
  let fullHistory: any[] = [];

  try {
    const searchRes: any = await yahooFinance.search(upperSymbol);
    if (searchRes.news && searchRes.news.length > 0) {
      newsList = searchRes.news.slice(0, 5).map((n: any) => ({
        title: n.title,
        publisher: n.publisher,
        timestamp: new Date(n.providerPublishTime).toISOString(),
      }));
      realNews = searchRes.news.slice(0, 3).map((n: any) => `- ${n.title} (Publisher: ${n.publisher} - Timestamp: ${new Date(n.providerPublishTime).toISOString()})`).join("\n");
      
      // Also add this real news to the global feed
      searchRes.news.slice(0, 3).forEach((n: any) => {
        if (!state.news.find(sn => sn.id === n.uuid)) {
          state.news.unshift({
            id: n.uuid,
            date: new Date(n.providerPublishTime).toISOString(),
            symbol: upperSymbol,
            assetName: asset.name,
            title: n.title,
            summary: `Publisher: ${n.publisher}`,
            sentiment: "neutral",
            impactPercent: 0
          });
        }
      });
    } else {
      realNews = "Keine aktuellen Nachrichten gefunden.";
    }

    quote = await yahooFinance.quote(upperSymbol);
    
    const p1 = new Date();
    p1.setDate(p1.getDate() - 300);
    const p2 = new Date();
    fullHistory = await yahooFinance.historical(upperSymbol, { period1: p1, period2: p2 } as any);

  } catch (e) {
    realNews = "Nachrichtenabruf fehlgeschlagen.";
  }

  const historicalPrices = fullHistory.map(r => r.adjClose !== null && r.adjClose !== undefined ? r.adjClose : (r.close || 0));
  
  const sma20 = calculateSMA(historicalPrices, 20);
  const sma50 = calculateSMA(historicalPrices, 50);
  const sma200 = calculateSMA(historicalPrices, 200);
  const rsi14 = calculateRSI(historicalPrices, 14);

  const marketCap = quote?.marketCap || "unknown";
  const peRatio = quote?.trailingPE || "unknown";
  const forwardPE = quote?.forwardPE || "unknown";
  const divYield = quote?.trailingAnnualDividendYield ? (quote.trailingAnnualDividendYield * 100).toFixed(2) + "%" : "unknown";
  const earningsDate = quote?.earningsTimestamp ? new Date(quote.earningsTimestamp).toISOString().split("T")[0] : "unknown";
  const volume = quote?.regularMarketVolume || "unknown";
  const avgVolume = quote?.averageDailyVolume10Day || "unknown";

  const recentPrices = asset.history.slice(-7).map(h => `${h.date}: ${h.price.toFixed(2)}`).join(", ");
  const price30 = fullHistory.length > 30 ? (fullHistory[fullHistory.length - 31].adjClose || fullHistory[fullHistory.length - 31].close).toFixed(2) : "unknown";
  const price90 = fullHistory.length > 90 ? (fullHistory[fullHistory.length - 91].adjClose || fullHistory[fullHistory.length - 91].close).toFixed(2) : "unknown";

  const systemPrompt = `Du bist ein professioneller Finanzanalyst für ein Finanz-NOC (Network Operations Center).
Deine Aufgabe ist es, eine präzise, messbare und ehrliche KI-gestützte Einschätzung für ein Asset basierend auf ECHTEN Marktdaten und ECHTEN Nachrichten abzugeben.
Erfinde KEINE Nachrichten. Erfinde KEINE Kennzahlen (Wenn ein Wert "unknown" oder null ist, schreibe, dass er nicht verfügbar ist).
Spreche Deutsch. Vermeide Allgemeinplätze und formuliere konkrete Argumente (Bull Case, Bear Case, technische & fundamentale Lage).`;

  const userPrompt = `Analysiere folgendes Finanzinstrument:
Name: ${asset.name} (${asset.symbol})
Asset-Klasse: ${asset.type}

PREIS & ENTWICKLUNG:
Aktueller Preis: ${asset.currentPrice} ${asset.currency}
Tagesänderung: ${asset.dailyChangePercent}%
7-Tage-Entwicklung: ${asset.change7DaysPercent}%
Preis vor 30 Tagen: ${price30} (Entwicklung: ${asset.change30DaysPercent}%)
Preis vor 90 Tagen: ${price90}
Preise der letzten 7 Tage: [${recentPrices}]

TECHNISCHE INDIKATOREN:
RSI (14): ${rsi14 !== null ? rsi14.toFixed(2) : "unknown"}
SMA (20): ${sma20 !== null ? sma20.toFixed(2) : "unknown"}
SMA (50): ${sma50 !== null ? sma50.toFixed(2) : "unknown"}
SMA (200): ${sma200 !== null ? sma200.toFixed(2) : "unknown"}
Volumen aktuell: ${volume}
Volumen Ø (10 Tage): ${avgVolume}

FUNDAMENTALDATEN (sofern verfügbar):
Marktkapitalisierung: ${marketCap}
KGV (Trailing P/E): ${peRatio}
KGV (Forward P/E): ${forwardPE}
Dividendenrendite: ${divYield}
Nächster Earnings-Termin: ${earningsDate}

AKTUELLE NACHRICHTEN:
${realNews}

Zeithorizont der Analyse: ${horizon}

Leite daraus einen objektiven Consensus-Score (0-100, wobei >70 Kaufen, <35 Verkaufen, 35-50 Beobachten, 50-70 Halten entspricht) und eine glasklare Empfehlung ab. Berücksichtige die Unsicherheit bei fehlenden Werten (unknown).`;

  const generatedPrompt = `${systemPrompt}\n\n${userPrompt}\n\n### ANWEISUNG FÜR DIE ANTWORT:\nAntworte ausschließlich mit einem validen JSON-Objekt. Kein Markdown (keine \`\`\`json Blöcke). Keine Kommentare. Kein Text davor oder danach.\n\n### REGELN:\n1. Verwende für recommendation nur einen dieser Werte: BUY, HOLD, SELL, WATCH.\n2. Verwende für expectedDirection nur einen dieser Werte: Bullish, Bearish, Neutral.\n3. score und confidence müssen Zahlen von 0 bis 100 sein.\n4. expectedReturnPercent muss eine Zahl sein.\n5. targetPriceOptional muss eine Zahl oder null sein.\n\n### BESCHREIBUNG DER JSON-FELDER:\n- recommendation: Empfehlungstyp (BUY, HOLD, SELL oder WATCH)\n- score: Gesamtbewertung (0 bis 100)\n- confidence: Konfidenzniveau (0 bis 100)\n- horizon: Zeithorizont der Analyse (z.B. "${horizon}")\n- bullCase: Optimistische Argumente (Deutsch)\n- bearCase: Pessimistische Argumente (Deutsch)\n- technicalSummary: Technische Kurzeinschätzung (Deutsch)\n- fundamentalSummary: Fundamentale Kurzeinschätzung (Deutsch)\n- riskSummary: Zusammenfassung der Risiken (Deutsch)\n- expectedDirection: Erwartete Kursrichtung (Bullish, Bearish oder Neutral)\n- expectedReturnPercent: Erwartete Rendite in Prozent als Zahl\n- targetPriceOptional: Optionaler Zielkurs als Zahl oder null\n- keyRisks: Array der Hauptrisiken (Strings, Deutsch)\n- sourcesUsed: Array der genutzten Quellen (Strings)\n- modelName: Name deines verwendeten KI-Modells\n\n### BEISPIEL FÜR EIN VALIDES ANTWORT-FORMAT:\n{\n  "recommendation": "BUY",\n  "score": 85,\n  "confidence": 90,\n  "horizon": "${horizon}",\n  "bullCase": "Starke Chip-Nachfrage und exzellente Marktstellung.",\n  "bearCase": "Zunehmender Wettbewerb und Exportbeschränkungen.",\n  "technicalSummary": "RSI ist neutral, SMA 200 bietet stabile Unterstützung.",\n  "fundamentalSummary": "Hohes KGV, aber gerechtfertigt durch starkes Wachstum.",\n  "riskSummary": "Abhängigkeit von Lieferketten und geopolitischen Faktoren.",\n  "expectedDirection": "Bullish",\n  "expectedReturnPercent": 15.0,\n  "targetPriceOptional": 160.0,\n  "keyRisks": [\n    "Lieferkettenrisiken",\n    "Geopolitische Konflikte"\n  ],\n  "sourcesUsed": [\n    "Yahoo Finance Market Data",\n    "Finanznachrichten"\n  ],\n  "modelName": "Claude-3.5-Sonnet"\n}`;

  const expectedResultSchema = {
    type: "object",
    properties: {
      recommendation: { type: "string", enum: ["BUY", "HOLD", "SELL", "WATCH"] },
      score: { type: "number", minimum: 0, maximum: 100 },
      confidence: { type: "number", minimum: 0, maximum: 100 },
      horizon: { type: "string" },
      bullCase: { type: "string" },
      bearCase: { type: "string" },
      technicalSummary: { type: "string" },
      fundamentalSummary: { type: "string" },
      riskSummary: { type: "string" },
      expectedDirection: { type: "string", enum: ["Bullish", "Bearish", "Neutral"] },
      expectedReturnPercent: { type: "number" },
      targetPriceOptional: { type: "number", nullable: true },
      keyRisks: { type: "array", items: { type: "string" } },
      sourcesUsed: { type: "array", items: { type: "string" } },
      modelName: { type: "string" }
    },
    required: [
      "recommendation", "score", "confidence", "horizon", "bullCase", "bearCase",
      "technicalSummary", "fundamentalSummary", "riskSummary", "expectedDirection",
      "expectedReturnPercent", "keyRisks", "sourcesUsed", "modelName"
    ]
  };

  const structuredContext = {
    symbol: upperSymbol,
    name: asset.name,
    assetType: asset.type,
    currency: asset.currency,
    currentPrice: asset.currentPrice,
    dailyChangePercent: asset.dailyChangePercent,
    change7DaysPercent: asset.change7DaysPercent,
    change30DaysPercent: asset.change30DaysPercent,
    price30,
    price90,
    recentPrices,
    rsi14,
    sma20,
    sma50,
    sma200,
    volume,
    avgVolume,
    marketCap,
    peRatio,
    forwardPE,
    divYield,
    earningsDate,
    newsHeadlines: newsList
  };

  saveState(state);

  res.json({
    structuredContext,
    generatedPrompt,
    expectedResultSchema
  });
});

// Import manual analysis output
app.post("/api/analysis/import", async (req, res) => {
  const { symbol, pastedResult, horizon } = req.body;
  if (!symbol || !pastedResult || !horizon) {
    return res.status(400).json({ error: "Symbol, Pasted Result, und Horizon sind erforderlich." });
  }

  const state = loadState();
  const asset = state.assets.find(a => a.symbol === symbol.toUpperCase()) || await fetchLiveAssetData(symbol);
  if (!asset) {
    return res.status(404).json({ error: "Wertpapier wurde nicht im System gefunden." });
  }

  let data: any;
  try {
    data = JSON.parse(pastedResult.trim());
  } catch (e) {
    return res.status(400).json({ error: "Fehler beim Parsen des JSON-Inhalts. Bitte stelle sicher, dass es sich um ein gültiges JSON-Format handelt." });
  }

  // Validate fields
  const missingFields: string[] = [];
  const requiredFields = [
    "recommendation", "score", "confidence", "horizon", "bullCase", "bearCase",
    "technicalSummary", "fundamentalSummary", "riskSummary", "expectedDirection",
    "expectedReturnPercent", "keyRisks", "sourcesUsed", "modelName"
  ];

  requiredFields.forEach(field => {
    if (data[field] === undefined || data[field] === null) {
      missingFields.push(field);
    }
  });

  if (missingFields.length > 0) {
    return res.status(400).json({ 
      error: `Das JSON-Objekt ist unvollständig. Fehlende Pflichtfelder: ${missingFields.join(", ")}` 
    });
  }

  // Typ- und Werte-Validierung
  if (typeof data.score !== "number" || data.score < 0 || data.score > 100) {
    return res.status(400).json({ error: "Das Feld 'score' muss eine Zahl zwischen 0 und 100 sein." });
  }
  if (typeof data.confidence !== "number" || data.confidence < 0 || data.confidence > 100) {
    return res.status(400).json({ error: "Das Feld 'confidence' muss eine Zahl zwischen 0 und 100 sein." });
  }
  if (typeof data.expectedReturnPercent !== "number") {
    return res.status(400).json({ error: "Das Feld 'expectedReturnPercent' muss eine Zahl sein." });
  }
  if (!Array.isArray(data.keyRisks)) {
    return res.status(400).json({ error: "Das Feld 'keyRisks' muss ein Array von Strings sein." });
  }
  if (!Array.isArray(data.sourcesUsed)) {
    return res.status(400).json({ error: "Das Feld 'sourcesUsed' muss ein Array von Strings sein." });
  }

  const validRecommendations = ["BUY", "HOLD", "SELL", "WATCH"];
  const recommendationUpper = String(data.recommendation).toUpperCase();
  if (!validRecommendations.includes(recommendationUpper)) {
    return res.status(400).json({ 
      error: `Ungültiger Empfehlungs-Typ '${data.recommendation}'. Erlaubte Werte: BUY, HOLD, SELL, WATCH` 
    });
  }

  const validDirections = ["Bullish", "Bearish", "Neutral"];
  if (!validDirections.includes(data.expectedDirection)) {
    return res.status(400).json({ 
      error: `Ungültige erwartete Richtung '${data.expectedDirection}'. Erlaubte Werte: Bullish, Bearish, Neutral` 
    });
  }

  // Map recommendation to German equivalents
  let recGerman: RecommendationType = "Halten";
  if (recommendationUpper === "BUY") recGerman = "Kaufen";
  else if (recommendationUpper === "SELL") recGerman = "Verkaufen";
  else if (recommendationUpper === "WATCH") recGerman = "Beobachten";

  // Build AiAnalysis object
  const newAnalysis: AiAnalysis = {
    id: `ai-an-${Date.now()}`,
    symbol: asset.symbol,
    assetName: asset.name,
    date: new Date().toISOString(),
    score: data.score,
    recommendation: recGerman,
    summary: `Modell: ${data.modelName}. Konfidenz: ${data.confidence}%. Richtung: ${data.expectedDirection} (${data.expectedReturnPercent}%). Risiko-Zusammenfassung: ${data.riskSummary}`,
    bullCase: data.bullCase,
    bearCase: data.bearCase,
    technicalAnalysis: data.technicalSummary,
    fundamentalAnalysis: data.fundamentalSummary,
    newsSentiment: data.riskSummary,
    riskRating: "medium", // Default
    horizon: data.horizon || horizon,
    modelsScores: {
      gemini: recommendationUpper === "BUY" ? data.score : 0,
      gpt: recommendationUpper === "BUY" ? data.score : 0,
      claude: recommendationUpper === "BUY" ? data.score : 0,
      technical: data.score
    },
    expectedReturnPercent: Number(data.expectedReturnPercent),
    expectedDirection: data.expectedDirection,
    targetPriceOptional: data.targetPriceOptional !== undefined ? data.targetPriceOptional : null,
    modelName: data.modelName
  };

  state.analyses.unshift(newAnalysis);
  saveState(state);

  res.json({ analysis: newAnalysis, state });
});

app.post("/api/alerts/create", (req, res) => {
  const { symbol, type, threshold } = req.body;
  if (!symbol || !type || threshold === undefined) return res.status(400).json({ error: "Missing alert fields." });
  const state = loadState();
  const asset = state.assets.find(a => a.symbol === symbol);
  state.alerts.unshift({
    id: `alert-${Date.now()}`,
    symbol,
    assetName: asset?.name || symbol,
    type,
    threshold: Number(threshold),
    dateAdded: new Date().toISOString(),
    active: true,
    triggered: false
  });
  saveState(state);
  res.json(state);
});

app.post("/api/alerts/delete", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing alert ID." });
  const state = loadState();
  state.alerts = state.alerts.filter(a => a.id !== id);
  saveState(state);
  res.json(state);
});

app.post("/api/portfolio/reset", (req, res) => {
  const state = loadState();
  state.portfolio = {
    balance: 10000.00,
    startBalance: 10000.00,
    totalValue: 10000.00,
    positions: [],
    pnlAbsolute: 0,
    pnlPercent: 0
  };
  state.trades = [];
  saveState(state);
  res.json(state);
});

app.post("/api/forecast/create", (req, res) => {
  const { symbol, targetHorizon, direction, expectedChangePercent } = req.body;
  if (!symbol || !targetHorizon || !direction || expectedChangePercent === undefined) {
    return res.status(400).json({ error: "Missing parameters for forecast." });
  }
  const state = loadState();
  const asset = state.assets.find(a => a.symbol === symbol);

  const todayStr = new Date().toISOString().substring(0, 10);
  const isDuplicate = state.forecasts.some(f => 
    f.status === "active" &&
    f.symbol === symbol &&
    !f.analysisId &&
    f.targetHorizon === targetHorizon &&
    f.expectedChangePercent === Number(expectedChangePercent) &&
    f.date.substring(0, 10) === todayStr
  );
  if (isDuplicate) {
    return res.status(400).json({ error: "Diese Prognose wurde bereits gespeichert." });
  }

  state.forecasts.unshift({
    id: `forecast-${Date.now()}`,
    symbol,
    assetName: asset?.name || symbol,
    date: new Date().toISOString(),
    targetHorizon,
    direction,
    startPrice: asset?.currentPrice || 0,
    expectedChangePercent: Number(expectedChangePercent),
    score: direction === "Bullish" ? 75 : direction === "Bearish" ? 35 : 50,
    status: "active"
  });
  saveState(state);
  res.json(state);
});

app.post("/api/forecast/submit-from-analysis", (req, res) => {
  const { analysisId, expectedChangePercent } = req.body;
  if (!analysisId) return res.status(400).json({ error: "Analysis ID is required." });

  const state = loadState();
  const analysis = state.analyses.find(a => a.id === analysisId);
  if (!analysis) return res.status(404).json({ error: "Analysis not found." });

  const asset = state.assets.find(a => a.symbol === analysis.symbol);

  // Use imported expectedDirection if available, fallback to mapping recommendation
  let direction: "Bullish" | "Neutral" | "Bearish" = "Neutral";
  if (analysis.expectedDirection) {
    direction = analysis.expectedDirection;
  } else {
    if (analysis.recommendation === "Kaufen") direction = "Bullish";
    if (analysis.recommendation === "Verkaufen") direction = "Bearish";
  }

  // Use explicit expectedChangePercent if supplied, fallback to imported expectedReturnPercent, fallback to recommendation mapping
  let changePct = expectedChangePercent !== undefined ? Number(expectedChangePercent) : undefined;
  if (changePct === undefined) {
    if (analysis.expectedReturnPercent !== undefined) {
      changePct = Number(analysis.expectedReturnPercent);
    } else {
      changePct = direction === "Bullish" ? 8.5 : direction === "Bearish" ? -8.5 : 0.0;
    }
  }

  // Check for duplicate active forecast
  const todayStr = new Date().toISOString().substring(0, 10);
  const isDuplicate = state.forecasts.some(f => 
    f.status === "active" &&
    f.symbol === analysis.symbol &&
    f.analysisId === analysisId &&
    f.targetHorizon === analysis.horizon &&
    f.expectedChangePercent === changePct &&
    f.date.substring(0, 10) === todayStr
  );
  if (isDuplicate) {
    return res.status(400).json({ error: "Diese Prognose wurde bereits gespeichert." });
  }

  state.forecasts.unshift({
    id: `forecast-${Date.now()}`,
    symbol: analysis.symbol,
    assetName: analysis.assetName,
    date: new Date().toISOString(),
    targetHorizon: analysis.horizon,
    direction,
    startPrice: asset?.currentPrice || 0,
    expectedChangePercent: changePct,
    score: analysis.score,
    status: "active",
    targetPriceOptional: analysis.targetPriceOptional !== undefined ? analysis.targetPriceOptional : null,
    modelName: analysis.modelName,
    analysisId: analysis.id
  });
  saveState(state);
  res.json(state);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MarketOps AI backend running on port ${PORT}`);
  });
}
startServer();
