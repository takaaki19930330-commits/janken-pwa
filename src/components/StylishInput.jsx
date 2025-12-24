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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Recommendation:</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ padding: "6px 10px", borderRadius: 999, background: "#fff", border: "1px solid #eee" }}>
            <span style={{ fontSize: 20 }}>{recommendedHand}</span>
          </div>
          <div style={{ fontSize: 13, color: "#555" }}>{recommendationReason}</div>
        </div>
      </div>

      <div className="hands-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        {HANDS.map((h) => {
          const s = predictionStats[h.key] || { expected: 0, winRate: 0, count: 0 };
          const isActive = hand === h.key;
          return (
            <div key={h.key} style={{ position: "relative" }}>
              <button
                onClick={() => setHand(h.key)}
                className={`hand-btn ${isActive ? "active" : ""}`}
                style={{
                  padding: "18px 28px",
                  borderRadius: 12,
                  boxShadow: isActive ? "0 6px 20px rgba(37,99,235,0.18)" : "0 8px 20px rgba(2,6,23,0.04)",
                  background: "#fff",
                  border: "1px solid #eef2ff",
                  minWidth: 120,
                  textAlign: "center",
                  fontSize: 18,
                }}
                aria-pressed={isActive}
              >
                <div style={{ fontSize: 28 }}>{h.key}</div>
                <div style={{ marginTop: 6 }}>{h.label}</div>
              </button>

              {/* small stat overlay */}
              <div style={{
                position: "absolute",
                right: -6,
                bottom: -6,
                background: "#fff",
                borderRadius: 8,
                padding: "4px 6px",
                fontSize: 12,
                border: "1px solid #eee",
                minWidth: 84,
                textAlign: "center",
                boxShadow: "0 6px 18px rgba(2,6,23,0.04)"
              }}>
                <div style={{ fontWeight: 700 }}>{s.count} plays</div>
                <div style={{ fontSize: 11, color: "#666" }}>E:{Math.round((s.expected||0)*100)/100}</div>
                <div style={{ fontSize: 11, color: "#666" }}>W:{((s.winRate||0)*100).toFixed(0)}%</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 240 }}>
        {RESULTS.map((r) => (
          <button
            key={r}
            onClick={() => setResult(r)}
            className={`result-btn ${result === r ? "active" : ""}`}
            style={{
              padding: "12px 18px",
              borderRadius: 999,
              border: result === r ? "none" : "1px solid #eef2ff",
              background: result === r ? "linear-gradient(90deg,#2563eb,#06b6d4)" : "#fff",
              color: result === r ? "#fff" : "#111",
              fontWeight: 700,
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          onClick={() => onAdd(result, hand)}
          style={{
            padding: "12px 20px",
            borderRadius: 16,
            background: "linear-gradient(90deg,#06b6d4,#2563eb)",
            color: "#fff",
            fontWeight: 700,
            boxShadow: "0 8px 30px rgba(6,182,212,0.14)",
          }}
        >
          記録する
        </button>
      </div>
    </div>
  );
}
