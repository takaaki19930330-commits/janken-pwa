import { useEffect, useState } from "react";
import "./App.css";
import { loadRecords, saveRecords } from "./db";

console.log("APP VERSION 2025-12-23 14:45 - engine upgraded (App.js safe loader)");

export default function App() {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    // Try to dynamically load sync helpers if available (avoid static import errors)
    (async () => {
      try {
        const mod = await import("./sync");
        if (mod && typeof mod.initSupabase === "function") {
          try {
            mod.initSupabase();
            setStatusMsg("Cloud sync initialized");
          } catch (e) {
            console.warn("initSupabase failed:", e);
            setStatusMsg("Cloud sync init failed");
          }
        } else {
          setStatusMsg("Cloud sync not configured");
        }

        // Try to migrate local -> supabase if helper exists (best-effort)
        if (mod && typeof mod.migrateLocalToSupabase === "function") {
          try {
            const res = await mod.migrateLocalToSupabase();
            console.log("migrateLocalToSupabase:", res);
          } catch (e) {
            console.warn("migrateLocalToSupabase error:", e);
          }
        }
      } catch (e) {
        // dynamic import failed (module missing) — that's okay, continue
        console.warn("dynamic import of ./sync failed or not present:", e);
        setStatusMsg("Cloud sync unavailable");
      }
    })();

    // loadRecords may return Promise or direct array — handle both safely
    (async () => {
      try {
        const maybe = loadRecords();
        const resolved = await Promise.resolve(maybe);
        if (Array.isArray(resolved)) setRecords(resolved);
        else setRecords([]);
      } catch (e) {
        console.warn("loadRecords failed:", e);
        setRecords([]);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const maybe = saveRecords(records);
      // saveRecords might be Promise-like; handle it gracefully
      Promise.resolve(maybe).catch(e => console.warn("saveRecords promise failed:", e));
    } catch (e) {
      console.warn("saveRecords threw:", e);
    }
  }, [records]);

  function addRecord(result, hand) {
    setHistory(prev => [...prev, records]);
    setRecords(prev => [
      ...prev,
      {
        date: new Date().toISOString().slice(0, 10),
        result,
        hand,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setRecords(prev || []);
  }

  async function deleteRecord(index) {
    // remove by index (UI may pass index)
    setRecords(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="container">
      <h1>じゃんけん記録</h1>
      <div style={{marginBottom: 8, color: "#666"}}>{statusMsg}</div>

      <div className="buttons">
        <button onClick={() => addRecord("勝ち", "✊")}>✊ 勝ち</button>
        <button onClick={() => addRecord("負け", "✊")}>✊ 負け</button>
        <button onClick={() => addRecord("あいこ", "✊")}>✊ あいこ</button>

        <button onClick={() => addRecord("勝ち", "✌️")}>✌️ 勝ち</button>
        <button onClick={() => addRecord("負け", "✌️")}>✌️ 負け</button>
        <button onClick={() => addRecord("あいこ", "✌️")}>✌️ あいこ</button>

        <button onClick={() => addRecord("勝ち", "✋")}>✋ 勝ち</button>
        <button onClick={() => addRecord("負け", "✋")}>✋ 負け</button>
        <button onClick={() => addRecord("あいこ", "✋")}>✋ あいこ</button>
      </div>

      <button className="undo" onClick={undo}>
        ↩ 戻る
      </button>

      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>手</th>
            <th>結果</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i}>
              <td>{r.date}</td>
              <td>{r.hand}</td>
              <td>{r.result}</td>
              <td>
                <button onClick={() => deleteRecord(i)} aria-label={`delete-${i}`}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
