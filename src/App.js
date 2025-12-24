// src/App.js
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadRecords, saveRecords } from "./db";
import { uploadRecord, fetchRemoteRecordsAndMerge, syncUp, deleteRecordOnServer } from "./sync";
import StylishInput from "./components/StylishInput";
import Stats from "./components/Stats";

const SCORE_MAP = { 勝ち: 40, あいこ: 20, 負け: 10 };
const STORAGE_KEY = "janken_records_v1";

export default function App() {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState("input"); // "input" | "stats"
  const [busy, setBusy] = useState(false);

  // 初期ロード: local -> merge remote -> setRecords -> try syncUp
  useEffect(() => {
    (async () => {
      try {
        const local = loadRecords();
        const merged = await fetchRemoteRecordsAndMerge(Array.isArray(local) ? local : []);
        setRecords(Array.isArray(merged) ? merged : []);
        try { await syncUp(Array.isArray(merged) ? merged : []); } catch {}
      } catch (e) {
        console.warn("initial load failed", e);
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          setRecords(raw ? JSON.parse(raw) : []);
        } catch {
          setRecords([]);
        }
      }
    })();
  }, []);

  // always keep localStorage in sync
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch (e) { console.warn(e); }
    try { saveRecords(records); } catch (e) {}
  }, [records]);

  // beforeunload flush
  useEffect(() => {
    const flush = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch (e) {}
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [records]);

  // Add createdAt and keep history for undo
  function addRecord(result, hand) {
    const newRecord = {
      date: selectedDate,
      result,
      hand,
      createdAt: Date.now(),
    };

    setHistory((h) => [...h, records.slice()]);

    setRecords((prev) => {
      const next = [...prev, newRecord];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
      // best-effort upload
      uploadRecord(newRecord).then((res) => { if (!res.ok) console.warn("uploadRecord failed", res.error); }).catch(()=>{});
      return next;
    });
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRecords(prev);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prev)); } catch (e) {}
    try { saveRecords(prev); } catch (e) {}
  }

  // Delete a record locally and attempt remote deletion.
  async function deleteRecord(target) {
    // confirm
    if (!window.confirm("この記録を削除しますか？（元に戻せません）")) return;

    setBusy(true);
    try {
      // save history for undo (optional — but undo will only revert local state)
      setHistory((h) => [...h, records.slice()]);

      // remove locally by matching createdAt if present, otherwise match by date/result/hand (remove first match)
      const newLocal = (() => {
        if (target.createdAt != null) {
          return records.filter((r) => r.createdAt !== target.createdAt);
        } else {
          let removed = false;
          return records.filter((r) => {
            if (removed) return true;
            if (r.date === target.date && r.result === target.result && r.hand === target.hand) {
              removed = true;
              return false;
            }
            return true;
          });
        }
      })();

      setRecords(newLocal);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocal)); } catch (e) {}

      // best-effort delete on server
      try {
        const res = await deleteRecordOnServer(target);
        if (!res.ok) console.warn("remote delete failed", res.error);
      } catch (e) {
        console.warn("deleteRecordOnServer exception", e);
      }
    } finally {
      setBusy(false);
    }
  }

  // sorted: newest first by createdAt (if createdAt missing -> fallback by date)
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const ta = a.createdAt ?? 0;
      const tb = b.createdAt ?? 0;
      if (tb !== ta) return tb - ta;
      // fallback: compare date strings (newest first)
      if (a.date && b.date) return b.date.localeCompare(a.date);
      return 0;
    });
  }, [records]);

  const averageScore = useMemo(() => {
    if (!records || records.length === 0) return 0;
    const sum = records.reduce((acc, r) => acc + (SCORE_MAP[r.result] || 0), 0);
    return Math.round((sum / records.length) * 100) / 100;
  }, [records]);

  return (
    <div className="container">
      <h1>じゃんけん記録</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className={`tab ${tab === "input" ? "active" : ""}`} onClick={() => setTab("input")}>入力</button>
        <button className={`tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>統計</button>
      </div>

      {tab === "input" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <label>
              日付
              <input type="date" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} style={{ marginLeft: 8 }} />
            </label>

            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#666" }}>平均得点</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{averageScore}</div>
            </div>
          </div>

          <StylishInput onAdd={addRecord} defaultHand="✊" defaultResult="勝ち" />

          <div style={{ marginTop: 18 }}>
            <button onClick={undo} style={{ padding: "8px 12px", borderRadius: 8 }} disabled={busy}>↩ 戻る</button>
          </div>

          <div style={{ marginTop: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>日付</th>
                  <th style={{ textAlign: "left" }}>手</th>
                  <th style={{ textAlign: "left" }}>結果</th>
                  <th style={{ textAlign: "left" }}>得点</th>
                  <th style={{ textAlign: "left" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((r, i) => (
                  <tr key={r.createdAt ?? i}>
                    <td style={{ padding: "8px 0" }}>{r.date}</td>
                    <td style={{ padding: "8px 0" }}>{r.hand}</td>
                    <td style={{ padding: "8px 0" }}>{r.result}</td>
                    <td style={{ padding: "8px 0" }}>{SCORE_MAP[r.result] ?? 0}</td>
                    <td style={{ padding: "8px 0" }}>
                      <button onClick={() => deleteRecord(r)} disabled={busy} style={{ marginRight: 8 }}>削除</button>
                    </td>
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
