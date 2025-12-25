// simple local DB utility with fallback to localStorage
const LS_KEY = "janken_records_v1";

export async function loadAllRecords() {
  try {
    // try IndexedDB
    if (window.indexedDB) {
      return await _idbGetAll();
    }
  } catch (e) {
    console.warn("idb load failed, falling back to localStorage", e);
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveRecord(record) {
  try {
    if (window.indexedDB) {
      await _idbPut(record);
      return;
    }
  } catch (e) {
    console.warn("idb put failed, falling back", e);
  }
  const arr = await loadAllRecords();
  arr.push(record);
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

export async function removeRecord(id) {
  try {
    if (window.indexedDB) {
      await _idbRemove(id);
      return;
    }
  } catch (e) {
    console.warn("idb remove failed, falling back", e);
  }
  const arr = (await loadAllRecords()).filter(r => (r.id || r.created_at) !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

/* ----- minimal IndexedDB helpers ----- */
const DB_NAME = "janken-db";
const STORE = "records";

function _openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function _idbGetAll() {
  const db = await _openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function _idbPut(rec) {
  const db = await _openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const r = store.add(rec);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function _idbRemove(id) {
  const db = await _openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const r = store.delete(id);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}
