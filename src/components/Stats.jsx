// src/components/Stats.jsx
import React, { useMemo, useRef, useState } from "react";

/**
 * Stats component
 * - shows cumulative-average line chart
 * - expected baseline (from scoreMap)
 * - clicking/tapping a point shows a small label *above the point* (SVG elements) to avoid viewport clipping
 *
 * Props:
 *  - records: filtered array
 *  - scoreMap: mapping { 勝ち:40, あいこ:20, 負け:10 }
 */
export default function Stats({ records = [], scoreMap = {}, sensitivity = 0.5 }) {
  const containerRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState(null); // date string

  // produce map: date -> {sum, count, avgDay}
  const dailyData = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const d = r.date || new Date(r.createdAt).toISOString().slice(0,10);
      const v = scoreMap[r.result] ?? 0;
      if (!map.has(d)) map.set(d, { sum: 0, count: 0 });
      const entry = map.get(d);
      entry.sum += v;
      entry.count += 1;
    }
    const arr = Array.from(map.entries()).map(([date, {sum, count}]) => ({
      date,
      daySum: sum,
      dayCount: count,
      dayAvg: count ? sum / count : 0,
    }));
    // sort by date ascending
    arr.sort((a,b) => a.date.localeCompare(b.date));
    return arr;
  }, [records, scoreMap]);

  // compute cumulative avg up to each day
  const cumulative = useMemo(() => {
    const out = [];
    let cumSum = 0;
    let cumCount = 0;
    for (const d of dailyData) {
      cumSum += d.daySum;
      cumCount += d.dayCount;
      const cumAvg = cumCount ? Math.round((cumSum / cumCount) * 100) / 100 : 0;
      out.push({ date: d.date, cumAvg, dayAvg: d.dayAvg, dayCount: d.dayCount });
    }
    return out;
  }, [dailyData]);

  // expected baseline from scoreMap (配点からの理論的期待値)
  const expectedBaseline = useMemo(() => {
    const vals = Object.values(scoreMap).filter(v => typeof v === "number");
    if (vals.length === 0) return 0;
    const sum = vals.reduce((a,b)=>a+b,0);
    return Math.round((sum / vals.length) * 100) / 100;
  }, [scoreMap]);

  const maxVal = 40;
  const width = Math.max(360, cumulative.length * 80);
  const height = 180;
  const padding = { top: 18, right: 18, bottom: 40, left: 36 };

  // points use cumulative cumAvg
  const points = cumulative.map((d, i) => {
    const x = padding.left + (i / Math.max(1, cumulative.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + (1 - (d.cumAvg / maxVal)) * (height - padding.top - padding.bottom);
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i===0?'M':'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  const valueToY = (val) => padding.top + (1 - (val / maxVal)) * (height - padding.top - padding.bottom);

  // when a point is selected, show label at that point (SVG rect + text)
  function onPointClick(pt, ev) {
    ev.stopPropagation();
    setSelectedDate((prev) => (prev === pt.date ? null : pt.date));
  }

  return (
    <div className="stats-root" ref={containerRef} onClick={() => setSelectedDate(null)}>
      <div className="stats-header">
        <h2 className="stats-title">平均得点の推移</h2>
        <div className="stats-note">横にスワイプして日ごとの推移を確認</div>
      </div>

      <div className="chart-scroll" style={{ overflowX: 'auto', position: 'relative' }}>
        <svg width={width} height={height} style={{ display: 'block' }}>
          {/* horizontal grid & y labels */}
          {[0,0.25,0.5,0.75,1].map((t, idx) => {
            const y = padding.top + t * (height - padding.top - padding.bottom);
            const val = Math.round((1 - t) * maxVal);
            return (
              <g key={idx}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#eee" strokeWidth={1}/>
                <text x={8} y={y+4} fontSize="10" fill="#666">{val}</text>
              </g>
            );
          })}

          {/* x labels */}
          {points.map((p, idx) => (
            <text key={idx} x={p.x} y={height - 10} textAnchor="middle" fontSize="10" fill="#444">{p.date}</text>
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

          {/* cumulative line */}
          {points.length>0 && (
            <>
              <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    fill="#fff"
                    stroke="#2563eb"
                    strokeWidth={2}
                    style={{ cursor: 'pointer' }}
                    onClick={(ev)=>onPointClick(p, ev)}
                  />
                  {/* if this point is selected, draw a small label (rect + text) directly above the point */}
                  {selectedDate === p.date && (
                    <g>
                      {/* approximate label width based on text length */}
                      {(() => {
                        const label = String(p.cumAvg);
                        const labelWidth = Math.max(56, label.length * 8 + 20);
                        const rx = Math.max(p.x - labelWidth/2, padding.left + 4);
                        const ry = p.y - 28;
                        return (
                          <g>
                            <rect x={rx} y={ry} width={labelWidth} height={22} rx={8} fill="#fff" stroke="#e6e9ef" />
                            <text x={rx + labelWidth/2} y={ry + 15} fontSize="12" fill="#111827" textAnchor="middle" fontWeight="700">
                              {p.cumAvg}
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  )}
                </g>
              ))}
            </>
          )}
        </svg>
      </div>

      <div className="hand-summary-row" style={{ marginTop: 12 }}>
        <div className="hand-summary-card">
          <div className="card-title">Hand summary</div>
          {/* compute per-hand stats */}
          {(() => {
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
            return hands.map(h => {
              const s = out[h];
              const avgScore = s.count ? Math.round(((s.win*(scoreMap["勝ち"]||40) + s.draw*(scoreMap["あいこ"]||20) + s.loss*(scoreMap["負け"]||10)) / s.count)*100)/100 : 0;
              return (
                <div key={h} className="hand-row" style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                  <div style={{display:"flex", gap:8, alignItems:"center"}}>
                    <div style={{fontSize:18}}>{h}</div>
                    <div>
                      <div style={{fontWeight:700}}>{s.count} plays</div>
                      <div style={{fontSize:12, color:"#666"}}>W: {s.count ? Math.round((s.win/s.count)*100) : 0}%</div>
                      <div style={{fontSize:12, color:"#666"}}>Wins/Draws/Losses: {s.win}/{s.draw}/{s.loss}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12, color:"#666"}}>Avg score</div>
                    <div style={{fontWeight:800, fontSize:16}}>{avgScore}</div>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        <div className="rec-card">
          <div className="card-title">Recommended</div>
          <div style={{fontSize:32, marginTop:8}}>
            {(() => {
              const hands = ["✊","✌️","✋"];
              const list = hands.map(h => {
                // approximate avg score used for ranking
                let win=0, draw=0, loss=0, count=0;
                for (const r of records) {
                  if (r.hand === h) {
                    count++;
                    if (r.result === "勝ち") win++;
                    else if (r.result === "あいこ") draw++;
                    else if (r.result === "負け") loss++;
                  }
                }
                const avg = count ? (win*(scoreMap["勝ち"]||40) + draw*(scoreMap["あいこ"]||20) + loss*(scoreMap["負け"]||10)) / count : 0;
                return { h, avg, count };
              });
              list.sort((a,b)=>b.avg - a.avg);
              return list[0] && list[0].count > 0 ? list[0].h : "—";
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
