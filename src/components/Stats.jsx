import React, { useMemo } from "react";
import CumulativeChart from "./CumulativeChart";

export default function Stats({ records, scoreMap }) {
  // 日付順にグループ化（YYYY-MM-DD）
  const daily = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      map[r.date] = map[r.date] || { sum: 0, count: 0 };
      map[r.date].sum += scoreMap[r.result] || 0;
      map[r.date].count += 1;
    });
    const dates = Object.keys(map).sort();
    return dates.map((d) => ({
      date: d,
      avg: map[d].sum / map[d].count,
      sum: map[d].sum,
      count: map[d].count,
    }));
  }, [records, scoreMap]);

  // 累積平均（当日までの平均）
  const cumulative = useMemo(() => {
    const out = [];
    let cumSum = 0;
    let cumCount = 0;
    daily.forEach((d) => {
      cumSum += d.sum;
      cumCount += d.count;
      out.push({
        date: d.date,
        cumulativeAvg: cumCount ? cumSum / cumCount : 0,
      });
    });
    return out;
  }, [daily]);

  const overallAvg = useMemo(() => {
    if (records.length === 0) return 0;
    const total = records.reduce((acc, r) => acc + (scoreMap[r.result] || 0), 0);
    return Math.round((total / records.length) * 100) / 100;
  }, [records, scoreMap]);

  return (
    <div className="stats-container">
      <div className="stats-summary">
        <div>
          <div className="stats-label">総記録数</div>
          <div className="stats-value">{records.length}</div>
        </div>
        <div>
          <div className="stats-label">現在の平均得点</div>
          <div className="stats-value">{overallAvg}</div>
        </div>
      </div>

      <div className="chart-card">
        <h3>当日までの平均得点の推移（累積平均）</h3>
        <CumulativeChart data={cumulative} />
      </div>

      <div className="daily-table">
        <h4>日別（平均）</h4>
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th>日別平均</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{Math.round(d.avg * 100) / 100}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
