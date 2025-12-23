// src/components/CumulativeChart.jsx
import React from "react";

export default function CumulativeChart({
  data,
  perItemWidth = 96,
  height = 240,
  padding = 36,
  expectedBaseline = (40 + 20 + 10) / 3, // default expectation
}) {
  if (!data || data.length === 0) {
    return <div style={{ padding: 20 }}>データがありません</div>;
  }

  const width = Math.max(600, data.length * perItemWidth);
  const values = data.map((d) => d.cumulativeAvg);
  const max = Math.max(...values, expectedBaseline, 50);
  const min = Math.min(...values, 0);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * innerW;
    const y =
      padding +
      (1 - (d.cumulativeAvg - min) / (max - min || 1)) * innerH;
    return {
      x,
      y,
      date: d.date,
      value: Math.round(d.cumulativeAvg * 100) / 100,
    };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // baseline y for expected value
  const baselineY =
    padding +
    (1 - (expectedBaseline - min) / (max - min || 1)) * innerH;

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 8 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="累積平均グラフ">
        {/* area under line */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
          fill="#2563eb22"
        />

        {/* line */}
        <path
          d={pathD}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* horizontal expected baseline (thick red) */}
        <line
          x1={padding}
          x2={width - padding}
          y1={baselineY}
          y2={baselineY}
          stroke="#dc2626"
          strokeWidth="4"
        />

        {/* points and labels */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#2563eb" strokeWidth="2" />
            <text x={p.x} y={p.y - 12} fontSize="12" fill="#111" textAnchor="middle">
              {p.value}
            </text>
            <text x={p.x} y={height - padding + 22} fontSize="12" fill="#222" textAnchor="middle">
              {p.date}
            </text>
          </g>
        ))}

        {/* legend */}
        <g transform={`translate(${padding}, 18)`}>
          <line x1="0" y1="0" x2="24" y2="0" stroke="#dc2626" strokeWidth="4" />
          <text x="32" y="4" fontSize="12" fill="#333">
            期待値（{Math.round(expectedBaseline * 100) / 100}）
          </text>
        </g>
      </svg>
    </div>
  );
}
