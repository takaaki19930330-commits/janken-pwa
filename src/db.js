// src/db.js
import { openDB } from "idb";

const DB_NAME = "janken-db";
const DB_VERSION = 1;
const STORE_NAME = "matches";
const LS_BACKUP_KEY = "janken_records_backup_v1";

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("by-date", "date");
      }
    },
  });
}

async function tryPersistStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const ok = await navigator.storage.persist();
      console.log("storage.persist() ->", ok);
    }
  } catch (e) {
    console.warn("persist request failed:", e);
  }
}

// NOTE: Save strategy changed: write localStorage synchronously first,
// then perform IndexedDB + caches writes asynchronously (best-effort).
export async function saveRecords(records) {
  // synchronous backup first
  try {
    const list = Array.isArray(records) ? records : [];
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("localStorage backup failed (sync):", e);
  }

  // attempt to persist storage (best-effort)
  tryPersistStorage().catch(() => {});

  // async: write to IndexedDB and caches
  (async () => {
    try {
      const list = Array.isArray(records) ? records : [];
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      await store.clear();
      for (const item of list) {
        const toAdd = { date: item.date, result: item.result, hand: item.hand };
        await store.add(toAdd);
      }
      await tx.done;
    } catch (e) {
      console.warn("IndexedDB write failed:", e);
    }

    try {
      if (window.caches) {
        const cache = await caches.open("janken-backups");
        const blob = new Blob([JSON.stringify(records)], { type: "application/json" });
        await cache.put("/__janken_backup__/records.json", new Response(blob));
      }
    } catch (e) {
      // ignore
    }
  })();
}

export async function loadRecords() {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const all = await store.getAll();
    if (Array.isArray(all) && all.length > 0) {
      return all.map((r) => ({ date: r.date, result: r.result, hand: r.hand }));
    }

    const raw = localStorage.getItem(LS_BACKUP_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // restore IndexedDB async (best-effort)
          (async () => {
            try {
              const db2 = await getDB();
              const tx2 = db2.transaction(STORE_NAME, "readwrite");
              const store2 = tx2.objectStore(STORE_NAME);
              await store2.clear();
              for (const item of parsed) {
                await store2.add({ date: item.date, result: item.result, hand: item.hand });
              }
              await tx2.done;
              console.log("Restored records from localStorage backup into IndexedDB:", parsed.length);
            } catch (e) {
              console.warn("Failed to restore backup into IndexedDB:", e);
            }
          })();
          return parsed;
        }
      } catch (e) {
        console.warn("Failed to parse localStorage backup:", e);
      }
    }

    // try caches backup
    try {
      if (window.caches) {
        const cache = await caches.open("janken-backups");
        const r = await cache.match("/__janken_backup__/records.json");
        if (r) {
          const text = await r.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      // ignore
    }

    return [];
  } catch (e) {
    console.warn("loadRecords error, falling back to localStorage:", e);
    try {
      const raw = localStorage.getItem(LS_BACKUP_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (ee) {
      return [];
    }
  }
}

export async function clearAllRecords() {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await tx.done;
  } catch (e) {
    console.warn("Failed to clear IndexedDB:", e);
  }
  try { localStorage.removeItem(LS_BACKUP_KEY); } catch (e) {}
  try {
    if (window.caches) {
      const cache = await caches.open("janken-backups");
      await cache.delete("/__janken_backup__/records.json");
    }
  } catch (e) {}
}
