// src/components/CumulativeChart.jsx
import React, { useMemo } from "react";

export default function CumulativeChart({
  data,
  perItemWidth = 96, // 1日あたりの横幅（小さめにするなら80, 多く見せたいなら120）
  height = 220,
  padding = 36,
}) {
  if (!data || data.length === 0) {
    return <div style={{ padding: 20 }}>データがありません</div>;
  }

  // compute width based on number of points to make horizontal scroll
  const width = Math.max(600, data.length * perItemWidth);

  const values = data.map((d) => d.cumulativeAvg);
  const max = Math.max(...values, 50);
  const min = Math.min(...values, 0);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * innerW;
    const y = padding + (1 - (d.cumulativeAvg - min) / (max - min || 1)) * innerH;
    return { x, y, date: d.date, value: Math.round(d.cumulativeAvg * 100) / 100 };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="chart-scroll" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="累積平均グラフ">
        <defs>
          <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4f91ff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#4f91ff" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* 軸ラベル（簡易） */}
        <g>
          <text x={padding} y={padding - 8} fontSize="12" fill="#666">得点</text>
          <text x={width - padding} y={height - 6} fontSize="12" fill="#666" textAnchor="end">日付</text>
        </g>

        {/* 塗りつぶしエリア */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
          fill="url(#lineGrad)"
          stroke="none"
        />

        {/* 線 */}
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* 点とラベル */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke="#2563eb" strokeWidth="1.5" />
            <text x={p.x} y={p.y - 10} fontSize="11" fill="#333" textAnchor="middle">{p.value}</text>
            <text x={p.x} y={height - padding + 18} className="chart-date-label" fill="#222" textAnchor="middle">
              {p.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
