import React from "react";
import "./StylishInput.css";

const hands = [
  { key: "グー", emoji: "✊" },
  { key: "チョキ", emoji: "✌️" },
  { key: "パー", emoji: "🖐️" }
];

export default function StylishInput({ selectedHand, onSelectHand, selectedResult, onSelectResult }) {
  return (
    <div className="stylish-input-root">
      <div className="hand-row">
        {hands.map(h => (
          <button
            key={h.key}
            className={`hand-btn ${selectedHand === h.key ? "active" : ""}`}
            onClick={() => onSelectHand(h.key)}
          >
            <div className="emoji">{h.emoji}</div>
            <div className="hand-label">{h.key}</div>
          </button>
        ))}
      </div>

      <div className="result-row">
        <button className={`result-btn ${selectedResult==="勝ち" ? "sel" : ""}`} onClick={()=>onSelectResult("勝ち")}>勝ち</button>
        <button className={`result-btn ${selectedResult==="あいこ" ? "sel" : ""}`} onClick={()=>onSelectResult("あいこ")}>あいこ</button>
        <button className={`result-btn ${selectedResult==="負け" ? "sel" : ""}`} onClick={()=>onSelectResult("負け")}>負け</button>
      </div>
    </div>
  );
}
