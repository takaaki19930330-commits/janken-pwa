import { useEffect, useState } from "react";
import "./App.css";
import { loadRecords, saveRecords } from "./db";

console.log("APP VERSION 2025-12-23 14:45");

export default function App() {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  // 追加: 日付選択状態（YYYY-MM-DD）。デフォルトは今日。
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    loadRecords().then(setRecords);
  }, []);

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  function addRecord(result, hand) {
    // history に入れるのは配列のコピー（参照をそのまま入れると undo で副作用が出ることがある）
    setHistory([...history, records.slice()]);

    setRecords([
      ...records,
      {
        // selectedDate (YYYY-MM-DD) を使う（既存との後方互換）
        date: selectedDate,
        result,
        hand,
      },
    ]);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setRecords(prev);
  }

  return (
    <div className="container">
      <h1>じゃんけん記録</h1>

      {/* 日付入力 */}
      <div style={{ marginBottom: 12 }}>
        <label>
          日付：
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ marginLeft: 8 }}
          />
        </label>
        <span style={{ marginLeft: 12, color: "#666" }}>
          （保存時にここで選んだ日付が使われます）
        </span>
      </div>

      <div className="buttons">
        <button onClick={() => addRecord("勝ち", "✊")}>✊ 勝ち</button>
        <button onClick={() => addRecord("負け", "✊")}>✊ 負け</button>
        <button onClick={() => addRecord("あいこ", "✊")}>✊ あいこ</button>

        <button onClick={() => addRecord("勝ち", "✌️")}>✌️ 勝ち</button>
        <button onClick={() => addRecord("負け", "✌️")}>✌️ 負け</button>
        <button onClick={() => addRecord("あいこ", "✌️")}>✌️ あいこ</button>

        <button onClick={() => addRecord("勝ち", "✋")}>✋ 勝ち</button>
        <button onClick={() => addRecord("負け", "✋")}>✋ 負け</button>
        <button onClick={() => addRecord("あいこ", "✋")}>✋ あいこ</button>
      </div>

      <button className="undo" onClick={undo}>
        ↩ 戻る
      </button>

      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>手</th>
            <th>結果</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i}>
              <td>{r.date}</td>
              <td>{r.hand}</td>
              <td>{r.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
