// src/db.js
const STORAGE_KEY = "janken_records_v1";

// 同期保存（即時・確実）
export function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error("saveRecords failed", e);
  }
}

// 読み込み
export function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("loadRecords failed", e);
    return [];
  }
}
