import React from "react";
import "./CumulativeChart.css";

/*
  Lightweight, dependency-free chart:
  - Accepts records prop: [{date, score, created_at}]
  - Renders a simple SVG line chart (cumulative average until that date)
  - On hover / tap, shows value above point (value label always visible on mobile)
*/

export default function CumulativeChart({ records }) {
  // aggregate by date, compute cumulative average up to each date (ascending)
  const dates = Array.from(new Set(records.map(r=>r.date))).sort();
  let cumulative = [];
  let accSum = 0, accCount = 0;
  dates.forEach(d => {
    const items = records.filter(r => r.date === d);
    items.forEach(it => { accSum += (it.score||0); accCount += 1; });
    const avg = accCount ? accSum / accCount : 0;
    cumulative.push({ date: d, avg: Math.round(avg*100)/100 });
  });

  // prepare chart geometry
  const w = 720, h = 180, pad = 24;
  const values = cumulative.map(c => c.avg);
  const max = Math.max(30, Math.max(...values, 10));
  const min = 0;
  const x = (i) => pad + (i * (w - pad*2) / Math.max(1, cumulative.length-1));
  const y = (v) => h - pad - ((v - min) / (max - min)) * (h - pad*2);

  const pathD = cumulative.map((p,i)=> `${i===0 ? "M" : "L"} ${x(i)} ${y(p.avg)}`).join(" ");

  return (
    <div className="cum-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
        {/* baseline grid */}
        {[0, 10, 20, 30].map((g,i)=> (
          <line key={i} x1={pad} x2={w-pad} y1={y(g)} y2={y(g)} stroke="#edf3f8" strokeWidth="1"/>
        ))}
        {/* expected red dashed line (example constant) */}
        <line x1={pad} x2={w-pad} y1={y(20)} y2={y(20)} stroke="#d9534f" strokeWidth="3" strokeDasharray="6 6" opacity="0.9"/>
        {/* polyline */}
        <path d={pathD} fill="none" stroke="#2b6cff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
        {/* points and labels */}
        {cumulative.map((p,i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.avg)} r="6" fill="#fff" stroke="#2b6cff" strokeWidth="3"></circle>
            <text x={x(i)} y={y(p.avg)-10} textAnchor="middle" fontSize="12" fill="#07132f">{p.avg}</text>
            <text x={x(i)} y={h - 6} textAnchor="middle" fontSize="10" fill="#8896a5">{p.date}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
