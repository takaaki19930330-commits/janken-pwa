// src/components/StylishInput.jsx
import React, { useState, useEffect } from "react";

/**
 * Props:
 * - onAdd(result, hand)
 * - defaultHand
 * - defaultResult
 * - recommendedHand
 * - recommendationReason
 * - predictionStats
 */
export default function StylishInput({
  onAdd,
  defaultHand = "✊",
  defaultResult = "勝ち",
  recommendedHand,
  recommendationReason,
  predictionStats = {},
}) {
  const [hand, setHand] = useState(defaultHand);
  const [result, setResult] = useState(defaultResult);

  useEffect(() => {
    setHand(defaultHand);
  }, [defaultHand]);

  function handleAdd() {
    if (!hand || !result) return;
    onAdd(result, hand);
  }

  return (
    <div className="stylish-input-root">
      <div className="recommend-row">
        <div className="rec-label">Recommendation</div>
        <div className="rec-pill">{recommendedHand ?? "—"} <span className="rec-reason">{recommendationReason}</span></div>
      </div>

      <div className="hands-row">
        {["✊","✌️","✋"].map((h) => {
          const s = predictionStats[h] || {};
          const isSelected = hand === h;
          return (
            <button
              key={h}
              className={`hand-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setHand(h)}
              aria-pressed={isSelected}
            >
              <div className="hand-emoji">{h}</div>
              <div className="hand-label">
                {h === "✊" ? "グー" : h === "✌️" ? "チョキ" : "パー"}
              </div>
              <div className="hand-meta">
                <div className="plays">{(s.count||0) + " plays"}</div>
                <div className="expected">{Math.round((s.expected||0)*100)/100}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="result-row">
        {["勝ち","あいこ","負け"].map((r) => (
          <button
            key={r}
            className={`result-btn ${result === r ? 'active' : ''}`}
            onClick={() => setResult(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="add-btn" onClick={handleAdd}>記録する</button>
      </div>
    </div>
  );
}
