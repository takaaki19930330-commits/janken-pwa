// src/App.js
import React, { useEffect, useState } from "react";
import "./App.css";
import { loadRecords as loadLocalRecords, saveRecords as saveLocalRecords } from "./db";
import { initSupabase, insertRecord, loadAllRecords, subscribeRealtime } from "./sync";
import alg from "./algorithms";

console.log("APP VERSION 2025-12-23 14:45 - engine upgraded");

export default function App() {
  const [records, setRecords] = useState([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [selectedHand, setSelectedHand] = useState("✊");
  const [selectedResult, setSelectedResult] = useState("勝ち");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const opts = alg.defaultOptions();

  useEffect(() => {
    // load local first
    loadLocalRecords().then(local => {
      // try to load supabase and merge
      const sb = initSupabase();
      if (sb) {
        loadAllRecords().then(remote => {
          // merge dedupe by createdAt/id
          const all = [...local, ...remote];
          all.sort((a,b)=> (a.createdAt||0) - (b.createdAt||0));
          setRecords(all);
          setHistoryReady(true);
        }).catch(()=>{ setRecords(local); setHistoryReady(true); });
        // subscribe realtime
        subscribeRealtime((r) => {
          setRecords(prev => {
            const exists = prev.find(p=>p.id && p.id === r.id);
            if (exists) return prev;
            const next = [...prev, r].sort((a,b)=> (a.createdAt||0) - (b.createdAt||0));
            saveLocalRecords(next);
            return next;
          });
        });
      } else {
        setRecords(local);
        setHistoryReady(true);
      }
    });
  }, []);

  useEffect(() => {
    saveLocalRecords(records);
  }, [records]);

  function addRecord() {
    const rec = {
      id: `local-${Date.now()}`,
      date,
      hand: selectedHand,
      result: selectedResult,
      createdAt: Date.now()
    };
    setRecords(prev => {
      const next = [...prev, rec].sort((a,b)=> (a.createdAt||0) - (b.createdAt||0));
      // optimistic save to Supabase
      insertRecord(rec).catch(()=>{ /* ignore */ });
      return next;
    });
  }

  function deleteRecord(idOrIndex) {
    setRecords(prev => prev.filter((r,i)=> r.id !== idOrIndex && i !== idOrIndex));
    // Note: deleting from Supabase requires additional API & RLS config; skip optimistic server delete here
  }

  // compute recommendation for UI
  const rec = alg.recommendHand(records, opts);

  return (
    <div className="container">
      <h1 className="title">じゃんけん記録</h1>

      <div className="top-controls">
        <div className="tabs">
          <button className="tab active">入力</button>
          <button className="tab">統計</button>
        </div>

        <div className="right-controls">
          <div className="avg-wrap">
            <div className="avg-label">平均得点</div>
            <div className="avg-value">{Math.round((alg.computeStatsFromHistory(records).cumulative.slice(-1)[0]?.cumAvg || 0) * 100) / 100}</div>
          </div>
        </div>
      </div>

      <div className="date-row">
        <label>日付</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
      </div>

      <div className="recommend-row">
        <div className="rec-pill">
          <div style={{fontSize:22}}>{rec.hand}</div>
          <div className="rec-reason">FinalScore: {Math.round((rec.combined?.[rec.hand]||0)*100)/100}</div>
        </div>
      </div>

      <div className="hands-row">
        {["✊","✌️","✋"].map(h => (
          <div key={h} className={`hand-card ${selectedHand === h ? "selected":""}`} onClick={() => setSelectedHand(h)}>
            <div className="hand-emoji">{h}</div>
            <div className="hand-label">{h === "✊" ? "グー" : h === "✌️" ? "チョキ" : "パー" }</div>
          </div>
        ))}
      </div>

      <div className="result-row">
        {["勝ち","あいこ","負け"].map(r=>(
          <button key={r} className={`result-btn ${selectedResult === r ? "active":""}`} onClick={()=>setSelectedResult(r)}>{r}</button>
        ))}
      </div>

      <button className="add-btn" onClick={addRecord}>記録する</button>

      <div className="records-table">
        <table>
          <thead>
            <tr><th>日付</th><th>手</th><th>結果</th><th>得点</th><th>操作</th></tr>
          </thead>
          <tbody>
            {records.slice().reverse().map((r,i)=>(
              <tr key={r.id || i}>
                <td>{r.date}</td>
                <td>{r.hand}</td>
                <td>{r.result}</td>
                <td>{r.result === "勝ち" ? 40 : (r.result === "あいこ" ? 20 : 10)}</td>
                <td><button className="del-btn" onClick={()=>deleteRecord(r.id || i)}>削除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
