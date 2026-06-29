import React from "react";
import { PriceHistoryPoint } from "../types";

interface MiniSparklineProps {
  history: PriceHistoryPoint[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}

export default function MiniSparkline({
  history,
  width = 100,
  height = 36,
  strokeWidth = 2
}: MiniSparklineProps) {
  if (!history || history.length === 0) return null;

  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min === 0 ? 1 : max - min;

  const points = history
    .map((point, index) => {
      const x = (index / (history.length - 1)) * width;
      // Invert Y because SVG coordinates start from top-left (0,0)
      const y = height - ((point.price - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  const isUp = history[history.length - 1].price >= history[0].price;
  const strokeColor = isUp ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"; // emerald-500 vs red-500

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
