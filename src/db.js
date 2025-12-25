// src/db.js
// Load/save records with IndexedDB if available, otherwise localStorage.
// Always export functions that return Promises.

const DB_NAME = "janken-db";
const STORE_NAME = "records_v1";
const LOCAL_KEY = "janken_records_v1";

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null); // fall back gracefully
  });
}

export async function loadRecords() {
  const db = await openDB();
  if (!db) {
    // fallback to localStorage
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.warn("db.loadRecords: localStorage parse error", e);
      return [];
    }
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        resolve(req.result || []);
        db.close();
      };
      req.onerror = () => {
        resolve([]);
        db.close();
      };
    } catch (e) {
      console.warn("db.loadRecords indexeddb read error", e);
      resolve([]);
    }
  });
}

export async function saveRecords(records) {
  const db = await openDB();
  if (!db) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(records || []));
    } catch (e) {
      console.warn("db.saveRecords localStorage error", e);
    }
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      // Clear and re-add for simplicity
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        let i = 0;
        if (!records || records.length === 0) {
          resolve();
          db.close();
          return;
        }
        for (const r of records) {
          const addReq = store.add(r);
          addReq.onsuccess = () => {
            i++;
            if (i === records.length) {
              resolve();
              db.close();
            }
          };
          addReq.onerror = () => {
            i++;
            if (i === records.length) {
              resolve();
              db.close();
            }
          };
        }
      };
      clearReq.onerror = () => {
        // fallback to localStorage on error
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(records || [])); } catch(e){};
        resolve();
        db.close();
      };
    } catch (e) {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(records || [])); } catch(e){};
      resolve();
    }
  });
}
