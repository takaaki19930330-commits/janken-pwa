// src/App.js
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadRecords, saveRecords } from "./db";
import { uploadRecord, fetchRemoteRecordsAndMerge, syncUp } from "./sync";
import StylishInput from "./components/StylishInput";
import Stats from "./components/Stats";

/**
 * 正規化マップ：手の表記をすべて絵文字に揃える
 * 追加で入りうる表記はここに足す（例："グー","ぐー","GU","g" 等）
 */
const HAND_NORMALIZE = {
  "✊": "✊",
  "グー": "✊",
  "ぐー": "✊",
  "グー ": "✊",
  "GU": "✊",
  "g": "✊",
  "✌️": "✌️",
  "チョキ": "✌️",
  "ちょき": "✌️",
  "CHOKI": "✌️",
  "✋": "✋",
  "パー": "✋",
  "ぱー": "✋",
  "PA": "✋",
};

/**
 * 結果の正規化：勝ち/あいこ/負け に揃える
 */
const RESULT_NORMALIZE = {
  "勝ち": "勝ち",
  "負け": "負け",
  "あいこ": "あいこ",
  "引き分け": "あいこ",
  "draw": "あいこ",
  "win": "勝ち",
  "lose": "負け",
  "loss": "負け",
};

const SCORE_MAP = { 勝ち: 40, あいこ: 20, 負け: 10 };
const STORAGE_KEY = "janken_records_v1";

/** normalize single record: produce {date,hand,result,createdAt,...} */
function normalizeRecord(raw) {
  if (!raw) return null;
  const r = { ...raw };

  // normalize hand
  let rawHand = (r.hand || "").toString().trim();
  if (HAND_NORMALIZE[rawHand]) {
    r.hand = HAND_NORMALIZE[rawHand];
  } else {
    // try emoji-first: if raw includes emoji, extract the first emoji we know
    // fallback: search keys
    const found = Object.keys(HAND_NORMALIZE).find((k) => {
      return k && rawHand.indexOf(k) !== -1;
    });
    if (found) r.hand = HAND_NORMALIZE[found];
    else r.hand = rawHand; // leave as-is (will be ignored by stats if unknown)
  }

  // normalize result: trim and lowercase-ish
  let rawRes = (r.result || "").toString().trim();
  if (RESULT_NORMALIZE[rawRes]) r.result = RESULT_NORMALIZE[rawRes];
  else {
    const found = Object.keys(RESULT_NORMALIZE).find((k) => rawRes.toLowerCase().indexOf(k.toLowerCase()) !== -1);
    if (found) r.result = RESULT_NORMALIZE[found];
    else r.result = rawRes;
  }

  // ensure createdAt exists (ms)
  if (!r.createdAt) {
    if (r.created_at) r.createdAt = new Date(r.created_at).getTime();
    else r.createdAt = Date.now();
  } else {
    // if createdAt is string try parse
    if (typeof r.createdAt === "string" && !isNaN(Date.parse(r.createdAt))) {
      r.createdAt = new Date(r.createdAt).getTime();
    } else if (typeof r.createdAt !== "number") {
      r.createdAt = Number(r.createdAt) || Date.now();
    }
  }

  // ensure date string exists
  r.date = r.date ? r.date.toString() : new Date(r.createdAt).toISOString().slice(0, 10);

  return r;
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState("input"); // "input" | "stats"

  // 初期ロード：local -> merge remote -> normalize -> setRecords -> try syncUp
  useEffect(() => {
    (async () => {
      try {
        // load local raw
        let localRaw = loadRecords();
        if (!Array.isArray(localRaw)) localRaw = [];

        // ensure we normalize localRaw items
        const localNormalized = localRaw.map(normalizeRecord).filter(Boolean);

        // merge with remote which also will be normalized inside fetchRemoteRecordsAndMerge
        const mergedRaw = await fetchRemoteRecordsAndMerge(localNormalized);
        const merged = Array.isArray(mergedRaw) ? mergedRaw.map(normalizeRecord).filter(Boolean) : [];

        // final dedupe: use date|result|hand|createdAt uniqueness guard (prefer remote createdAt if exists)
        const seen = new Set();
        const final = [];
        // sort by createdAt ascending to keep older first in final array (we will display newest-first later)
        merged.sort((a,b)=> (a.createdAt||0)-(b.createdAt||0));
        for (const r of merged) {
          const k = `${r.date}|${r.result}|${r.hand}|${r.createdAt}`;
          if (!seen.has(k)) {
            final.push(r);
            seen.add(k);
          }
        }

        setRecords(final);
        try { await syncUp(final); } catch (e) {}
      } catch (e) {
        console.warn("initial load failed", e);
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

  // always keep localStorage in sync (persist normalized)
  useEffect(() => {
    try {
      const normalized = (records || []).map(normalizeRecord).filter(Boolean);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.warn("save local failed", e);
    }
    try { saveRecords(records); } catch (e) {}
  }, [records]);

  // Add createdAt and keep history for undo
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

  // sorted: newest first by createdAt
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const ta = a.createdAt ?? 0;
      const tb = b.createdAt ?? 0;
      if (tb !== ta) return tb - ta;
      if (a.date && b.date) return b.date.localeCompare(a.date);
      return 0;
    });
  }, [records]);

  // ---- Prediction logic: compute stats per hand (works even if some hands are unknown)
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

    for (const h of hands) {
      const s = statsByHand[h];
      if (s.count === 0) {
        s.expected = 0;
        s.winRate = 0;
        s.drawRate = 0;
        s.loseRate = 0;
      } else {
        s.expected = (s.win * SCORE_MAP["勝ち"] + s.draw * SCORE_MAP["あいこ"] + s.lose * SCORE_MAP["負け"]) / s.count;
        s.winRate = s.win / s.count;
        s.drawRate = s.draw / s.count;
        s.loseRate = s.lose / s.count;
      }
    }

    // choose best by expected -> winRate -> count
    let recommendedHand = null;
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

    const reason = recommendedHand
      ? `Expected: ${Math.round(best.expected * 100) / 100}, WinRate: ${(best.winRate * 100).toFixed(1)}% (${best.count} plays)`
      : "No data";

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
                  <tr key={r.createdAt ?? i}>
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
