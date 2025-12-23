// src/db.js
// Robust storage wrapper: IndexedDB (idb) + localStorage backup + automatic restore
import { openDB } from "idb";

const DB_NAME = "janken-db";
const DB_VERSION = 1;
const STORE_NAME = "matches";

// localStorage backup key (keep stable)
const LS_BACKUP_KEY = "janken_records_backup_v1";

/**
 * open database and ensure object store exists
 */
async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        // Keep an index on date for queries
        store.createIndex("by-date", "date");
      }
    },
  });
}

/**
 * Save records array to IndexedDB (replace all) and also write a localStorage backup.
 * We store records as an array of plain objects: { date, result, hand, id? }
 */
export async function saveRecords(records) {
  // Defensive: ensure array
  const list = Array.isArray(records) ? records : [];

  // Save to IndexedDB (clear store and bulk add)
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // Clear existing items then add new ones
  await store.clear();
  for (const item of list) {
    // avoid writing undefined props
    const toAdd = {
      date: item.date,
      result: item.result,
      hand: item.hand,
    };
    await store.add(toAdd);
  }
  await tx.done;

  // Also write a compact localStorage backup (fast restore if DB not available)
  try {
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("localStorage backup failed:", e);
  }
}

/**
 * Load records:
 * 1) Try to read from IndexedDB
 * 2) If empty and localStorage backup exists -> restore into IndexedDB and return backup
 * 3) Return array
 */
export async function loadRecords() {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const all = await store.getAll();

    if (Array.isArray(all) && all.length > 0) {
      // Normalize objects (remove internal ids if needed)
      return all.map((r) => ({
        date: r.date,
        result: r.result,
        hand: r.hand,
      }));
    }

    // If DB empty, try localStorage backup
    const raw = localStorage.getItem(LS_BACKUP_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Restore into IndexedDB (async, but return parsed immediately)
          (async () => {
            try {
              const db2 = await getDB();
              const tx2 = db2.transaction(STORE_NAME, "readwrite");
              const store2 = tx2.objectStore(STORE_NAME);
              // optional: clear first
              await store2.clear();
              for (const item of parsed) {
                await store2.add({
                  date: item.date,
                  result: item.result,
                  hand: item.hand,
                });
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

    return [];
  } catch (e) {
    console.warn("loadRecords error, falling back to localStorage:", e);
    // As a final fallback, try localStorage
    try {
      const raw = localStorage.getItem(LS_BACKUP_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (ee) {
      return [];
    }
  }
}

/**
 * Optional: clear all data (both DB and localStorage backup)
 */
export async function clearAllRecords() {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await store.clear();
    await tx.done;
  } catch (e) {
    console.warn("Failed to clear IndexedDB:", e);
  }
  try {
    localStorage.removeItem(LS_BACKUP_KEY);
  } catch (e) {
    console.warn("Failed to clear localStorage backup:", e);
  }
}
