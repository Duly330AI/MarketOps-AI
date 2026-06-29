import React from "react";
import { SystemState, formatAssetPrice } from "../types";
import { CreditCard, Calendar, ShoppingCart, Info, TrendingUp, TrendingDown } from "lucide-react";

interface TradeJournalProps {
  state: SystemState;
  onSelectAsset: (symbol: string) => void;
}

export default function TradeJournal({ state, onSelectAsset }: TradeJournalProps) {
  const { trades, assets } = state;

  const fmt = (num: number) => num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " V€";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Paper Trade Journal</h2>
        <p className="text-xs text-slate-500 mt-1">Lückenlose Historie aller simulierten Käufe und Verkäufe zur Nachvollziehbarkeit der eigenen Anlagestrategie.</p>
      </div>

      {/* Main ledger list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {trades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 pl-6">Datum</th>
                  <th className="p-4">Wertpapier</th>
                  <th className="p-4 text-center">Transaktion</th>
                  <th className="p-4">Menge</th>
                  <th className="p-4">Kurs</th>
                  <th className="p-4">Gebühren</th>
                  <th className="p-4">Gesamtvolumen (V€)</th>
                  <th className="p-4 pr-6">Handelsgrund / Motiv</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {trades.map((tr) => {
                  const isBuy = tr.type === "BUY";
                  const totalVolume = (tr.quantity * tr.price) + (isBuy ? tr.fee : -tr.fee);
                  const asset = assets.find((a) => a.symbol === tr.symbol);

                  return (
                    <tr key={tr.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Date */}
                      <td className="p-4 pl-6 font-mono text-xs text-slate-500">
                        {tr.date}
                      </td>

                      {/* Asset Symbol */}
                      <td className="p-4">
                        <div 
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => onSelectAsset(tr.symbol)}
                        >
                          <span className="font-extrabold text-slate-800 font-mono text-xs hover:text-indigo-600">
                            {tr.symbol}
                          </span>
                          <span className="text-xs text-slate-400 font-medium truncate max-w-xs">({tr.assetName})</span>
                        </div>
                      </td>

                      {/* Transaction Type */}
                      <td className="p-4 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isBuy 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                            : "bg-red-50 text-red-700 border-red-100"
                        }`}>
                          {isBuy ? "KAUF" : "VERKAUF"}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="p-4 font-mono font-semibold text-slate-700">
                        {tr.quantity.toLocaleString("de-DE", { maximumFractionDigits: 6 })}
                      </td>

                      {/* Price */}
                      <td className="p-4 font-mono text-slate-600">
                        {formatAssetPrice(tr.price, asset?.currency)}
                      </td>

                      {/* Fee */}
                      <td className="p-4 font-mono text-slate-500">
                        {tr.fee.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} V€
                      </td>

                      {/* Total Volume */}
                      <td className="p-4 font-mono font-bold text-slate-800">
                        {fmt(totalVolume)}
                      </td>

                      {/* Reason */}
                      <td className="p-4 pr-6 text-slate-500 text-xs italic max-w-xs truncate" title={tr.reason}>
                        {tr.reason || "Manuelle Order"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <ShoppingCart className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-sm font-semibold">Bisher noch keine Trades dokumentiert.</p>
            <p className="text-xs text-slate-400 mt-1">Platziere Trades in der Watchlist oder auf der Asset-Detailseite, um Dein Journal zu befüllen.</p>
          </div>
        )}
      </div>
    </div>
  );
}
