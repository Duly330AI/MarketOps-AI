import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();
dotenv.config();

import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');
function loadState() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

async function fetchLiveAssetData(symbol: string, existingAsset?: any): Promise<any> {
  try {
    const quote: any = await yahooFinance.quote(symbol);
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
    
    // FETCH HISTORICAL
    const period1 = new Date();
    period1.setDate(period1.getDate() - 300);
    const period2 = new Date();
    const queryOptions: any = { period1, period2 };
    let result = [];
    try {
       result = await yahooFinance.historical(symbol, queryOptions);
    } catch (e) {
       console.error("Historical data fetch failed:", e);
    }
    
    let isAdj = true;
    const history = result.map(r => {
      const price = r.adjClose !== null && r.adjClose !== undefined ? r.adjClose : (r.close || currentPrice);
      if (r.adjClose === null || r.adjClose === undefined) isAdj = false;
      return {
        date: r.date.toISOString().split("T")[0],
        price,
        isAdj
      };
    });

    const history30 = history.slice(-30);
    const price7DaysAgo = history30.length > 7 ? history30[history30.length - 8].price : (history30[0]?.price || currentPrice);

    return {
      symbol: symbol.toUpperCase(),
      currentPrice,
      price7DaysAgo
    };
  } catch (err) {
    console.error(`Failed to fetch live data for ${symbol}:`, err);
    return null;
  }
}

async function run() {
  const state = loadState();
  for (const asset of state.assets) {
    console.log(`Calling for ${asset.symbol}`);
    const liveAsset = await fetchLiveAssetData(asset.symbol, asset);
    console.log("Returned:", liveAsset);
    break; // just check one
  }
}
run();
