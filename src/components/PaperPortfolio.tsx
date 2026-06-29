import React from "react";
import { SystemState, Position, formatAssetPrice } from "../types";
import { CreditCard, RefreshCw, TrendingUp, TrendingDown, HelpCircle, ArrowUpRight, DollarSign } from "lucide-react";

interface PaperPortfolioProps {
  state: SystemState;
  onOpenTradeModal: (symbol: string) => void;
  onResetPortfolio: () => void;
  onSelectAsset: (symbol: string) => void;
}

export default function PaperPortfolio({
  state,
  onOpenTradeModal,
  onResetPortfolio,
  onSelectAsset
}: PaperPortfolioProps) {
  const { portfolio, assets } = state;

  // Calculate allocation breakdown
  const cashAmt = portfolio.balance;
  const positionsAmt = portfolio.totalValue - cashAmt;
  const totalAmt = portfolio.totalValue > 0 ? portfolio.totalValue : 1;

  const cashPct = (cashAmt / totalAmt) * 100;
  
  // Group positions by type
  let stocksAmt = 0;
  let etfsAmt = 0;
  let cryptosAmt = 0;

  portfolio.positions.forEach(pos => {
    if (pos.type === "stock") stocksAmt += pos.currentValue;
    else if (pos.type === "etf") etfsAmt += pos.currentValue;
    else if (pos.type === "crypto") cryptosAmt += pos.currentValue;
  });

  const stocksPct = (stocksAmt / totalAmt) * 100;
  const etfsPct = (etfsAmt / totalAmt) * 100;
  const cryptosPct = (cryptosAmt / totalAmt) * 100;

  // Currency Formatter
  const fmt = (num: number) => `${num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} V€`;

  const hasCurrencyMismatch = portfolio.positions.some(pos => {
    const asset = assets.find(a => a.symbol === pos.symbol);
    return asset && asset.currency && asset.currency !== "EUR";
  });

  const pnlColor = portfolio.pnlAbsolute >= 0 ? "text-emerald-600" : "text-red-600";
  const pnlBorder = portfolio.pnlAbsolute >= 0 ? "border-emerald-100" : "border-red-100";
  const pnlBg = portfolio.pnlAbsolute >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";

  return (
    <div className="space-y-6">
      {hasCurrencyMismatch && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-medium">
          <HelpCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <span>
            <strong>Währungshinweis:</strong> Einige Deiner Positionen werden in USD oder anderen Fremdwährungen geführt. Da eine automatische FX-Umrechnung (Wechselkurs-Konvertierung) für das Paper-Trading noch nicht implementiert ist, werden die Werte direkt 1:1 verrechnet. Deine Gewinn- und Verlustrechnung (P/L) ist daher eine Annäherung.
          </span>
        </div>
      )}
      {/* Portfolio Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Left Card: Value Overview */}
        <div className={`bg-white p-5 rounded-2xl border ${portfolio.pnlAbsolute >= 0 ? "border-emerald-100/50" : "border-red-100/50"} shadow-xs flex flex-col justify-between`}>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Depotgesamtwert</span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">{fmt(portfolio.totalValue)}</h2>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pnlBg}`}>
              {portfolio.pnlAbsolute >= 0 ? "+" : ""}{portfolio.pnlPercent.toFixed(2)}%
            </span>
            <span className={`text-xs font-bold ${pnlColor}`}>
              {portfolio.pnlAbsolute >= 0 ? "+" : ""}{fmt(portfolio.pnlAbsolute)} gesamt
            </span>
          </div>
        </div>

        {/* Middle Card: Cash Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Verfügbares Kapital (Cash)</span>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mt-1">{fmt(portfolio.balance)}</h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-4">
            Startkapital: {fmt(portfolio.startBalance)} • Liquidität für Käufe.
          </p>
        </div>

        {/* Right Card: Asset Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Investiertes Vermögen</span>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mt-1">{fmt(positionsAmt)}</h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-4">
            In {portfolio.positions.length} aktiven Werten angelegt.
          </p>
        </div>

      </div>

      {/* Allocation breakdown visualizer bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Asset-Allokation</h3>
          <span className="text-xs text-indigo-600 font-semibold">Diversifikations-Check</span>
        </div>

        {/* Combined bar */}
        <div className="w-full h-4 bg-slate-100 rounded-full flex overflow-hidden shadow-inner">
          {cashPct > 0 && (
            <div 
              style={{ width: `${cashPct}%` }} 
              className="bg-slate-400 h-full hover:opacity-90 transition-opacity" 
              title={`Cash: ${cashPct.toFixed(1)}%`}
            />
          )}
          {stocksPct > 0 && (
            <div 
              style={{ width: `${stocksPct}%` }} 
              className="bg-indigo-600 h-full hover:opacity-90 transition-opacity" 
              title={`Aktien: ${stocksPct.toFixed(1)}%`}
            />
          )}
          {etfsPct > 0 && (
            <div 
              style={{ width: `${etfsPct}%` }} 
              className="bg-emerald-500 h-full hover:opacity-90 transition-opacity" 
              title={`ETFs: ${etfsPct.toFixed(1)}%`}
            />
          )}
          {cryptosPct > 0 && (
            <div 
              style={{ width: `${cryptosPct}%` }} 
              className="bg-amber-500 h-full hover:opacity-90 transition-opacity" 
              title={`Crypto: ${cryptosPct.toFixed(1)}%`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-slate-400 rounded-xs" />
            <span className="text-slate-500">Cash: <strong className="text-slate-800">{cashPct.toFixed(1)}%</strong> ({fmt(cashAmt)})</span>
          </div>
          {stocksAmt > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-indigo-600 rounded-xs" />
              <span className="text-slate-500">Aktien: <strong className="text-slate-800">{stocksPct.toFixed(1)}%</strong> ({fmt(stocksAmt)})</span>
            </div>
          )}
          {etfsAmt > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-emerald-500 rounded-xs" />
              <span className="text-slate-500">ETFs: <strong className="text-slate-800">{etfsPct.toFixed(1)}%</strong> ({fmt(etfsAmt)})</span>
            </div>
          )}
          {cryptosAmt > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-amber-500 rounded-xs" />
              <span className="text-slate-500">Crypto: <strong className="text-slate-800">{cryptosPct.toFixed(1)}%</strong> ({fmt(cryptosAmt)})</span>
            </div>
          )}
        </div>
      </div>

      {/* Holdings Positions Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Aktive Wertpapier-Positionen</h3>
            <p className="text-xs text-slate-400 mt-0.5">Sämtliche im Besitz befindlichen Wertpapiere und deren unrealisierte Gewinne.</p>
          </div>
          <button
            onClick={onResetPortfolio}
            className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Depot zurücksetzen
          </button>
        </div>

        {portfolio.positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 pl-6">Wertpapier / Klasse</th>
                  <th className="p-4">Stückzahl</th>
                  <th className="p-4">Kaufpreis (ø)</th>
                  <th className="p-4">Kurs aktuell</th>
                  <th className="p-4">Kaufwert gesamt</th>
                  <th className="p-4">Depotwert aktuell</th>
                  <th className="p-4 text-center">Entwicklung (GuV)</th>
                  <th className="p-4 pr-6 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {portfolio.positions.map((pos) => {
                  const pnlIsPos = pos.pnlAbsolute >= 0;
                  const itemColor = pnlIsPos ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-red-600 bg-red-50 border-red-100";
                  const asset = assets.find(a => a.symbol === pos.symbol);
                  const assetCurrency = asset?.currency || "USD";

                  return (
                    <tr key={pos.symbol} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name */}
                      <td className="p-4 pl-6">
                        <div 
                          className="flex items-center gap-2.5 cursor-pointer"
                          onClick={() => onSelectAsset(pos.symbol)}
                        >
                          <div className="bg-slate-100 font-mono font-bold text-xs w-8 h-8 rounded-lg flex items-center justify-center text-slate-800 border border-slate-200">
                            {pos.symbol}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 hover:text-indigo-600 transition-colors block text-xs sm:text-sm">{pos.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                              {pos.type === "stock" ? "Aktie" : pos.type === "etf" ? "ETF" : "Crypto"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="p-4 font-mono font-semibold text-slate-700">
                        {pos.quantity.toLocaleString("de-DE", { maximumFractionDigits: 6 })}
                      </td>

                      {/* Buy Price ø */}
                      <td className="p-4 font-mono text-slate-600">
                        {formatAssetPrice(pos.avgBuyPrice, assetCurrency)}
                      </td>

                      {/* Current price */}
                      <td className="p-4 font-mono text-slate-700">
                        {formatAssetPrice(pos.currentPrice, assetCurrency)}
                      </td>

                      {/* Total cost */}
                      <td className="p-4 font-mono text-slate-500">
                        {fmt(pos.totalCost)}
                      </td>

                      {/* Current Value */}
                      <td className="p-4 font-mono font-bold text-slate-800">
                        {fmt(pos.currentValue)}
                      </td>

                      {/* G&V */}
                      <td className="p-4 text-center">
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${itemColor}`}>
                          {pnlIsPos ? "+" : ""}{pos.pnlPercent.toFixed(2)}% ({pnlIsPos ? "+" : ""}{fmt(pos.pnlAbsolute)})
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => onOpenTradeModal(pos.symbol)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold cursor-pointer border border-indigo-100"
                          >
                            Trade
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <DollarSign className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-sm font-semibold">Keine Wertpapiere im Depot.</p>
            <p className="text-xs text-slate-400 mt-1">Gehe in die Watchlist und führe simulierten Käufe mit Deinem virtuellen 10.000 V€ Budget durch.</p>
          </div>
        )}
      </div>
    </div>
  );
}
