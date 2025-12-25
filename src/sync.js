// src/sync.js
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase wrapper for janken-pwa
 * Exports:
 *  - initSupabase()
 *  - insertRecord(record)
 *  - loadAllRecords()
 *  - subscribeRealtime(callback)  // optional: real-time insert push
 */

let supabase = null;
export function initSupabase() {
  if (supabase) return supabase;
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("Supabase not initialized: missing REACT_APP_SUPABASE_* env vars");
    return null;
  }
  supabase = createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } });
  return supabase;
}

export async function insertRecord(record) {
  const db = initSupabase();
  if (!db) return null;
  const payload = {
    device_id: record.deviceId || null,
    date: record.date,
    result: record.result,
    hand: record.hand,
    created_at: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString()
  };
  const { data, error } = await db.from("records").insert([payload]);
  if (error) {
    console.error("Supabase insert error:", error);
    return { error };
  }
  return { data };
}

export async function loadAllRecords() {
  const db = initSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("records")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("Supabase load error:", error);
    return [];
  }
  // map to app record shape
  return data.map(r => ({
    id: r.id,
    deviceId: r.device_id,
    date: r.date,
    result: r.result,
    hand: r.hand,
    createdAt: new Date(r.created_at).getTime()
  }));
}

export function subscribeRealtime(onInsert) {
  const db = initSupabase();
  if (!db || !onInsert) return null;
  const channel = db.channel("public:records")
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'records' }, payload => {
      const r = payload.new;
      onInsert({
        id: r.id,
        deviceId: r.device_id,
        date: r.date,
        result: r.result,
        hand: r.hand,
        createdAt: new Date(r.created_at).getTime()
      });
    })
    .subscribe();
  return channel;
}
