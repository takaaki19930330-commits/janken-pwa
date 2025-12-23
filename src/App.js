import { useState, useEffect } from "react";

const SCORE_MAP = {
  win: 40,
  lose: 10,
  draw: 20,
};

export default function App() {
  const today = new Date().toISOString().slice(0, 10);

  const [records, setRecords] = useState([]);
  const [date, setDate] = useState(today);
  const [hand, setHand] = useState("rock");

  useEffect(() => {
    const saved = localStorage.getItem("jankenRecords");
    if (saved) setRecords(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("jankenRecords", JSON.stringify(records));
  }, [records]);

  const addRecord = (result) => {
    setRecords([
      ...records,
      {
        date,
        hand,
        result,
        score: SCORE_MAP[result],
      },
    ]);
  };

  const averageScore =
    records.length === 0
      ? 0
      : (
          records.reduce((sum, r) => sum + r.score, 0) / records.length
        ).toFixed(1);

  return (
    <div style={styles.container}>
      <h1>✊ じゃんけん記録</h1>

      {/* 日付入力 */}
      <div style={styles.block}>
        <label>
          日付：
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={styles.input}
          />
        </label>
      </div>

      {/* 手の選択 */}
      <div style={styles.block}>
        <label>
          自分の手：
          <select
            value={hand}
            onChange={(e) => setHand(e.target.value)}
            style={styles.input}
          >
            <option value="rock">グー</option>
            <option value="scissors">チョキ</option>
            <option value="paper">パー</option>
          </select>
        </label>
      </div>

      {/* 結果ボタン */}
      <div style={styles.buttons}>
        <button style={styles.win} onClick={() => addRecord("win")}>
          勝ち
        </button>
        <button style={styles.draw} onClick={() => addRecord("draw")}>
          あいこ
        </button>
        <button style={styles.lose} onClick={() => addRecord("lose")}>
          負け
        </button>
      </div>

      <p>記録数：{records.length}</p>
      <p>平均獲得点：{averageScore}</p>

      {/* 履歴 */}
      <ul style={styles.list}>
        {records
          .slice()
          .reverse()
          .map((r, i) => (
            <li key={i}>
              {r.date} ／ {handLabel(r.hand)} ／ {resultLabel(r.result)} ／{" "}
              {r.score}点
            </li>
          ))}
      </ul>
    </div>
  );
}

const handLabel = (hand) => {
  if (hand === "rock") return "グー";
  if (hand === "scissors") return "チョキ";
  if (hand === "paper") return "パー";
};

const resultLabel = (result) => {
  if (result === "win") return "勝ち";
  if (result === "draw") return "あいこ";
  if (result === "lose") return "負け";
};

const styles = {
  container: {
    maxWidth: 420,
    margin: "0 auto",
    padding: 16,
    textAlign: "center",
    fontSize: 18,
  },
  block: {
    marginBottom: 12,
  },
  input: {
    marginLeft: 8,
    fontSize: 16,
  },
  buttons: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  win: { flex: 1, margin: 4, padding: 20, fontSize: 18 },
  draw: { flex: 1, margin: 4, padding: 20, fontSize: 18 },
  lose: { flex: 1, margin: 4, padding: 20, fontSize: 18 },
  list: {
    textAlign: "left",
    maxHeight: 300,
    overflowY: "auto",
  },
};
