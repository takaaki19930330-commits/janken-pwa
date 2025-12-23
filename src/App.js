// src/App.js
import React, { useEffect, useState, useMemo } from "react";
import "./App.css";
import { loadRecords, saveRecords } from "./db";
import Stats from "./components/Stats";
import StylishInput from "./components/StylishInput";

const STORAGE_KEY = "janken_records_v1";
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

  // 初期ロード
  useEffect(() => {
    // loadRecords may read localStorage or IndexedDB depending on db.js implementation
    (async () => {
      try {
        const r = await loadRecords();
        if (Array.isArray(r)) {
          setRecords(r);
        } else {
          setRecords([]);
        }
      } catch (e) {
        console.warn("initial loadRecords failed, fallback to localStorage", e);
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          setRecords(raw ? JSON.parse(raw) : []);
        } catch {
          setRecords([]);
        }
      }
    })();
  }, []);

  // saveRecords is kept for IndexedDB/cache backup if implemented; we still call it after state updates
  useEffect(() => {
    try {
      // ensure localStorage is always the first line of defense (synchronous)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn("sync localStorage write failed in effect", e);
    }

    // best-effort: call shared saveRecords (may be async)
    try {
      saveRecords(records);
    } catch (e) {
      // ignore
    }
  }, [records]);

  // beforeunload guard: flush records
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch (e) {}
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [records]);

  // addRecord: synchronous localStorage write inside function for maximum reliability
  function addRecord(result, hand) {
    const newRecord = {
      date: selectedDate,
      result,
      hand,
    };

    // Update history (store shallow copy of previous records for undo)
    setHistory((h) => [...h, records.slice()]);

    // Use functional update to avoid stale closures
    setRecords((prev) => {
      const next = [...prev, newRecord];

      // immediate synchronous write to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("localStorage sync write failed in addRecord", e);
      }

      // best-effort async save (db.js) — do not await
      try {
        saveRecords(next);
      } catch (e) {
        // ignore
      }

      return next;
    });
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRecords(prev);

    // also sync-localstore immediately
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
    } catch (e) {
      console.warn("localStorage write failed in undo", e);
    }

    try {
      saveRecords(prev);
    } catch (e) {}
  }

  // average score (overall)
  const averageScore = useMemo(() => {
    if (records.length === 0) return 0;
    const sum = records.reduce((acc, r) => acc + (SCORE_MAP[r.result] || 0), 0);
    return Math.round((sum / records.length) * 100) / 100;
  }, [records]);

  // sortedRecords: newest date first, then keep insertion order for same date
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      // descending lexicographic comparison on YYYY-MM-DD is fine
      return b.date.localeCompare(a.date);
    });
  }, [records]);

  return (
    <div className="container">
      <h1 className="title">じゃんけん記録</h1>

      <div className="tabbar" role="tablist">
        <button className={`tab ${tab === "input" ? "active" : ""}`} onClick={() => setTab("input")}>
          入力
        </button>
        <button className={`tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>
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

          <StylishInput onAdd={addRecord} defaultHand="✊" defaultResult="勝ち" />

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
                {sortedRecords.map((r, i) => (
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
