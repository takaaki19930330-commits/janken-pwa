import React from "react";

/**
 * data: [{ date, cumulativeAvg }]
 * options: perItemWidth, height, expectedBaseline (number)
 */
export default function CumulativeChart({
  data,
  perItemWidth = 96,
  height = 240,
  padding = 36,
  expectedBaseline = (40 + 20 + 10) / 3, // ≒23.333...
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

  // compute points
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * innerW;
    const y = padding + (1 - (d.cumulativeAvg - min) / (max - min || 1)) * innerH;
    return { x, y, date: d.date, value: Math.round(d.cumulativeAvg * 100) / 100 };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // expected baseline Y
  const baselineY = padding + (1 - (expectedBaseline - min) / (max - min || 1)) * innerH;

  // prepare bar height for expected value (visual)
  const barMaxHeight = innerH; // full height maps to max value
  const bars = data.map((d, i) => {
    const xCenter = padding + (i / (data.length - 1 || 1)) * innerW;
    const barWidth = Math.max(12, perItemWidth * 0.5);
    const expectedHeight = ((expectedBaseline - min) / (max - min || 1)) * barMaxHeight;
    const barTop = padding + (innerH - expectedHeight);
    return { x: xCenter - barWidth / 2, y: barTop, w: barWidth, h: expectedHeight };
  });

  return (
    <div className="chart-scroll" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="累積平均グラフ">
        <defs>
          <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4f91ff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#4f91ff" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* expected baseline bar (drawn per day) */}
        {bars.map((b, idx) => {
          const dayAvg = data[idx].cumulativeAvg;
          const above = dayAvg >= expectedBaseline;
          return (
            <rect
              key={"bar" + idx}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill={above ? "#d1fae5" : "#fee2e2"} /* light green / light red */
              stroke={above ? "#16a34a22" : "#ef444422"}
              rx={6}
            />
          );
        })}

        {/* shaded area under line */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
          fill="url(#lineGrad)"
          stroke="none"
          opacity="0.9"
        />

        {/* line */}
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* baseline line */}
        <line x1={padding} x2={width - padding} y1={baselineY} y2={baselineY} stroke="#999" strokeDasharray="4 6" strokeWidth="1" />

        {/* points, values, date labels */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r={3.8} fill="#fff" stroke="#2563eb" strokeWidth="1.6" />
            <text x={p.x} y={p.y - 12} fontSize="12" fill="#111" textAnchor="middle">
              {p.value}
            </text>
            <text x={p.x} y={height - padding + 22} className="chart-date-label" fill="#222" textAnchor="middle">
              {p.date}
            </text>
          </g>
        ))}

        {/* legend */}
        <g transform={`translate(${padding},${10})`}>
          <rect x={0} y={-8} width={12} height={8} fill="#d1fae5" rx={2} />
          <text x={18} y={0} fontSize="12" fill="#333">期待値バー（期待値 = {Math.round(expectedBaseline*100)/100}）</text>
        </g>
      </svg>
    </div>
  );
}
