// src/App.js
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadRecords, saveRecords } from "./db";
import { uploadRecord, fetchRemoteRecordsAndMerge, syncUp, deleteRecordOnServer } from "./sync";
import StylishInput from "./components/StylishInput";
import Stats from "./components/Stats";

const SCORE_MAP = { 勝ち: 40, あいこ: 20, 負け: 10 };
const STORAGE_KEY = "janken_records_v1";

/** normalizeRecord: same as before (keeps compatibility) */
function normalizeRecord(raw) {
  if (!raw) return null;
  const r = { ...raw };

  // normalize hand basic
  if (r.hand) r.hand = r.hand.toString().trim();

  // normalize result simple trim
  if (r.result) r.result = r.result.toString().trim();

  // ensure createdAt number
  if (!r.createdAt) {
    if (r.created_at) r.createdAt = new Date(r.created_at).getTime();
    else r.createdAt = Date.now();
  } else {
    if (typeof r.createdAt === "string" && !isNaN(Date.parse(r.createdAt))) {
      r.createdAt = new Date(r.createdAt).getTime();
    } else if (typeof r.createdAt !== "number") {
      r.createdAt = Number(r.createdAt) || Date.now();
    }
  }

  r.date = r.date ? r.date.toString() : new Date(r.createdAt).toISOString().slice(0, 10);

  return r;
}

/** utility: days between timestamp and now */
function daysAgo(ts) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return (Date.now() - ts) / msPerDay;
}

