import React, { useEffect, useState } from "react";
import "./App.css";
import StylishInput from "./components/StylishInput";
import CumulativeChart from "./components/CumulativeChart";
import Stats from "./components/Stats";
import { loadAllRecords, saveRecord, removeRecord } from "./db";
import { initSupabase, startSync } from "./sync";

function App() {
  const [records, setRecords] = useState([]);
  const [selectedHand, setSelectedHand] = useState(null);
  const [selectedResult, setSelectedResult] = useState("勝ち");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [avgScore, setAvgScore] = useState(0);
  const [cloudStatus, setCloudStatus] = useState("not-configured");

  useEffect(() => {
    // init supabase (safe if env not configured)
    initSupabase().then(status => setCloudStatus(status ? "ready" : "not-configured"));
    refresh();
    // start background sync if available (best-effort)
    startSync(() => refresh()).catch(()=>{});
  }, []);

  async function refresh() {
    const all = await loadAllRecords();
    // show newest first (most recent saved at top)
    const sorted = all.slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    setRecords(sorted);
    const avg = sorted.length ? Math.round(sorted.reduce((s,r)=>s + (r.score||0),0)/sorted.length*100)/100 : 0;
    setAvgScore(avg);
  }

  async function onRecord() {
    if (!selectedHand) {
      alert("手を選んでください");
      return;
    }
    // score mapping: 勝ち=20, あいこ=10, 負け=0 (example)
    const scoreMap = { "勝ち": 20, "あいこ": 10, "負け": 0 };
    const score = scoreMap[selectedResult] ?? 0;
    const rec = {
      device_id: "dev-" + (Math.random().toString(36).slice(2,9)),
      date,
      hand: selectedHand,
      result: selectedResult,
      score,
      created_at: new Date().toISOString()
    };
    await saveRecord(rec);
    await refresh();
    // reset input lightly
    setSelectedHand(null);
    setSelectedResult("勝ち");
  }

  async function onDelete(id) {
    // replace global confirm with window.confirm to satisfy ESLint rules
    if (!window.confirm("削除していいですか？")) return;
    await removeRecord(id);
    await refresh();
  }

  return (
    <div className="app-root">
      <header className="top">
        <h1>じゃんけん記録</h1>
        <div className="cloud-status">Cloud sync: <strong>{cloudStatus}</strong></div>
      </header>

      <main className="content">
        <section className="input-area">
          <div className="controls">
            <label className="date">
              日付
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </label>
            <div className="avg">平均得点 <div className="avg-value">{avgScore}</div></div>
          </div>

          <div className="recommendation">
            <div className="label">Recommendation</div>
            <div className="rec-pill">🟦 {/* placeholder */} FinalScore: {Math.round(avgScore)}</div>
          </div>

          <StylishInput
            selectedHand={selectedHand}
            onSelectHand={h=>setSelectedHand(h)}
            selectedResult={selectedResult}
            onSelectResult={r=>setSelectedResult(r)}
          />

          <div className="record-button-row">
            <button className="btn-record" onClick={onRecord}>記録する</button>
            <button className="btn-back" onClick={refresh}>↩ 戻る</button>
          </div>
        </section>

        <section className="chart-area">
          <h2>平均得点の推移</h2>
          <CumulativeChart records={records} />
        </section>

        <section className="stats-area">
          <Stats records={records} />
        </section>

        <section className="list-area">
          <table className="records-table">
            <thead>
              <tr>
                <th>日付</th><th>手</th><th>結果</th><th>得点</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id || r.created_at}>
                  <td>{r.date}</td>
                  <td>{r.hand}</td>
                  <td>{r.result}</td>
                  <td>{r.score}</td>
                  <td><button className="btn-delete" onClick={()=>onDelete(r.id || r.created_at)}>削除</button></td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan="5" style={{textAlign:"center", padding:"30px"}}>記録がありません</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>

      <footer className="footer">
        <small>App version: stylish-ui-restore</small>
      </footer>
    </div>
  );
}

export default App;
