import { SystemState, Asset, PriceHistoryPoint } from "./types";

const snapshotDates = Array.from(
  { length: 30 },
  (_, index) => `2024-01-${String(index + 1).padStart(2, "0")}`
);

const baseMoves = [
  0.012, -0.004, 0.009, 0.006, -0.008, 0.014, 0.003, -0.006, 0.011, 0.005,
  -0.003, 0.008, -0.01, 0.015, 0.004, -0.005, 0.007, 0.012, -0.006, 0.009,
  0.003, -0.004, 0.01, 0.006, -0.002, 0.008, 0.004, -0.003, 0.007
];

const scaledMoves = (scale: number, bias = 0): number[] =>
  baseMoves.map((move) => Number((move * scale + bias).toFixed(5)));

const generateHistory = (startPrice: number, moves: number[]): PriceHistoryPoint[] => {
  let currentPrice = Number(startPrice.toFixed(2));
  const history: PriceHistoryPoint[] = [];

  snapshotDates.forEach((date, index) => {
    history.push({
      date,
      price: Number(currentPrice.toFixed(2))
    });

    const move = moves[index] ?? 0;
    currentPrice = Number((currentPrice * (1 + move)).toFixed(2));
  });

  return history;
};

const nvdaHistory = generateHistory(450, scaledMoves(1.9, 0.001));
const msftHistory = generateHistory(350, scaledMoves(0.9, 0.0004));
const amdHistory = generateHistory(130, scaledMoves(2.1, -0.0002));
const aaplHistory = generateHistory(180, scaledMoves(0.7, 0.0001));
const spyHistory = generateHistory(470, scaledMoves(0.4, 0.00015));
const btcHistory = generateHistory(40000, scaledMoves(2.5, 0.0012));
const ethHistory = generateHistory(2200, scaledMoves(2.7, -0.0004));

const assets: Asset[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation (Demo Snapshot)",
    type: "stock",
    currentPrice: nvdaHistory[29].price,
    prevClosePrice: nvdaHistory[28].price,
    price7DaysAgo: nvdaHistory[22].price,
    price30DaysAgo: nvdaHistory[0].price,
    dailyChangePercent: ((nvdaHistory[29].price - nvdaHistory[28].price) / nvdaHistory[28].price) * 100,
    change7DaysPercent: ((nvdaHistory[29].price - nvdaHistory[22].price) / nvdaHistory[22].price) * 100,
    change30DaysPercent: ((nvdaHistory[29].price - nvdaHistory[0].price) / nvdaHistory[0].price) * 100,
    volatility: "high",
    status: "Bullish",
    history: nvdaHistory,
    currency: "USD",
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp (Demo Snapshot)",
    type: "stock",
    currentPrice: msftHistory[29].price,
    prevClosePrice: msftHistory[28].price,
    price7DaysAgo: msftHistory[22].price,
    price30DaysAgo: msftHistory[0].price,
    dailyChangePercent: ((msftHistory[29].price - msftHistory[28].price) / msftHistory[28].price) * 100,
    change7DaysPercent: ((msftHistory[29].price - msftHistory[22].price) / msftHistory[22].price) * 100,
    change30DaysPercent: ((msftHistory[29].price - msftHistory[0].price) / msftHistory[0].price) * 100,
    volatility: "medium",
    status: "Bullish",
    history: msftHistory,
    currency: "USD",
  },
  {
    symbol: "AMD",
    name: "Advanced Micro Devices (Demo)",
    type: "stock",
    currentPrice: amdHistory[29].price,
    prevClosePrice: amdHistory[28].price,
    price7DaysAgo: amdHistory[22].price,
    price30DaysAgo: amdHistory[0].price,
    dailyChangePercent: ((amdHistory[29].price - amdHistory[28].price) / amdHistory[28].price) * 100,
    change7DaysPercent: ((amdHistory[29].price - amdHistory[22].price) / amdHistory[22].price) * 100,
    change30DaysPercent: ((amdHistory[29].price - amdHistory[0].price) / amdHistory[0].price) * 100,
    volatility: "high",
    status: "Neutral",
    history: amdHistory,
    currency: "USD",
  },
  {
    symbol: "AAPL",
    name: "Apple Inc (Demo)",
    type: "stock",
    currentPrice: aaplHistory[29].price,
    prevClosePrice: aaplHistory[28].price,
    price7DaysAgo: aaplHistory[22].price,
    price30DaysAgo: aaplHistory[0].price,
    dailyChangePercent: ((aaplHistory[29].price - aaplHistory[28].price) / aaplHistory[28].price) * 100,
    change7DaysPercent: ((aaplHistory[29].price - aaplHistory[22].price) / aaplHistory[22].price) * 100,
    change30DaysPercent: ((aaplHistory[29].price - aaplHistory[0].price) / aaplHistory[0].price) * 100,
    volatility: "low",
    status: "Neutral",
    history: aaplHistory,
    currency: "USD",
  },
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF (Demo)",
    type: "etf",
    currentPrice: spyHistory[29].price,
    prevClosePrice: spyHistory[28].price,
    price7DaysAgo: spyHistory[22].price,
    price30DaysAgo: spyHistory[0].price,
    dailyChangePercent: ((spyHistory[29].price - spyHistory[28].price) / spyHistory[28].price) * 100,
    change7DaysPercent: ((spyHistory[29].price - spyHistory[22].price) / spyHistory[22].price) * 100,
    change30DaysPercent: ((spyHistory[29].price - spyHistory[0].price) / spyHistory[0].price) * 100,
    volatility: "low",
    status: "Bullish",
    history: spyHistory,
    currency: "USD",
  },
  {
    symbol: "BTC-USD",
    name: "Bitcoin (Demo)",
    type: "crypto",
    currentPrice: btcHistory[29].price,
    prevClosePrice: btcHistory[28].price,
    price7DaysAgo: btcHistory[22].price,
    price30DaysAgo: btcHistory[0].price,
    dailyChangePercent: ((btcHistory[29].price - btcHistory[28].price) / btcHistory[28].price) * 100,
    change7DaysPercent: ((btcHistory[29].price - btcHistory[22].price) / btcHistory[22].price) * 100,
    change30DaysPercent: ((btcHistory[29].price - btcHistory[0].price) / btcHistory[0].price) * 100,
    volatility: "extreme",
    status: "Bullish",
    history: btcHistory,
    currency: "USD",
  },
  {
    symbol: "ETH-USD",
    name: "Ethereum (Demo)",
    type: "crypto",
    currentPrice: ethHistory[29].price,
    prevClosePrice: ethHistory[28].price,
    price7DaysAgo: ethHistory[22].price,
    price30DaysAgo: ethHistory[0].price,
    dailyChangePercent: ((ethHistory[29].price - ethHistory[28].price) / ethHistory[28].price) * 100,
    change7DaysPercent: ((ethHistory[29].price - ethHistory[22].price) / ethHistory[22].price) * 100,
    change30DaysPercent: ((ethHistory[29].price - ethHistory[0].price) / ethHistory[0].price) * 100,
    volatility: "extreme",
    status: "Neutral",
    history: ethHistory,
    currency: "USD",
  }
];

