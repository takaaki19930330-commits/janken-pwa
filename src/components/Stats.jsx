// src/components/Stats.jsx
import React, { useMemo } from "react";
import CumulativeChart from "./CumulativeChart";

const SCORE_MAP = { 勝ち: 40, あいこ: 20, 負け: 10 };

export default function Stats({ records, scoreMap = SCORE_MAP }) {
  // group by date and compute daily average or cumulative average by date
  const dates = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const d = r.date || "";
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(r);
    }
    // sort dates ascending
    const arr = Array.from(map.entries())
      .map(([date, arr]) => {
        const avg = arr.reduce((s, x) => s + (scoreMap[x.result] || 0), 0) / arr.length;
        return { date, avg };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    return arr;
  }, [records, scoreMap]);

  // cumulative average up to each date
  const cumulative = useMemo(() => {
    const out = [];
    let sum = 0;
    let count = 0;
    for (const d of dates) {
      // approximate: treat daily avg as if multiple items? we will weight by 1 per day
      // better: compute cumulative by counting all individual records up to that date
      // Build from full records for accuracy
    }
    // Accurate approach: sort records by date, compute running average per date-end
    const grouped = {};
    for (const r of records) {
      grouped[r.date] = grouped[r.date] || [];
      grouped[r.date].push(r);
    }
    const sortedDates = Object.keys(grouped).sort();
    let runningSum = 0;
    let runningCount = 0;
    const result = [];
    for (const dt of sortedDates) {
      for (const rec of grouped[dt]) {
        runningSum += scoreMap[rec.result] || 0;
        runningCount += 1;
      }
      result.push({
        date: dt,
        cumulativeAvg: runningCount ? runningSum / runningCount : 0,
      });
    }
    return result;
  }, [records, scoreMap]);

  const overallAvg = useMemo(() => {
    if (!records || records.length === 0) return 0;
    const sum = records.reduce((acc, r) => acc + (scoreMap[r.result] || 0), 0);
    return Math.round((sum / records.length) * 100) / 100;
  }, [records, scoreMap]);

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>統計</h2>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#666" }}>平均得点</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{overallAvg}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <CumulativeChart data={cumulative} expectedBaseline={(40 + 20 + 10) / 3} />
      </div>

      <div style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>日別サマリ</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>日付</th>
              <th style={{ textAlign: "left" }}>累積平均</th>
            </tr>
          </thead>
          <tbody>
            {cumulative.map((c) => (
              <tr key={c.date}>
                <td style={{ padding: "8px 0" }}>{c.date}</td>
                <td style={{ padding: "8px 0" }}>{Math.round(c.cumulativeAvg * 100) / 100}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
