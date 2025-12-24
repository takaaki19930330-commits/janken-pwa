// src/components/Stats.jsx
import React, { useMemo } from "react";

/**
 * Lightweight SVG line chart for daily average scores.
 * Props:
 *  - records: filtered array
 *  - scoreMap: mapping
 */
export default function Stats({ records = [], scoreMap = {}, sensitivity = 0.5 }) {
  // group by date asc
  const daily = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const d = r.date || new Date(r.createdAt).toISOString().slice(0,10);
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(scoreMap[r.result] || 0);
    }
    const arr = Array.from(map.entries()).map(([date, scores]) => {
      const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
      return { date, avg, count: scores.length };
    });
    arr.sort((a,b)=> a.date.localeCompare(b.date));
    return arr;
  }, [records, scoreMap]);

  // simple bounds
  const maxVal = 40;
  const width = Math.max(320, daily.length * 80);
  const height = 140;
  const padding = { top: 12, right: 12, bottom: 26, left: 36 };

  // points
  const points = daily.map((d, i) => {
    const x = padding.left + (i / Math.max(1, daily.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + (1 - (d.avg / maxVal)) * (height - padding.top - padding.bottom);
    return { x, y, ...d };
  });

  // path d
  const pathD = points.map((p, i) => `${i===0?'M':'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  // hand summary (simple aggregates)
  const handStats = useMemo(() => {
    const hands = ["✊","✌️","✋"];
    const out = { "✊":{count:0,win:0}, "✌️":{count:0,win:0}, "✋":{count:0,win:0} };
    for (const r of records) {
      const h = r.hand;
      if (!out[h]) continue;
      out[h].count += 1;
      if (r.result === "勝ち") out[h].win += 1;
    }
    for (const k of hands) {
      const s = out[k];
      s.winRate = s.count ? s.win / s.count : 0;
      s.avgScore = s.count ? ( (s.win * 40 + (s.count - s.win) * 10) / s.count ) : 0;
    }
    return out;
  }, [records]);

  return (
    <div className="stats-root">
      <div className="stats-header">
        <h2>平均得点の推移</h2>
        <div className="stats-note">横にスワイプして日ごとの推移を確認</div>
      </div>

      <div className="chart-scroll" style={{ overflowX: 'auto' }}>
        <svg width={width} height={height} style={{ display: 'block' }}>
          {/* grid lines */}
          {[0,0.25,0.5,0.75,1].map((t, idx) => {
            const y = padding.top + t * (height - padding.top - padding.bottom);
            const val = Math.round((1 - t) * maxVal);
            return (
              <g key={idx}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#eee" strokeWidth={1}/>
                <text x={6} y={y+4} fontSize="10" fill="#666">{val}</text>
              </g>
            );
          })}

          {/* axis bottom labels */}
          {points.map((p, idx) => (
            <text key={idx} x={p.x} y={height - 6} textAnchor="middle" fontSize="10" fill="#444">{p.date}</text>
          ))}

          {/* line path */}
          {points.length>0 && (
            <>
              <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {/* circles */}
              {points.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.y} r={4.5} fill="#fff" stroke="#2563eb" strokeWidth={2} />
              ))}
            </>
          )}
        </svg>
      </div>

      <div className="hand-summary-row">
        <div className="hand-summary-card">
          <div className="card-title">Hand summary</div>
          {["✊","✌️","✋"].map((h)=> {
            const s = handStats[h];
            return (
              <div key={h} className="hand-row">
                <div className="hand-left">
                  <div className="hand-emoji">{h}</div>
                  <div className="hand-text">
                    <div className="hand-count">{s.count} plays</div>
                    <div className="hand-win">W: {(s.winRate*100).toFixed(0)}%</div>
                  </div>
                </div>
                <div className="hand-score">{Math.round(s.avgScore*100)/100}</div>
              </div>
            );
          })}
        </div>

        <div className="rec-card">
          <div className="card-title">Recommended</div>
          <div style={{fontSize:32, marginTop:8}}>
            {(() => {
              const arr = Object.entries(handStats).map(([k,v])=>({k,score:v.avgScore}));
              arr.sort((a,b)=>b.score-a.score);
              return arr[0] && arr[0].score>0 ? arr[0].k : "—";
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
