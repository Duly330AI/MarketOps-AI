export type AssetType = 'stock' | 'etf' | 'crypto';
export type VolatilityRating = 'low' | 'medium' | 'high' | 'extreme';
export type RecommendationType = 'Beobachten' | 'Kaufen' | 'Halten' | 'Verkaufen';
export type ForecastStatus = 'active' | 'resolved';
export type AlertType = 'price_above' | 'price_below' | 'volatility_high' | 'ai_score_above' | 'sentiment_negative';

export interface PriceHistoryPoint {
  date: string; // YYYY-MM-DD
  price: number;
  isAdj?: boolean;
}

export interface AssetDataQuality {
  status: 'ok' | 'delayed' | 'stale' | 'market_closed' | 'unavailable';
  lastMarketTime?: string;
  lastFetchTime: string;
  source: 'yahoo-finance';
  warningMessage?: string;
}

export interface Asset {
  symbol: string;
  name: string;
  type: AssetType;
  currentPrice: number;
  prevClosePrice: number;
  price7DaysAgo: number;
  price30DaysAgo: number;
  dailyChangePercent: number;
  change7DaysPercent: number;
  change30DaysPercent: number;
  volatility: VolatilityRating;
  status: 'Bullish' | 'Neutral' | 'Bearish';
  history: PriceHistoryPoint[];
  dataQuality?: AssetDataQuality;
  currency: string;
}

export interface Position {
  symbol: string;
  name: string;
  type: AssetType;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  pnlAbsolute: number;
  pnlPercent: number;
}

export interface PaperPortfolio {
  balance: number; // Cash in €
  startBalance: number; // Default 10.000 €
  totalValue: number; // Cash + positions value
  positions: Position[];
  pnlAbsolute: number;
  pnlPercent: number;
}

export interface TradeLog {
  id: string;
  date: string; // YYYY-MM-DD
  symbol: string;
  assetName: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  reason: string;
  aiAnalysisId?: string;
  expectedScenario?: string;
}

export interface ModelScores {
  gpt: number;
  claude: number;
  gemini: number;
  technical: number;
}

export interface AiAnalysis {
  id: string;
  symbol: string;
  assetName: string;
  date: string; // YYYY-MM-DD
  score: number; // 0-100 consensus score
  recommendation: RecommendationType;
  summary: string;
  bullCase: string;
  bearCase: string;
  technicalAnalysis: string;
  fundamentalAnalysis: string;
  newsSentiment: string;
  riskRating: VolatilityRating;
  horizon: '1d' | '7d' | '30d' | '90d';
  modelsScores: ModelScores;
}

export interface ForecastResult {
  endPrice: number;
  actualChangePercent: number;
  isCorrect: boolean;
  drift: number; // Difference between expected change and actual change
  evaluationDate: string;
  conclusion: string;
  priceFieldUsed?: 'adjClose' | 'close';
  actualEvaluationDate?: string;
}

export interface Forecast {
  id: string;
  symbol: string;
  assetName: string;
  date: string; // YYYY-MM-DD
  targetHorizon: '1d' | '7d' | '30d' | '90d';
  direction: 'Bullish' | 'Neutral' | 'Bearish';
  startPrice: number;
  expectedChangePercent: number;
  score: number;
  status: ForecastStatus;
  results?: ForecastResult;
}

export interface Alert {
  id: string;
  symbol: string;
  assetName: string;
  type: AlertType;
  threshold: number;
  triggerValue?: number;
  dateAdded: string;
  active: boolean;
  triggered: boolean;
  triggerDate?: string;
}

export interface NewsItem {
  id: string;
  date: string;
  symbol: string;
  assetName: string;
  title: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  impactPercent: number; // Simulated price impact from -5 to +5
}

export interface SystemState {
  lastUpdated: string; // ISO String
  assets: Asset[];
  portfolio: PaperPortfolio;
  trades: TradeLog[];
  analyses: AiAnalysis[];
  forecasts: Forecast[];
  alerts: Alert[];
  news: NewsItem[];
}

export function getCurrencySign(currency?: string): string {
  const cur = (currency || "USD").toUpperCase();
  if (cur === "USD") return "$";
  if (cur === "EUR") return "€";
  if (cur === "GBP") return "£";
  return cur;
}

export function formatAssetPrice(price: number, currency?: string): string {
  const sign = getCurrencySign(currency);
  const formatted = price.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (sign === "$" || sign === "£") {
    return `${sign}${formatted}`;
  }
  return `${formatted} ${sign}`;
}
