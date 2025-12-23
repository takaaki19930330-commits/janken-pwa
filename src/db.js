import { openDB } from "idb";

const DB_NAME = "janken-db";
const STORE_NAME = "records";

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function loadRecords() {
  const db = await getDB();
  return (await db.get(STORE_NAME, "data")) || [];
}

export async function saveRecords(records) {
  const db = await getDB();
  await db.put(STORE_NAME, records, "data");
}
