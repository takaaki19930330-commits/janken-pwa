// src/components/StylishInput.jsx
import React, { useEffect, useState } from "react";
import "./StylishInput.css";

const HANDS = [
  { key: "✊", label: "グー" },
  { key: "✌️", label: "チョキ" },
  { key: "✋", label: "パー" },
];

const RESULTS = ["勝ち", "あいこ", "負け"];

export default function StylishInput({
  onAdd,
  defaultHand = "✊",
  defaultResult = "勝ち",
  recommendedHand = null,
  recommendationReason = "",
  predictionStats = {},
}) {
  const [hand, setHand] = useState(defaultHand);
  const [result, setResult] = useState(defaultResult);

  // If recommendedHand changes, update selection so suggestion is convenient (live)
  useEffect(() => {
    if (recommendedHand) {
      setHand(recommendedHand);
    }
  }, [recommendedHand]);

  return (
    <div className="stylish-input">
      <div className="recommend-row">
        <div className="rec-label">Recommendation</div>
        <div className="rec-pill">
          <div className="rec-emoji">{recommendedHand}</div>
          <div className="rec-reason">{recommendationReason}</div>
        </div>
      </div>

      <div className="hands-row">
        {HANDS.map((h) => {
          const s = predictionStats[h.key] || { expected: 0, winRate: 0, count: 0 };
          const isActive = hand === h.key;
          return (
            <div key={h.key} className="hand-wrap">
              <button
                onClick={() => setHand(h.key)}
                className={`hand-btn ${isActive ? "active" : ""}`}
                aria-pressed={isActive}
              >
                <div className="hand-emoji">{h.key}</div>
                <div className="hand-label">{h.label}</div>
              </button>

              <div className="hand-badge">
                <div className="badge-count">{s.count}</div>
                <div className="badge-line">E:{Math.round((s.expected||0)*100)/100}</div>
                <div className="badge-line">W:{((s.winRate||0)*100).toFixed(0)}%</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="results-row">
        {RESULTS.map((r) => (
          <button
            key={r}
            onClick={() => setResult(r)}
            className={`result-btn ${result === r ? "active" : ""}`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="submit-row">
        <button
          onClick={() => onAdd(result, hand)}
          className="submit-btn"
        >
          記録する
        </button>
      </div>
    </div>
  );
}
