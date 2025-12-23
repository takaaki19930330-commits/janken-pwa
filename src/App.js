import { useEffect, useState } from "react";
import "./App.css";
import { loadRecords, saveRecords } from "./db";

export default function App() {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);

  // 初回起動時にDBから読み込み
  useEffect(() => {
    loadRecords().then(setRecords);
  }, []);

  // recordsが変わるたびに保存
  useEffect(() => {
    saveRecords(records);
  }, [records]);

  function addRecord(result, hand) {
    setHistory([...history, records]); // Undo用に保存
    setRecords([
      ...records,
      {
        date: new Date().toISOString().slice(0, 10),
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
