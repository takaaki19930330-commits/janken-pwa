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

  // 初期ロード：local -> merge remote -> setRecords -> try syncUp
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

  // ---- Prediction logic: compute stats per hand ----
  // returns { statsByHand, recommendedHand, recommendedReason }
  const prediction = useMemo(() => {
    const hands = ["✊", "✌️", "✋"];
    const statsByHand = {
      "✊": { count: 0, win: 0, draw: 0, lose: 0, expected: 0 },
      "✌️": { count: 0, win: 0, draw: 0, lose: 0, expected: 0 },
      "✋": { count: 0, win: 0, draw: 0, lose: 0, expected: 0 },
    };

    for (const r of records) {
      const h = r.hand;
      if (!h || !statsByHand[h]) continue;
      statsByHand[h].count += 1;
      if (r.result === "勝ち") statsByHand[h].win += 1;
      else if (r.result === "あいこ") statsByHand[h].draw += 1;
      else if (r.result === "負け") statsByHand[h].lose += 1;
    }

    // compute expected score per hand
    for (const h of hands) {
      const s = statsByHand[h];
      if (s.count === 0) {
        s.expected = 0;
      } else {
        s.expected = (s.win * SCORE_MAP["勝ち"] + s.draw * SCORE_MAP["あいこ"] + s.lose * SCORE_MAP["負け"]) / s.count;
      }
      // add winRate, drawRate, loseRate
      if (s.count === 0) {
        s.winRate = 0;
        s.drawRate = 0;
        s.loseRate = 0;
      } else {
        s.winRate = s.win / s.count;
        s.drawRate = s.draw / s.count;
        s.loseRate = s.lose / s.count;
      }
    }

    // recommend by max expected; tie-breaker: higher winRate, then more samples
    let recommendedHand = "✊";
    let best = { expected: -Infinity, winRate: -Infinity, count: -Infinity };
    for (const h of hands) {
      const s = statsByHand[h];
      if (
        s.expected > best.expected ||
        (s.expected === best.expected && s.winRate > best.winRate) ||
        (s.expected === best.expected && s.winRate === best.winRate && s.count > best.count)
      ) {
        recommendedHand = h;
        best = { expected: s.expected, winRate: s.winRate, count: s.count };
      }
    }

    // format reason string
    const reason = `Expected: ${Math.round(best.expected * 100) / 100}, WinRate: ${(best.winRate*100).toFixed(1)}% (based on ${best.count} plays)`;

    return { statsByHand, recommendedHand, reason };
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

          <StylishInput
            onAdd={addRecord}
            defaultHand="✊"
            defaultResult="勝ち"
            recommendedHand={prediction.recommendedHand}
            recommendationReason={prediction.reason}
            predictionStats={prediction.statsByHand}
          />

          <div style={{ marginTop: 18 }}>
            <button onClick={undo} style={{ padding: "8px 12px", borderRadius: 8 }}>↩ 戻る</button>
          </div>

          <div style={{ marginTop: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>日付</th>
                  <th style={{ textAlign: "left" }}>手</th>
                  <th style={{ textAlign: "left" }}>結果</th>
                  <th style={{ textAlign: "left" }}>得点</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: "8px 0" }}>{r.date}</td>
                    <td style={{ padding: "8px 0" }}>{r.hand}</td>
                    <td style={{ padding: "8px 0" }}>{r.result}</td>
                    <td style={{ padding: "8px 0" }}>{SCORE_MAP[r.result] ?? 0}</td>
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
