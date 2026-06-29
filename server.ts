import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import yahooFinance from "yahoo-finance2";

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
  PriceHistoryPoint
} from "./src/types";

const app = express();
app.use(express.json());

const PORT = 3000;
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
  if (fs.existsSync(DB_PATH)) {
    try {
      const data = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed.assets && parsed.portfolio) {
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
  try {
    const quote = await yahooFinance.quote(symbol);
    if (!quote || !quote.regularMarketPrice) {
      if (existingAsset) {
        return {
          ...existingAsset,
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
    const queryOptions = { period1 };
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
      dataQuality: {
        status,
        lastMarketTime: quote.regularMarketTime?.toISOString() || new Date().toISOString(),
        lastFetchTime: new Date().toISOString(),
        source: 'yahoo-finance',
        warningMessage: (!isAdj && assetType !== 'crypto') ? 'unadjusted_fallback' : undefined
      }
    };
  } catch (err) {
    console.error(`Failed to fetch live data for ${symbol}:`, err);
    if (existingAsset) {
        return {
            ...existingAsset,
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
app.get("/api/state", async (req, res) => {
  const state = loadState();
  
  // Refresh all assets with live market data
  const updatedAssets = [];
  for (const asset of state.assets) {
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
        const queryOptions = { period1: p1, period2: p2 };
        
        const hist = await yahooFinance.historical(forecast.symbol, queryOptions);
        
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

  const liveAsset = await fetchLiveAssetData(upperSymbol, { symbol: upperSymbol, name: name || upperSymbol, type, currentPrice: 0, prevClosePrice: 0, price7DaysAgo: 0, price30DaysAgo: 0, dailyChangePercent: 0, change7DaysPercent: 0, change30DaysPercent: 0, volatility: volatility || "medium", status: status || "Neutral", history: [] });

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

// Analyze using real news and real history
app.post("/api/analyze", async (req, res) => {
  const { symbol, horizon } = req.body;
  if (!symbol || !horizon) {
    return res.status(400).json({ error: "Symbol and Horizon are required." });
  }

  const state = loadState();
  const asset = await fetchLiveAssetData(symbol);
  
  if (!asset) {
    return res.status(404).json({ error: "Real market data unavailable for this asset." });
  }

  const assetIdx = state.assets.findIndex(a => a.symbol === symbol);
  if (assetIdx >= 0) state.assets[assetIdx] = asset;

  // Fetch real news and quote
  let realNews = "";
  let quote: any = {};
  let fullHistory: any[] = [];
  try {
    const searchRes = await yahooFinance.search(symbol);
    if (searchRes.news && searchRes.news.length > 0) {
      realNews = searchRes.news.slice(0, 3).map(n => `- ${n.title} (Publisher: ${n.publisher} - Timestamp: ${new Date(n.providerPublishTime).toISOString()})`).join("\n");
      
      // Also add this real news to the global feed
      searchRes.news.slice(0, 3).forEach(n => {
        if (!state.news.find(sn => sn.id === n.uuid)) {
          state.news.unshift({
            id: n.uuid,
            date: new Date(n.providerPublishTime).toISOString(),
            symbol,
            assetName: asset.name,
            title: n.title,
            summary: `Publisher: ${n.publisher}`,
            sentiment: "neutral", // Can't easily determine sentiment without AI, default to neutral
            impactPercent: 0
          });
        }
      });
    } else {
      realNews = "Keine aktuellen Nachrichten gefunden.";
    }

    quote = await yahooFinance.quote(symbol);
    
    const p1 = new Date();
    p1.setDate(p1.getDate() - 300);
    fullHistory = await yahooFinance.historical(symbol, { period1: p1 });

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
Gib Deine Antwort STRENG im JSON-Format gemäß des vorgegebenen Schemas aus.
Spreche Deutsch. Vermeide Allgemeinplätze und formuliere konkrete Argumente (Bull Case, Bear Case, technische & fundamentale Lage).`;

  const userPrompt = `Analysiere folgendes Finanzinstrument:
Name: ${asset.name} (${asset.symbol})
Asset-Klasse: ${asset.type}

PREIS & ENTWICKLUNG:
Aktueller Preis: ${asset.currentPrice} 
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

  const client = getGeminiClient();

  if (!client) {
    return res.status(500).json({ error: "Gemini API Key ist nicht konfiguriert." });
  }

  try {
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendation: { type: Type.STRING, description: "'Beobachten', 'Kaufen', 'Halten', 'Verkaufen'" },
            score: { type: Type.INTEGER, description: "Konsens-Analysescore 0-100" },
            summary: { type: Type.STRING },
            bullCase: { type: Type.STRING },
            bearCase: { type: Type.STRING },
            technicalAnalysis: { type: Type.STRING },
            fundamentalAnalysis: { type: Type.STRING },
            newsSentiment: { type: Type.STRING },
            riskRating: { type: Type.STRING },
            modelsScores: {
              type: Type.OBJECT,
              properties: {
                gemini: { type: Type.INTEGER },
                gpt: { type: Type.INTEGER },
                claude: { type: Type.INTEGER },
                technical: { type: Type.INTEGER }
              },
              required: ["gemini", "gpt", "claude", "technical"]
            }
          },
          required: [
            "recommendation", "score", "summary", "bullCase", "bearCase", 
            "technicalAnalysis", "fundamentalAnalysis", "newsSentiment", 
            "riskRating", "modelsScores"
          ]
        }
      }
    });

    const parsedAnalysis = JSON.parse(response.text || "{}");
    
    const newAnalysis: AiAnalysis = {
      id: `ai-an-${Date.now()}`,
      symbol,
      assetName: asset.name,
      date: new Date().toISOString(),
      score: parsedAnalysis.score || 50,
      recommendation: parsedAnalysis.recommendation || "Halten",
      summary: parsedAnalysis.summary || "Keine Zusammenfassung verfügbar.",
      bullCase: parsedAnalysis.bullCase || "Keine Bull-Case Details.",
      bearCase: parsedAnalysis.bearCase || "Keine Bear-Case Details.",
      technicalAnalysis: parsedAnalysis.technicalAnalysis || "Keine technische Analyse.",
      fundamentalAnalysis: parsedAnalysis.fundamentalAnalysis || "Keine fundamentale Analyse.",
      newsSentiment: parsedAnalysis.newsSentiment || "Neutrales Sentiment.",
      riskRating: parsedAnalysis.riskRating || "medium",
      horizon,
      modelsScores: parsedAnalysis.modelsScores
    };

    state.analyses.unshift(newAnalysis);
    saveState(state);
    return res.json({ analysis: newAnalysis, mode: "real_gemini" });

  } catch (err) {
    console.error("Gemini failed", err);
    return res.status(500).json({ error: "KI Analyse fehlgeschlagen." });
  }
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
  let direction: "Bullish" | "Neutral" | "Bearish" = "Neutral";
  if (analysis.recommendation === "Kaufen") direction = "Bullish";
  if (analysis.recommendation === "Verkaufen") direction = "Bearish";

  const changePct = expectedChangePercent !== undefined 
    ? Number(expectedChangePercent) 
    : (direction === "Bullish" ? 8.5 : direction === "Bearish" ? -8.5 : 0.0);

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
    status: "active"
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