/** compute weighted stats for given records and options */
function computeWeightedStats(records, options) {
  // options: { sensitivity (0..1), alpha (0..1) }
  const { sensitivity = 0.5, alpha = 0.8 } = options || {};
  // map sensitivity to lambda (decay rate) - tuned constants
  const lambda = sensitivity * 0.45; // ~0..0.45
  const hands = ["✊", "✌️", "✋"];
  const stats = {
    "✊": { weightSum: 0, weightedScoreSum: 0, weightedWin: 0, count: 0 },
    "✌️": { weightSum: 0, weightedScoreSum: 0, weightedWin: 0, count: 0 },
    "✋": { weightSum: 0, weightedScoreSum: 0, weightedWin: 0, count: 0 },
  };

  for (const r of records) {
    const h = r.hand;
    if (!h || !stats[h]) continue;
    const age = daysAgo(r.createdAt || Date.now());
    const w = Math.exp(-lambda * age); // exponential decay by age in days
    const score = SCORE_MAP[r.result] || 0;
    const isWin = r.result === "勝ち" ? 1 : 0;
    stats[h].weightSum += w;
    stats[h].weightedScoreSum += w * score;
    stats[h].weightedWin += w * isWin;
    stats[h].count += 1;
  }

  // compute expected and winRate and finalScore
  for (const h of hands) {
    const s = stats[h];
    s.expected = s.weightSum > 0 ? s.weightedScoreSum / s.weightSum : 0;
    s.winRate = s.weightSum > 0 ? s.weightedWin / s.weightSum : 0;
    // hybrid final score
    s.finalScore = alpha * s.expected + (1 - alpha) * (s.winRate * 40);
  }

  // choose recommended
  let recommendedHand = null;
  let best = { finalScore: -Infinity, expected: -Infinity, winRate: -Infinity, count: -Infinity };
  for (const h of hands) {
    const s = stats[h];
    if (
      s.finalScore > best.finalScore ||
      (s.finalScore === best.finalScore && s.expected > best.expected) ||
      (s.finalScore === best.finalScore && s.expected === best.expected && s.count > best.count)
    ) {
      recommendedHand = h;
      best = { finalScore: s.finalScore, expected: s.expected, winRate: s.winRate, count: s.count };
    }
  }

  return { stats, recommendedHand, best };
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState("input");
  const [sensitivity, setSensitivity] = useState(0.5); // 0..1
  const [alpha, setAlpha] = useState(0.8); // hybrid weight for expected (0..1)
  const [windowMode, setWindowMode] = useState("ALL"); // ALL | 10 | 30 | 50

  // initial load (local + remote merge)
  useEffect(() => {
    (async () => {
      try {
        let localRaw = loadRecords();
        if (!Array.isArray(localRaw)) localRaw = [];
        const localNormalized = localRaw.map(normalizeRecord).filter(Boolean);
        const mergedRaw = await fetchRemoteRecordsAndMerge(localNormalized);
        const merged = Array.isArray(mergedRaw) ? mergedRaw.map(normalizeRecord).filter(Boolean) : [];
        // dedupe simple
        const seen = new Set();
        const final = [];
        merged.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        for (const r of merged) {
          const k = `${r.date}|${r.result}|${r.hand}|${r.createdAt}`;
          if (!seen.has(k)) {
            final.push(r);
            seen.add(k);
          }
        }
        setRecords(final);
        try { await syncUp(final); } catch {}
      } catch (e) {
        console.warn("initial load fail", e);
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : [];
          setRecords((parsed || []).map(normalizeRecord).filter(Boolean));
        } catch {
          setRecords([]);
        }
      }
    })();
  }, []);

  // persist
  useEffect(() => {
    try {
      const normalized = (records || []).map(normalizeRecord).filter(Boolean);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.warn("save local failed", e);
    }
    try { saveRecords(records); } catch {}
  }, [records]);

  // add record
  function addRecord(result, hand) {
    const newRecord = normalizeRecord({
      date: selectedDate,
      result,
      hand,
      createdAt: Date.now(),
    });
    setHistory((h) => [...h, records.slice()]);
    setRecords((prev) => {
      const next = [...prev, newRecord];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      uploadRecord(newRecord).catch(() => {});
      return next;
    });
  }

  // undo
  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRecords(prev);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prev)); } catch {}
    try { saveRecords(prev); } catch {}
  }

  // delete
  async function deleteRecord(target) {
    if (!window.confirm("この記録を削除しますか？（元に戻せません）")) return;
    setHistory((h) => [...h, records.slice()]);
    const newLocal = records.filter((r) => r.createdAt !== target.createdAt);
    setRecords(newLocal);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocal)); } catch {}
    try { await deleteRecordOnServer(target); } catch {}
  }

  // filtered by windowMode (most recent N records) — before weighting
  const filteredByWindow = useMemo(() => {
    if (!records || records.length === 0) return [];
    if (windowMode === "ALL") return records.slice();
    const n = Number(windowMode);
    if (isNaN(n) || n <= 0) return records.slice();
    return records.slice(-n);
  }, [records, windowMode]);

  // compute recommendation using weighted stats on filteredRecords
  const weighted = useMemo(() => {
    return computeWeightedStats(filteredByWindow, { sensitivity, alpha });
  }, [filteredByWindow, sensitivity, alpha]);

  // sorted for display: newest first
  const sortedRecords = useMemo(() => {
    return [...filteredByWindow].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [filteredByWindow]);

  const averageScore = useMemo(() => {
    if (!filteredByWindow || filteredByWindow.length === 0) return 0;
    const sum = filteredByWindow.reduce((acc, r) => acc + (SCORE_MAP[r.result] || 0), 0);
    return Math.round((sum / filteredByWindow.length) * 100) / 100;
  }, [filteredByWindow]);

  return (
    <div className="container">
      <h1>じゃんけん記録</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`tab ${tab === "input" ? "active" : ""}`} onClick={() => setTab("input")}>入力</button>
          <button className={`tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>統計</button>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ textAlign: "right", marginRight: 8 }}>
            <div style={{ fontSize: 12, color: "#666" }}>平均得点</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{averageScore}</div>
          </div>

          {/* Window filter */}
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block" }}>Filter</label>
            <select value={windowMode} onChange={(e)=>setWindowMode(e.target.value)}>
              <option value="ALL">All</option>
              <option value="10">Last 10</option>
              <option value="30">Last 30</option>
              <option value="50">Last 50</option>
            </select>
          </div>

          {/* sensitivity */}
          <div style={{ minWidth: 180 }}>
            <label style={{ fontSize: 12, color: "#666", display: "block" }}>Recency sensitivity</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sensitivity}
              onChange={(e)=>setSensitivity(Number(e.target.value))}
              style={{ width: 150 }}
            />
          </div>

          {/* alpha */}
          <div style={{ minWidth: 180 }}>
            <label style={{ fontSize: 12, color: "#666", display: "block" }}>Expected vs WinRate</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={alpha}
              onChange={(e)=>setAlpha(Number(e.target.value))}
              style={{ width: 150 }}
            />
          </div>
        </div>
      </div>

      {tab === "input" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <label>
              日付
              <input type="date" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} style={{ marginLeft: 8 }} />
            </label>
          </div>

          <StylishInput
            onAdd={addRecord}
            defaultHand={weighted.recommendedHand || "✊"}
            defaultResult="勝ち"
            recommendedHand={weighted.recommendedHand}
            recommendationReason={`FinalScore: ${Math.round((weighted.best.finalScore||0)*100)/100}`}
            predictionStats={Object.fromEntries(Object.entries(weighted.stats).map(([k,v])=>[k, {expected: v.expected, winRate: v.winRate, count: v.count}]))}
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
                      <button onClick={() => deleteRecord(r)} style={{ marginRight: 8 }}>削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Stats
          records={filteredByWindow}
          scoreMap={SCORE_MAP}
          sensitivity={sensitivity}
        />
      )}
    </div>
  );
}
