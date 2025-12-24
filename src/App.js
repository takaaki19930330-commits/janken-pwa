// src/App.js
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadRecords, saveRecords } from "./db";
import { uploadRecord, fetchRemoteRecordsAndMerge, syncUp } from "./sync";
import StylishInput from "./components/StylishInput";
import Stats from "./components/Stats";

const SCORE_MAP = { 勝ち: 40, あいこ: 20, 負け: 10 };
const STORAGE_KEY = "janken_records_v1";

export default function App() {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [tab, setTab] = useState("input"); // "input" | "stats"

  // 初期ロード
  useEffect(() => {
    (async () => {
      const local = loadRecords();
      const merged = await fetchRemoteRecordsAndMerge(local);
      setRecords(Array.isArray(merged) ? merged : []);
      try {
        await syncUp(merged);
      } catch {}
    })();
  }, []);

  // 常に localStorage 同期
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {}
    try {
      saveRecords(records);
    } catch {}
  }, [records]);

  // 記録追加（createdAt を必ず付与）
  function addRecord(result, hand) {
    const newRecord = {
      date: selectedDate,
      result,
      hand,
      createdAt: Date.now(), // ★ 追加
    };

    setHistory((h) => [...h, records.slice()]);

    setRecords((prev) => {
      const next = [...prev, newRecord];

      // 即時保存（タスクキル耐性）
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}

      // 非同期で Supabase へ
      uploadRecord(newRecord).catch(() => {});

      return next;
    });
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRecords(prev);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
    } catch {}
  }

  // ★ 並び順の核心：createdAt の降順
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const ta = a.createdAt ?? 0;
      const tb = b.createdAt ?? 0;
      return tb - ta; // 新しいものが上
    });
  }, [records]);

  const averageScore = useMemo(() => {
    if (records.length === 0) return 0;
    const sum = records.reduce((acc, r) => acc + (SCORE_MAP[r.result] || 0), 0);
    return Math.round((sum / records.length) * 100) / 100;
  }, [records]);

  return (
    <div className="container">
      <h1>じゃんけん記録</h1>

      <div className="tabbar">
        <button onClick={() => setTab("input")} className={tab === "input" ? "active" : ""}>
          入力
        </button>
        <button onClick={() => setTab("stats")} className={tab === "stats" ? "active" : ""}>
          統計
        </button>
      </div>

      {tab === "input" ? (
        <>
          <div className="date-row">
            <label>
              日付
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </label>

            <div className="avg-badge">
              平均得点
              <div className="avg-value">{averageScore}</div>
            </div>
          </div>

          <StylishInput onAdd={addRecord} />

          <button onClick={undo}>↩ 戻る</button>

          <table>
            <thead>
              <tr>
                <th>日付</th>
                <th>手</th>
                <th>結果</th>
                <th>得点</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.hand}</td>
                  <td>{r.result}</td>
                  <td>{SCORE_MAP[r.result]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <Stats records={records} scoreMap={SCORE_MAP} />
      )}
    </div>
  );
}
