import React from "react";
import "./Stats.css";

// Displays hand summaries (counts, winrate, avg score)
export default function Stats({ records }) {
  const hands = ["グー","チョキ","パー"];
  const summary = hands.map(h => {
    const items = records.filter(r=>r.hand===h);
    const plays = items.length;
    const wins = items.filter(it=>it.result==="勝ち").length;
    const draws = items.filter(it=>it.result==="あいこ").length;
    const losses = items.filter(it=>it.result==="負け").length;
    const avg = plays ? Math.round(items.reduce((s,i)=>s+(i.score||0),0)/plays*100)/100 : 0;
    const winrate = plays ? Math.round((wins/plays)*100*100)/100 : 0;
    return { hand:h, plays, wins, draws, losses, avg, winrate };
  });

  return (
    <div className="stats-root">
      <div className="hand-summary">
        <h3>Hand summary</h3>
        {summary.map(s => (
          <div className="hand-card" key={s.hand}>
            <div className="left">
              <div className="emoji">{s.hand==="グー" ? "✊" : s.hand==="チョキ" ? "✌️" : "🖐️"}</div>
              <div>
                <div className="plays">{s.plays} plays</div>
                <div className="win">W: {s.winrate}%</div>
                <div className="wdl">Wins/Draws/Losses: {s.wins}/{s.draws}/{s.losses}</div>
              </div>
            </div>
            <div className="avgscore">
              <div className="label">Avg score</div>
              <div className="value">{s.avg}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="recommended">
        <h3>Recommended</h3>
        <div className="recommended-pill">✊</div>
      </div>
    </div>
  );
}
