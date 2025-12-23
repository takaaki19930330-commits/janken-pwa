import React, { useState, useEffect } from "react";

/**
 * props:
 * - onAdd({ result, hand })  // 呼ぶと記録される
 * - defaultHand (optional)
 * - defaultResult (optional)
 */
export default function StylishInput({ onAdd, defaultHand = "✊", defaultResult = "勝ち" }) {
  const hands = [
    { key: "✊", label: "グー" },
    { key: "✌️", label: "チョキ" },
    { key: "✋", label: "パー" },
  ];
  const results = [
    { key: "勝ち", color: "#16a34a" },
    { key: "あいこ", color: "#f59e0b" },
    { key: "負け", color: "#ef4444" },
  ];

  const [hand, setHand] = useState(defaultHand);
  const [result, setResult] = useState(defaultResult);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => setConfirmed(false), [hand, result]);

  function handleConfirm() {
    setConfirmed(true);
    // small delay for UX (ボタンの押下感があると良い)
    setTimeout(() => {
      onAdd(result, hand);
      setConfirmed(false);
    }, 180);
  }

  return (
    <div className="stylish-input">
      <div className="si-top-row">
        <div className="si-hand-picker" role="radiogroup" aria-label="手を選ぶ">
          {hands.map((h) => (
            <button
              key={h.key}
              className={`si-hand-card ${hand === h.key ? "active" : ""}`}
              onClick={() => setHand(h.key)}
              aria-pressed={hand === h.key}
            >
              <div className="si-hand-emoji">{h.key}</div>
              <div className="si-hand-label">{h.label}</div>
            </button>
          ))}
        </div>

        <div className="si-result-picker" role="radiogroup" aria-label="結果を選ぶ">
          {results.map((r) => (
            <button
              key={r.key}
              className={`si-result-pill ${result === r.key ? "active" : ""}`}
              onClick={() => setResult(r.key)}
              style={result === r.key ? { boxShadow: `0 8px 18px ${r.color}22`, borderColor: r.color } : {}}
              aria-pressed={result === r.key}
            >
              <div className="si-result-text">{r.key}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="si-preview-row">
        <div className="si-preview">
          <div className="si-preview-hand">{hand}</div>
          <div className="si-preview-info">
            <div className="si-preview-result">{result}</div>
            <div className="si-preview-sub">選択内容プレビュー</div>
          </div>
        </div>

        <button
          className="si-confirm"
          onClick={handleConfirm}
          disabled={confirmed}
          aria-disabled={confirmed}
        >
          {confirmed ? "記録中…" : "記録する"}
        </button>
      </div>
    </div>
  );
}
