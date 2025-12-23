// src/components/StylishInput.jsx
import React, { useState } from "react";
import "./StylishInput.css"; // 任意。既存App.cssがあれば不要

const HANDS = [
  { key: "✊", label: "グー" },
  { key: "✌️", label: "チョキ" },
  { key: "✋", label: "パー" },
];

const RESULTS = ["勝ち", "あいこ", "負け"];

export default function StylishInput({ onAdd, defaultHand = "✊", defaultResult = "勝ち" }) {
  const [hand, setHand] = useState(defaultHand);
  const [result, setResult] = useState(defaultResult);

  return (
    <div className="stylish-input">
      <div className="hands-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        {HANDS.map((h) => (
          <button
            key={h.key}
            onClick={() => setHand(h.key)}
            className={`hand-btn ${hand === h.key ? "active" : ""}`}
            style={{
              padding: "18px 28px",
              borderRadius: 12,
              boxShadow: hand === h.key ? "0 6px 20px rgba(37,99,235,0.18)" : "0 8px 20px rgba(2,6,23,0.04)",
              background: "#fff",
              border: "1px solid #eef2ff",
              minWidth: 120,
              textAlign: "center",
              fontSize: 18,
            }}
            aria-pressed={hand === h.key}
          >
            <div style={{ fontSize: 28 }}>{h.key}</div>
            <div style={{ marginTop: 6 }}>{h.label}</div>
          </button>
        ))}
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
