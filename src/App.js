// src/App.js
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadRecords, saveRecords } from "./db";
import { uploadRecord, fetchRemoteRecordsAndMerge, syncUp, deleteRecordOnServer } from "./sync";
import StylishInput from "./components/StylishInput";
import Stats from "./components/Stats";

const SCORE_MAP = { 勝ち: 40, あいこ: 20, 負け: 10 };
const STORAGE_KEY = "janken_records_v1";

function normalizeRecord(raw) {
  if (!raw) return null;
  const r = { ...raw };
  if (r.hand) r.hand = r.hand.toString().trim();
  if (r.result) r.result = r.result.toString().trim();
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

function daysAgo(ts) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return (Date.now() - ts) / msPerDay;
}

function computeWeightedStats(records, options) {
  const { sensitivity = 0.5, alpha = 0.8 } = options || {};
  const lambda = sensitivity * 0.45;
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
    const w = Math.exp(-lambda * age);
    const score = SCORE_MAP[r.result] || 0;
    const isWin = r.result === "勝ち" ? 1 : 0;
    stats[h].weightSum += w;
    stats[h].weightedScoreSum += w * score;
    stats[h].weightedWin += w * isWin;
    stats[h].count += 1;
  }

  for (const h of hands) {
    const s = stats[h];
    s.expected = s.weightSum > 0 ? s.weightedScoreSum / s.weightSum : 0;
    s.winRate = s.weightSum > 0 ? s.weightedWin / s.weightSum : 0;
    s.finalScore = alpha * s.expected + (1 - alpha) * (s.winRate * 40);
  }

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

  // default control values
  const DEFAULT_SENSITIVITY = 0.5;
  const DEFAULT_ALPHA = 0.8;
  const DEFAULT_WINDOW = "ALL";

  const [sensitivity, setSensitivity] = useState(DEFAULT_SENSITIVITY);
  const [alpha, setAlpha] = useState(DEFAULT_ALPHA);
  const [windowMode, setWindowMode] = useState(DEFAULT_WINDOW);

  useEffect(() => {
    (async () => {
      try {
        let localRaw = loadRecords();
        if (!Array.isArray(localRaw)) localRaw = [];
        const localNormalized = localRaw.map(normalizeRecord).filter(Boolean);
        const mergedRaw = await fetchRemoteRecordsAndMerge(localNormalized);
        const merged = Array.isArray(mergedRaw) ? mergedRaw.map(normalizeRecord).filter(Boolean) : [];
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

  useEffect(() => {
    try {
      const normalized = (records || []).map(normalizeRecord).filter(Boolean);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.warn("save local failed", e);
    }
    try { saveRecords(records); } catch {}
  }, [records]);

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

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRecords(prev);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prev)); } catch {}
    try { saveRecords(prev); } catch {}
  }

  async function deleteRecord(target) {
    if (!window.confirm("この記録を削除しますか？（元に戻せません）")) return;
    setHistory((h) => [...h, records.slice()]);
    const newLocal = records.filter((r) => r.createdAt !== target.createdAt);
    setRecords(newLocal);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocal)); } catch {}
    try { await deleteRecordOnServer(target); } catch {}
  }

  function resetControls() {
    setWindowMode(DEFAULT_WINDOW);
    setSensitivity(DEFAULT_SENSITIVITY);
    setAlpha(DEFAULT_ALPHA);
  }

  const filteredByWindow = useMemo(() => {
    if (!records || records.length === 0) return [];
    if (windowMode === "ALL") return records.slice();
    const n = Number(windowMode);
    if (isNaN(n) || n <= 0) return records.slice();
    return records.slice(-n);
  }, [records, windowMode]);

  const weighted = useMemo(() => {
    return computeWeightedStats(filteredByWindow, { sensitivity, alpha });
  }, [filteredByWindow, sensitivity, alpha]);

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
      <h1 className="title">じゃんけん記録</h1>

      <div className="top-controls">
        <div className="tabs">
          <button className={`tab ${tab === "input" ? "active" : ""}`} onClick={() => setTab("input")}>入力</button>
          <button className={`tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>統計</button>
        </div>

        <div className="right-controls">
          <div className="avg-wrap">
            <div className="avg-label">平均得点</div>
            <div className="avg-value">{averageScore}</div>
          </div>

          <div className="filter-wrap">
            <label className="filter-label">Filter</label>
            <select value={windowMode} onChange={(e)=>setWindowMode(e.target.value)}>
              <option value="ALL">All</option>
              <option value="10">Last 10</option>
              <option value="30">Last 30</option>
              <option value="50">Last 50</option>
            </select>
          </div>

          <div className="control-item">
            <div className="control-label">
              Recency sensitivity
              <span className="info" title="最近の記録をどれだけ重視するか。右にスライドすると“直近”の結果が急速に反映されます。">i</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sensitivity}
              onChange={(e)=>setSensitivity(Number(e.target.value))}
              className="slider"
            />
            <div className="control-help">0 = 長期平均寄り / 1 = 直近を強く反映</div>
          </div>

          <div className="control-item">
            <div className="control-label">
              Expected vs WinRate
              <span className="info" title="期待値(得点) と 勝率 のどちらを重視して推薦するか。右に寄せるほど期待値寄りです。">i</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={alpha}
              onChange={(e)=>setAlpha(Number(e.target.value))}
              className="slider"
            />
            <div className="control-help">0 = 勝率重視 / 1 = 期待値重視</div>
          </div>

          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <button onClick={resetControls} style={{padding:"8px 10px", borderRadius:8}}>Reset</button>
          </div>
        </div>
      </div>

      {tab === "input" ? (
        <>
          <div className="date-row">
            <label>日付</label>
            <input type="date" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} />
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
            <button onClick={undo} className="undo-btn">↩ 戻る</button>
          </div>

          <div className="records-table">
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>手</th>
                  <th>結果</th>
                  <th>得点</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((r, i) => (
                  <tr key={r.createdAt ?? i}>
                    <td>{r.date}</td>
                    <td>{r.hand}</td>
                    <td>{r.result}</td>
                    <td>{SCORE_MAP[r.result] ?? 0}</td>
                    <td><button onClick={() => deleteRecord(r)} className="del-btn">削除</button></td>
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
