// src/components/Stats.jsx
import React, { useMemo } from "react";

/**
 * SVG line chart + expected horizontal line (baseline from scoreMap).
 * Props:
 *  - records: filtered array
 *  - scoreMap: mapping { 勝ち:40, あいこ:20, 負け:10 }
 */
export default function Stats({ records = [], scoreMap = {}, sensitivity = 0.5 }) {
  // group daily averages
  const daily = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const d = r.date || new Date(r.createdAt).toISOString().slice(0,10);
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(scoreMap[r.result] ?? 0);
    }
    const arr = Array.from(map.entries()).map(([date, scores]) => {
      const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
      return { date, avg, count: scores.length };
    });
    arr.sort((a,b)=> a.date.localeCompare(b.date));
    return arr;
  }, [records, scoreMap]);

  // baseline expected value from scoreMap (配点から期待される得点)
  const expectedBaseline = useMemo(() => {
    const vals = Object.values(scoreMap).filter(v => typeof v === "number");
    if (vals.length === 0) return 0;
    const sum = vals.reduce((a,b)=>a+b,0);
    return Math.round((sum / vals.length) * 100) / 100;
  }, [scoreMap]);

  // chart layout
  const maxVal = 40;
  const width = Math.max(320, daily.length * 80);
  const height = 160;
  const padding = { top: 12, right: 12, bottom: 34, left: 36 };

  const points = daily.map((d, i) => {
    const x = padding.left + (i / Math.max(1, daily.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + (1 - (d.avg / maxVal)) * (height - padding.top - padding.bottom);
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i===0?'M':'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  // hand stats: count wins/draws/losses per hand correctly
  const handStats = useMemo(() => {
    const hands = ["✊","✌️","✋"];
    const out = { "✊":{count:0,win:0,draw:0,loss:0}, "✌️":{count:0,win:0,draw:0,loss:0}, "✋":{count:0,win:0,draw:0,loss:0} };
    for (const r of records) {
      const h = r.hand;
      if (!out[h]) continue;
      out[h].count += 1;
      if (r.result === "勝ち") out[h].win += 1;
      else if (r.result === "あいこ") out[h].draw += 1;
      else if (r.result === "負け") out[h].loss += 1;
    }
    for (const k of Object.keys(out)) {
      const s = out[k];
      s.winRate = s.count ? s.win / s.count : 0;
      // correct avg score using wins/draws/losses
      s.avgScore = s.count ? ((s.win * (scoreMap["勝ち"] ?? 40) + s.draw * (scoreMap["あいこ"] ?? 20) + s.loss * (scoreMap["負け"] ?? 10)) / s.count) : 0;
    }
    return out;
  }, [records, scoreMap]);

  const valueToY = (val) => padding.top + (1 - (val / maxVal)) * (height - padding.top - padding.bottom);

  return (
    <div className="stats-root">
      <div className="stats-header">
        <h2>平均得点の推移</h2>
        <div className="stats-note">横にスワイプして日ごとの推移を確認</div>
      </div>

      <div className="chart-scroll" style={{ overflowX: 'auto' }}>
        <svg width={width} height={height} style={{ display: 'block' }}>
          {/* grid */}
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

          {/* x labels */}
          {points.map((p, idx) => (
            <text key={idx} x={p.x} y={height - 6} textAnchor="middle" fontSize="10" fill="#444">{p.date}</text>
          ))}

          {/* expected baseline (red dashed horizontal) */}
          {expectedBaseline > 0 && (
            <g>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={valueToY(expectedBaseline)}
                y2={valueToY(expectedBaseline)}
                stroke="#dc2626"
                strokeWidth={3}
                strokeDasharray="6 4"
                opacity={0.95}
              />
              <text x={width - padding.right - 6} y={valueToY(expectedBaseline) - 6} fontSize="11" fill="#dc2626" textAnchor="end">
                Expected {expectedBaseline}
              </text>
            </g>
          )}

          {/* main line */}
          {points.length>0 && (
            <>
              <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
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
              <div key={h} className="hand-row" style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                <div style={{display:"flex", gap:8, alignItems:"center"}}>
                  <div style={{fontSize:18}}>{h}</div>
                  <div>
                    <div style={{fontWeight:700}}>{s.count} plays</div>
                    <div style={{fontSize:12, color:"#666"}}>W: {(s.winRate*100).toFixed(0)}%</div>
                    <div style={{fontSize:12, color:"#666"}}>Wins/Draws/Losses: {s.win}/{s.draw}/{s.loss}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:12, color:"#666"}}>Avg score</div>
                  <div style={{fontWeight:800, fontSize:16}}>{Math.round(s.avgScore*100)/100}</div>
                </div>
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
