import { useEffect, useState, useMemo } from "react";
import "./App.css";
import { loadRecords, saveRecords } from "./db";
import Stats from "./components/Stats";
import StylishInput from "./components/StylishInput";

console.log("APP VERSION 2025-12-23 14:45");

const SCORE_MAP = {
  勝ち: 40,
  あいこ: 20,
  負け: 10,
};

export default function App() {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [tab, setTab] = useState("input"); // "input" | "stats"

  useEffect(() => {
    loadRecords().then((r) => {
      setRecords(Array.isArray(r) ? r : []);
    });
  }, []);

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  function addRecord(result, hand) {
    setHistory((h) => [...h, records.slice()]);
    setRecords((prev) => [
      ...prev,
      {
        date: selectedDate,
        result,
        hand,
      },
    ]);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRecords(prev);
  }

  const averageScore = useMemo(() => {
    if (records.length === 0) return 0;
    const sum = records.reduce((acc, r) => acc + (SCORE_MAP[r.result] || 0), 0);
    return Math.round((sum / records.length) * 100) / 100;
  }, [records]);

  return (
    <div className="container">
      <h1 className="title">じゃんけん記録</h1>

      <div className="tabbar" role="tablist">
        <button
          className={`tab ${tab === "input" ? "active" : ""}`}
          onClick={() => setTab("input")}
        >
          入力
        </button>
        <button
          className={`tab ${tab === "stats" ? "active" : ""}`}
          onClick={() => setTab("stats")}
        >
          統計
        </button>
      </div>

      {tab === "input" ? (
        <>
          <div className="date-row">
            <label className="date-label">
              日付
              <input
                className="date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="記録日付"
              />
            </label>

            <div className="avg-badge" aria-hidden>
              平均得点
              <div className="avg-value">{averageScore}</div>
            </div>
          </div>

          <StylishInput onAdd={addRecord} />

          <div className="action-row">
            <button className="undo" onClick={undo}>
              ↩ 戻る
            </button>
          </div>

          <div className="table-wrapper">
            <table className="records-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>手</th>
                  <th>結果</th>
                  <th>得点</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.hand}</td>
                    <td>{r.result}</td>
                    <td>{SCORE_MAP[r.result] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Stats records={records} scoreMap={SCORE_MAP} />
      )}
    </div>
  );
}
