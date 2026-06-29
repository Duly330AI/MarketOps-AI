import React, { useState } from "react";
import { PriceHistoryPoint } from "../types";

interface AssetChartProps {
  history: PriceHistoryPoint[];
  symbol: string;
}

export default function AssetChart({ history, symbol }: AssetChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<PriceHistoryPoint | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <p className="text-sm text-slate-400">Keine Kursdaten vorhanden.</p>
      </div>
    );
  }

  const width = 640;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };

  const prices = history.map((h) => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice === 0 ? 1 : maxPrice - minPrice;

  // Add 5% buffer top and bottom
  const plotMin = Math.max(0, minPrice - priceRange * 0.05);
  const plotMax = maxPrice + priceRange * 0.05;
  const plotRange = plotMax - plotMin;

  const getX = (index: number) => {
    return padding.left + (index / (history.length - 1)) * (width - padding.left - padding.right);
  };

  const getY = (price: number) => {
    return (
      height -
      padding.bottom -
      ((price - plotMin) / plotRange) * (height - padding.top - padding.bottom)
    );
  };

  // Generate SVG path for line
  const linePoints = history.map((point, index) => `${getX(index)},${getY(point.price)}`).join(" L ");
  const linePath = `M ${linePoints}`;

  // Generate area path for shading
  const areaPath = `${linePath} L ${getX(history.length - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`;

  // Grid lines
  const gridLinesCount = 4;
  const gridLines = Array.from({ length: gridLinesCount }).map((_, i) => {
    const ratio = i / (gridLinesCount - 1);
    const value = plotMin + ratio * plotRange;
    return {
      value,
      y: getY(value)
    };
  });

  // X-axis labels (3 dates: start, mid, end)
  const xLabels = [
    { index: 0, date: history[0].date },
    { index: Math.floor(history.length / 2), date: history[Math.floor(history.length / 2)].date },
    { index: history.length - 1, date: history[history.length - 1].date }
  ];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - svgRect.left;
    
    // Scale clientX to SVG viewBox width
    const svgWidth = svgRect.width;
    const xRatio = clientX / svgWidth;
    const virtualX = xRatio * width;

    // Find closest index
    const chartWidth = width - padding.left - padding.right;
    const relativeX = virtualX - padding.left;
    let index = Math.round((relativeX / chartWidth) * (history.length - 1));
    index = Math.max(0, Math.min(history.length - 1, index));

    setHoverIndex(index);
    setHoveredPoint(history[index]);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setHoveredPoint(null);
  };

  const isUp = history[history.length - 1].price >= history[0].price;
  const colorTheme = isUp ? "emerald" : "red";
  const strokeColor = isUp ? "#10b981" : "#ef4444";
  const gradientId = `chart-grad-${symbol}`;

  return (
    <div className="relative bg-white border border-slate-100 p-4 rounded-xl shadow-xs">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Kurshistorie (Letzte {history.length} Tage)
        </h4>
        <div className="text-right">
          {hoveredPoint ? (
            <div>
              <span className="text-lg font-bold text-slate-800">
                {hoveredPoint.price.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
              <span className="text-xs text-slate-400 ml-2 block sm:inline">
                am {hoveredPoint.date}
              </span>
            </div>
          ) : (
            <div>
              <span className="text-lg font-bold text-slate-800">
                {history[history.length - 1].price.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
              <span className="text-xs text-slate-400 ml-2 block sm:inline">
                aktuell
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {gridLines.map((line, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={line.y}
                x2={width - padding.right}
                y2={line.y}
                stroke="#f1f5f9"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={line.y + 4}
                textAnchor="end"
                className="text-[10px] font-mono fill-slate-400"
              >
                {line.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
              </text>
            </g>
          ))}

          {/* Area under curve */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Price Line */}
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X Axis Labels */}
          {xLabels.map((lbl, idx) => (
            <text
              key={idx}
              x={getX(lbl.index)}
              y={height - padding.bottom + 16}
              textAnchor="middle"
              className="text-[10px] font-mono fill-slate-400"
            >
              {lbl.date}
            </text>
          ))}

          {/* Hover indicator vertical line & dot */}
          {hoverIndex !== null && hoveredPoint && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={height - padding.bottom}
                stroke="#cbd5e1"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(hoveredPoint.price)}
                r={5}
                fill={strokeColor}
                stroke="white"
                strokeWidth={1.5}
                className="shadow-sm animate-ping"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(hoveredPoint.price)}
                r={4}
                fill={strokeColor}
                stroke="white"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
