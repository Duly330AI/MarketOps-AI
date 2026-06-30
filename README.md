# MarketOps AI

**MarketOps AI** is a paper-trading and market-analysis dashboard built for educational, research, and training purposes.

The app combines market watchlists, asset detail views, simulated portfolio tracking, forecast tracking, trade journaling, price alerts, and a model-agnostic AI analysis workflow.

MarketOps AI does **not** execute real trades. It is designed as a local paper-trading and research environment for observing markets, documenting investment hypotheses, importing structured AI analysis, and evaluating forecasts over time.

---

## Important Disclaimer

* **Paper Trading Only:** This application is built for educational, research, and paper-trading purposes only.
* **No Financial Advice:** This project is not financial advice, and nothing in this application constitutes financial, investment, trading, tax, or legal advice.
* **No Real-Money Broker Integration:** The app does not connect to brokerages and does not execute real trades.
* **Market Data Reliability:** Market data may be delayed, stale, incomplete, inaccurate, or unavailable.
* **AI Limitations:** AI-generated analysis can be wrong, incomplete, outdated, biased, or hallucinated.
* **User Responsibility:** Do not use this project as the basis for real-world trading decisions.
* **Use at Your Own Risk:** This is a private portfolio and research project, not a regulated financial product.

---

## Status

**Functional MVP / portfolio project**

MarketOps AI is designed as a usable paper-trading and research prototype.
It demonstrates a complete dashboard-style workflow, but it is not intended for live trading, production finance use, or regulated investment analysis.

---

## Core Idea

MarketOps AI works like a small financial NOC-style console:

1. Select or add assets to a watchlist.
2. Review real market data, price movement, volatility, and trend information.
3. Open an asset detail page with chart, technical data, fundamentals, and news context.
4. Generate a strict AI analysis prompt based on available market data.
5. Copy the prompt into an external AI model.
6. Paste the returned JSON result back into MarketOps AI.
7. Import the analysis and review structured output such as:

   * recommendation
   * score
   * confidence
   * bull case
   * bear case
   * technical summary
   * fundamental summary
   * risk summary
   * expected direction
   * forecast data
8. Track forecasts and compare them against later market movement.
9. Use simulated trades, a paper depot, and a trade journal to document decisions.

---

## AI Analysis Workflow

MarketOps AI does not require a built-in AI API integration.

Instead, it uses a controlled manual AI workflow:

1. Select an asset from the watchlist.
2. Generate an analysis prompt based on available market data, technical indicators, fundamentals, and current news.
3. Copy the generated prompt into an external AI model of your choice.
4. Paste the returned JSON result back into MarketOps AI.
5. Import the analysis and review the structured recommendation, score, bull case, bear case, technical summary, fundamental summary, risks, and expected direction.

This approach keeps the app model-agnostic and makes the analysis process transparent and auditable.

---

## Features

### Watchlist

* Track selected assets
* Show current price
* Show daily movement
* Show 7-day and 30-day performance
* Display volatility classification
* Display NOC-style status indicators
* Filter by asset type

### Asset Detail

* Detailed asset view
* Price history chart
* Current and historical price values
* Technical indicator context
* Fundamental data context
* News-based context
* Asset-specific simulated actions

### AI Consensus Analysis

* Manual AI prompt generation
* JSON-based AI analysis import
* Model-agnostic analysis workflow
* Structured recommendation scoring
* Bull case and bear case visualization
* Technical summary
* Fundamental summary
* Risk summary
* Expected direction
* Confidence value
* Model name tracking

### Paper Depot

* Virtual starting balance
* Simulated cash balance
* Simulated asset holdings
* Portfolio allocation view
* Unrealized position tracking
* Depot reset option

### Simulated Trading

* Simulated buy and sell orders
* Quantity-based order form
* Trade notes / journal reason
* No real-money execution
* All trades remain virtual

### Forecast Tracking

* Track submitted forecasts
* Store forecast horizon and expected return
* Compare forecasts against later market movement
* Show hit-rate and average deviation
* Keep active and completed forecast entries

### Trade Journal

* Record simulated trading activity
* Document trade reasoning
* Review past simulated decisions
* Support learning and strategy reflection

### Triggers & Alerts

* Configure asset-based price alerts
* Define threshold conditions
* Track armed alerts
* Display triggered events

---

## Screenshots

<img width="1861" height="920" alt="Screenshot 2026-06-30 161924" src="https://github.com/user-attachments/assets/755f27fa-6aa2-4da2-9bdd-3b6d42c0bcf1" />

