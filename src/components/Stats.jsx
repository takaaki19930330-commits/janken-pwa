// src/components/Stats.jsx
import React, { useMemo } from "react";

/**
 * Stats
 * Props:
 *  - records: array of normalized records (already filtered by window)
 *  - scoreMap: { 勝ち:40, あいこ:20, 負け:10 }
 *  - sensitivity (optional) : to reflect weighting visuals (not required)
 */
export default function Stats({ records = [], scoreMap = {}, sensitivity = 0.5 }) {
  // group by date -> compute average score per date
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
    // sort by date ascending so timeline left->right
    arr.sort((a,b)=> a.date.localeCompare(b.date));
    return arr;
  }, [records, scoreMap]);

  // compute hand aggregate stats (unweighted simple)
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
      s.avgScore = s.count ? ( (s.win * 40 + (s.count - s.win) * 10) / s.count ) : 0; // rough
    }
    return out;
  }, [records]);

  // recommended (visual) - pick best avgScore naive
  const recommended = useMemo(() => {
    const hands = ["✊","✌️","✋"];
    let best = { hand:null, score:-Infinity };
    for (const h of hands) {
      const s = handStats[h];
      if (s && s.avgScore > best.score) { best = {hand:h, score:s.avgScore}; }
    }
    return best;
  }, [handStats]);

  // styles (simple inline)
  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };
  const timelineWrap = {
    overflowX: "auto",
    display: "flex",
    gap: 12,
    paddingBottom: 6,
  };
  const cardStyle = {
    minWidth: 160,
    background: "white",
    borderRadius: 12,
    padding: 12,
    boxShadow: "0 8px 20px rgba(2,6,23,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "stretch",
  };
  const barBg = { height: 12, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" };
  const barFill = (pct) => ({ width: `${pct}%`, height: "100%", background: "#dc2626" });

  return (
    <div style={containerStyle}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <h2 style={{margin:0}}>平均得点の推移</h2>
        <div style={{fontSize:12, color:"#666"}}>Swipe →</div>
      </div>

      <div style={timelineWrap}>
        {daily.length === 0 && (
          <div style={{padding:12, color:"#666"}}>No data</div>
        )}
        {daily.map((d) => {
          // percent scale: max 40
          const pct = Math.round((d.avg / 40) * 100);
          return (
            <div key={d.date} style={cardStyle}>
              <div style={{fontWeight:800}}>{d.date}</div>
              <div style={{fontSize:12, color:"#666"}}>{d.count} plays</div>
              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                <div style={{flex:1}}>
                  <div style={barBg}>
                    <div style={barFill(pct)} />
                  </div>
                </div>
                <div style={{minWidth:44, textAlign:"right", fontWeight:700}}>{Math.round(d.avg*100)/100}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{display:"flex", gap:12, alignItems:"flex-start", flexWrap:"wrap"}}>
        <div style={{flex:1, minWidth:220, background:"white", padding:12, borderRadius:12, boxShadow:"0 8px 20px rgba(2,6,23,0.04)"}}>
          <div style={{fontWeight:800, marginBottom:8}}>Hand summary</div>
          {["✊","✌️","✋"].map((h)=> {
            const s = handStats[h];
            return (
              <div key={h} style={{display:"flex", justifyContent:"space-between", marginBottom:6, alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700}}>{h}</div>
                  <div style={{fontSize:12, color:"#666"}}>{s.count} plays • W: {(s.winRate*100).toFixed(0)}%</div>
                </div>
                <div style={{fontWeight:800}}>{Math.round(s.avgScore*100)/100}</div>
              </div>
            );
          })}
        </div>

        <div style={{width:220, background:"white", padding:12, borderRadius:12, boxShadow:"0 8px 20px rgba(2,6,23,0.04)"}}>
          <div style={{fontWeight:800}}>Recommended</div>
          {recommended.hand ? (
            <>
              <div style={{fontSize:32, margin:"8px 0"}}>{recommended.hand}</div>
              <div style={{fontWeight:800}}>{Math.round(recommended.score*100)/100}</div>
            </>
          ) : (
            <div style={{color:"#666"}}>No recommendation</div>
          )}
        </div>
      </div>
    </div>
  );
}
