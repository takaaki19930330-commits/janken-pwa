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

  useEffect(() => {
    if (recommendedHand) {
      setHand(recommendedHand);
    }
  }, [recommendedHand]);

  function percentFromExpected(expected) {
    const MAX = 40;
    if (!expected || expected <= 0) return 0;
    const p = Math.round((expected / MAX) * 100);
    return Math.min(100, Math.max(0, p));
  }

  return (
    <div className="stylish-input">
      <div className="recommend-row">
        <div className="rec-label">Recommendation</div>
        <div className="rec-pill" aria-hidden>
          <div className="rec-emoji">{recommendedHand}</div>
          <div className="rec-reason">{recommendationReason}</div>
        </div>
      </div>

      <div className="hands-grid" role="list">
        {HANDS.map((h) => {
          const s = predictionStats[h.key] || { expected: 0, winRate: 0, count: 0 };
          const isActive = hand === h.key;
          const pct = percentFromExpected(s.expected);
          return (
            <div className="hand-card" key={h.key} role="listitem" aria-label={`${h.label} card`}>
              <button
                onClick={() => setHand(h.key)}
                className={`hand-btn ${isActive ? "active" : ""}`}
                aria-pressed={isActive}
              >
                <div className="hand-emoji">{h.key}</div>
                <div className="hand-label">{h.label}</div>
              </button>

              <div className="hand-meta-row">
                <div className="meta-left">
                  <div className="meta-count">{s.count} plays</div>
                  <div className="meta-win">W: {((s.winRate || 0) * 100).toFixed(0)}%</div>
                </div>
                <div className="meta-space" />
              </div>

              {/* expected bar is moved into its own full-width row to avoid overlap */}
              <div className="expected-row" title={`Expected: ${Math.round((s.expected||0)*100)/100}`}>
                <div className="expected-bar-bg" aria-hidden>
                  <div
                    className="expected-bar-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="expected-value">{Math.round((s.expected || 0) * 100) / 100}</div>
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
        <button onClick={() => onAdd(result, hand)} className="submit-btn">
          記録する
        </button>
      </div>
    </div>
  );
}
