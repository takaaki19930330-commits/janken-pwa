// src/db.js
import { openDB } from "idb";

const DB_NAME = "janken-db";
const DB_VERSION = 1;
const STORE_NAME = "matches";
const LS_BACKUP_KEY = "janken_records_backup_v1";

// candidate old DB names / store names to search for migrations
const CANDIDATE_DB_NAMES = ["janken-db", "janken-pwa", "janken", "records-db", "old-janken-db"];
const CANDIDATE_STORE_NAMES = ["matches", "records", "items", "entries", "janken"];

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

/** migrate any records found under other DB/store names into canonical DB. */
async function migrateFromOtherDBs() {
  // If browser supports indexedDB.databases(), use it to enumerate
  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      for (const d of dbs) {
        if (!d.name) continue;
        if (d.name === DB_NAME) continue;
        try {
          const openReq = indexedDB.open(d.name);
          openReq.onsuccess = async (e) => {
            const oldDb = e.target.result;
            try {
              for (let i = 0; i < oldDb.objectStoreNames.length; i++) {
                const storeName = oldDb.objectStoreNames[i];
                if (!CANDIDATE_STORE_NAMES.includes(storeName) && !storeName.toLowerCase().includes("match")) continue;
                const tx = oldDb.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);
                const all = await new Promise((res, rej) => {
                  const req = store.getAll();
                  req.onsuccess = () => res(req.result);
                  req.onerror = () => rej(req.error);
                });
                if (all && all.length > 0) {
                  // write into canonical DB
                  const db = await getDB();
                  const tx2 = db.transaction(STORE_NAME, "readwrite");
                  const store2 = tx2.objectStore(STORE_NAME);
                  for (const it of all) {
                    const toAdd = { date: it.date || it.created_at || "", result: it.result || it.outcome || "", hand: it.hand || it.move || "" };
                    await store2.add(toAdd);
                  }
                  await tx2.done;
                  console.log(`migrated ${all.length} items from ${d.name}/${storeName} to ${DB_NAME}/${STORE_NAME}`);
                }
              }
            } catch (e) {
              console.warn("migration inner error for", d.name, e);
            }
          };
        } catch (e) {
          /* ignore */
        }
      }
    } else {
      // fallback: try candidate DB names explicitly
      for (const name of CANDIDATE_DB_NAMES) {
        if (name === DB_NAME) continue;
        try {
          const openReq = indexedDB.open(name);
          openReq.onsuccess = async (e) => {
            const oldDb = e.target.result;
            for (let i = 0; i < oldDb.objectStoreNames.length; i++) {
              const storeName = oldDb.objectStoreNames[i];
              if (!CANDIDATE_STORE_NAMES.includes(storeName) && !storeName.toLowerCase().includes("match")) continue;
              const tx = oldDb.transaction(storeName, "readonly");
              const store = tx.objectStore(storeName);
              const all = await new Promise((res, rej) => {
                const req = store.getAll();
                req.onsuccess = () => res(req.result);
                req.onerror = () => rej(req.error);
              });
              if (all && all.length > 0) {
                const db = await getDB();
                const tx2 = db.transaction(STORE_NAME, "readwrite");
                const store2 = tx2.objectStore(STORE_NAME);
                for (const it of all) {
                  const toAdd = { date: it.date || it.created_at || "", result: it.result || it.outcome || "", hand: it.hand || it.move || "" };
                  await store2.add(toAdd);
                }
                await tx2.done;
                console.log(`migrated ${all.length} items from ${name}/${storeName} to ${DB_NAME}/${STORE_NAME}`);
              }
            }
          };
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn("migrateFromOtherDBs failed:", e);
  }
}

export async function saveRecords(records) {
  // try to persist storage (best-effort)
  tryPersistStorage().catch(()=>{});

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

  try {
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("localStorage backup failed:", e);
  }

  // Also try to store a cache-backed JSON for one more layer (best-effort)
  try {
    if (window.caches) {
      const blob = new Blob([JSON.stringify(list)], { type: "application/json" });
      const resp = new Response(blob);
      const cache = await caches.open("janken-backups");
      await cache.put("/__janken_backup__/records.json", resp);
    }
  } catch (e) {
    // non-fatal
  }
}

export async function loadRecords() {
  // attempt migration first (best-effort, async)
  migrateFromOtherDBs().catch(() => {});

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const all = await store.getAll();
    if (Array.isArray(all) && all.length > 0) {
      return all.map((r) => ({ date: r.date, result: r.result, hand: r.hand }));
    }

    // try localStorage backup if DB empty
    const raw = localStorage.getItem(LS_BACKUP_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // restore async to IndexedDB
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
  try {
    localStorage.removeItem(LS_BACKUP_KEY);
  } catch (e) {}
  try {
    if (window.caches) {
      const cache = await caches.open("janken-backups");
      await cache.delete("/__janken_backup__/records.json");
    }
  } catch (e) {}
}