<img width="1902" height="950" alt="Screenshot 2026-06-30 161941" src="https://github.com/user-attachments/assets/0a117f8d-715a-4185-a1d4-df460e4a5755" />

<img width="1914" height="957" alt="Screenshot 2026-06-30 161952" src="https://github.com/user-attachments/assets/b3b204e9-452e-43d7-b23f-70c588b6caa0" />

<img width="1911" height="953" alt="Screenshot 2026-06-30 162007" src="https://github.com/user-attachments/assets/c0f24beb-64fe-47bc-9fe7-15d77b7f1088" />

<img width="1907" height="953" alt="Screenshot 2026-06-30 162033" src="https://github.com/user-attachments/assets/6c398455-9114-4411-8569-785e1b111cda" />

<img width="1913" height="953" alt="Screenshot 2026-06-30 162111" src="https://github.com/user-attachments/assets/5eb4c560-b85e-4eec-9e90-9641f65dbefd" />

<img width="1913" height="953" alt="Screenshot 2026-06-30 162122" src="https://github.com/user-attachments/assets/ec61a9d2-5d5e-41a3-9332-c80d2ad3f0ab" />

<img width="1907" height="950" alt="Screenshot 2026-06-30 162130" src="https://github.com/user-attachments/assets/4bab79cb-2d52-4675-89db-5c2691b75227" />

<img width="1914" height="949" alt="Screenshot 2026-06-30 162147" src="https://github.com/user-attachments/assets/6d7e115b-55e0-43b7-a883-3e1c24ee924a" />

<img width="1908" height="939" alt="Screenshot 2026-06-30 162324" src="https://github.com/user-attachments/assets/44ef59ea-b9e8-493d-bd61-013cb7e5fe2d" />

<img width="652" height="831" alt="Screenshot 2026-06-30 162541" src="https://github.com/user-attachments/assets/b80a32f5-bde3-4457-91d5-8776dd137415" />


---

## Tech Stack

* React
* TypeScript
* Vite
* Tailwind CSS
* Node.js / Express
* Market data integration
* Manual AI analysis workflow
* JSON-based import pipeline

---

## Main Modules

### Watchlist Markets

The watchlist module gives a compact market overview with price, trend, recent performance, volatility, and asset actions.

### Asset Detail

The asset detail module combines chart data, performance metrics, analysis tabs, paper-trading actions, and portfolio status.

### AI Consensus Analysis

The AI analysis module generates structured prompts and imports strict JSON results from external AI models.

### Paper Depot

The paper depot tracks virtual cash, simulated holdings, allocation, and unrealized simulated performance.

### Forecast Tracking

The forecast tracking module records predictions and allows later evaluation against real market movement.

### Trade Journal

The trade journal documents simulated trading decisions and supports review of past actions.

### Triggers & Alerts

The alert module allows threshold-based monitoring for selected assets.

---

## Example AI Analysis Flow

MarketOps AI can generate a prompt containing:

* asset name and symbol
* asset class
* current price
* recent performance
* technical indicators
* fundamental data
* current news
* analysis horizon
* strict JSON output requirements

The external AI model returns a JSON object such as:

```json
{
  "recommendation": "WATCH",
  "score": 43,
  "confidence": 58,
  "horizon": "30d",
  "bullCase": "Short-term technical rebound is possible after recent weakness.",
  "bearCase": "The asset remains below key moving averages and shows negative momentum.",
  "technicalSummary": "RSI and moving averages indicate mixed technical conditions.",
  "fundamentalSummary": "Fundamental data is incomplete and should be interpreted with caution.",
  "riskSummary": "Trend continuation and missing data are key risks.",
  "expectedDirection": "Neutral",
  "expectedReturnPercent": 1.0,
  "targetPriceOptional": null,
  "keyRisks": [
    "Trend continuation",
    "Insufficient fundamental data",
    "News-driven volatility"
  ],
  "sourcesUsed": [
    "Market data",
    "Technical indicators",
    "Financial news"
  ],
  "modelName": "External AI Model"
}
```

After import, the app visualizes the result inside the asset detail page.

---

## Getting Started

### Prerequisites

* Node.js
* npm

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open the local development URL shown by Vite.

---

## Build

```bash
npm run build
```

---

## Project Notes

MarketOps AI was built as a private research, learning, and portfolio project.

The focus is on:

* dashboard-style UI architecture
* paper-trading workflows
* structured financial analysis
* transparent AI-assisted reasoning workflows
* JSON-based analysis import
* forecast tracking and later evaluation
* clear separation between simulation and real financial activity

This repository should be treated as an educational tool and portfolio project, not as a production trading platform.

---

## License

MIT License. See [LICENSE](LICENSE).