export const DEMO_INITIAL_STATE: SystemState = {
  lastUpdated: "2024-02-01T12:00:00.000Z",
  assets,
  portfolio: {
    balance: 7000,
    startBalance: 10000,
    totalValue: 11000,
    pnlAbsolute: 1000,
    pnlPercent: 10,
    positions: [
      {
        symbol: "NVDA",
        name: "NVIDIA Corporation (Demo Snapshot)",
        type: "stock",
        quantity: 5,
        avgBuyPrice: 400,
        currentPrice: nvdaHistory[29].price,
        totalCost: 2000,
        currentValue: 5 * nvdaHistory[29].price,
        pnlAbsolute: (5 * nvdaHistory[29].price) - 2000,
        pnlPercent: (((5 * nvdaHistory[29].price) - 2000) / 2000) * 100
      },
      {
        symbol: "MSFT",
        name: "Microsoft Corp (Demo Snapshot)",
        type: "stock",
        quantity: 2,
        avgBuyPrice: 300,
        currentPrice: msftHistory[29].price,
        totalCost: 600,
        currentValue: 2 * msftHistory[29].price,
        pnlAbsolute: (2 * msftHistory[29].price) - 600,
        pnlPercent: (((2 * msftHistory[29].price) - 600) / 600) * 100
      }
    ]
  },
  trades: [
    {
      id: "demo-trade-1",
      date: "2024-01-15",
      symbol: "NVDA",
      assetName: "NVIDIA Corporation (Demo Snapshot)",
      type: "BUY",
      quantity: 5,
      price: 400,
      fee: 0,
      reason: "Sample demo trade",
    },
    {
      id: "demo-trade-2",
      date: "2024-01-20",
      symbol: "MSFT",
      assetName: "Microsoft Corp (Demo Snapshot)",
      type: "BUY",
      quantity: 2,
      price: 300,
      fee: 0,
      reason: "Simulated portfolio addition",
    }
  ],
  analyses: [
    {
      id: "demo-analysis-1",
      symbol: "NVDA",
      assetName: "NVIDIA Corporation (Demo Snapshot)",
      date: "2024-01-30",
      score: 85,
      recommendation: "Kaufen",
      summary: "This is a sample analysis for demo purposes.",
      bullCase: "Sample bull case for demo.",
      bearCase: "Sample bear case for demo.",
      technicalAnalysis: "Sample technical analysis.",
      fundamentalAnalysis: "Sample fundamental analysis.",
      newsSentiment: "Sample positive news.",
      riskRating: "high",
      horizon: "30d",
      modelsScores: {
        gpt: 80,
        claude: 85,
        gemini: 90,
        technical: 85
      },
      expectedReturnPercent: 15,
      expectedDirection: "Bullish",
      targetPriceOptional: 550,
      modelName: "Sample Analysis (Demo Data)"
    }
  ],
  forecasts: [
    {
      id: "demo-forecast-1",
      symbol: "NVDA",
      assetName: "NVIDIA Corporation (Demo Snapshot)",
      date: "2024-01-30",
      targetHorizon: "30d",
      direction: "Bullish",
      startPrice: nvdaHistory[29].price,
      expectedChangePercent: 15,
      score: 85,
      status: "active",
      targetPriceOptional: 550,
      modelName: "Sample Analysis (Demo Data)",
      analysisId: "demo-analysis-1"
    },
    {
      id: "demo-forecast-2",
      symbol: "MSFT",
      assetName: "Microsoft Corp (Demo Snapshot)",
      date: "2023-12-01",
      targetHorizon: "30d",
      direction: "Bullish",
      startPrice: 320,
      expectedChangePercent: 5,
      score: 75,
      status: "resolved",
      targetPriceOptional: 336,
      modelName: "Sample Analysis (Demo Data)",
      results: {
        endPrice: 350,
        actualChangePercent: 9.375,
        isCorrect: true,
        drift: 4.375,
        evaluationDate: "2024-01-01",
        conclusion: "Demo resolved forecast conclusion.",
        actualEvaluationDate: "2024-01-01"
      }
    }
  ],
  alerts: [
    {
      id: "demo-alert-1",
      symbol: "AAPL",
      assetName: "Apple Inc (Demo)",
      type: "price_below",
      threshold: 150,
      dateAdded: "2024-01-25",
      active: true,
      triggered: false
    }
  ],
  news: []
};
