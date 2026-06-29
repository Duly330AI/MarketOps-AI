import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();
dotenv.config();

// just copy the fetchLiveAssetData function and run it
import fs from "fs";
import path from "path";

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

async function fetchLiveAssetData(symbol: string, existingAsset?: any): Promise<any> {
  console.log(`Fetching live data for ${symbol}...`);
  try {
    const quote: any = await yahooFinance.quote(symbol);
    console.log(`Quote for ${symbol}: price = ${quote?.regularMarketPrice}`);
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
    return { symbol, currentPrice: quote.regularMarketPrice, dataQuality: { status: 'ok' } };
  } catch(e) {
    console.log("Error:", e);
    return existingAsset;
  }
}

async function run() {
  const r = await fetchLiveAssetData('NVDA', db.assets[0]);
  console.log(r);
}
run();
