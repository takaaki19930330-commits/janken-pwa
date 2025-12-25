// src/sync.js
// Supabase sync helpers with safe no-op behavior if env vars missing.
// Exports:
//   - initSupabase() => returns client or null
//   - migrateLocalToSupabase() => attempts migrating local records (Promise)
//   - pushRecordToSupabase(record) => insert one record (Promise)
//   - subscribeRealtime(onRecord) => subscribe to realtime inserts (returns unsubscribe function)

import { createClient } from "@supabase/supabase-js";
import { loadRecords, saveRecords } from "./db";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

let _supabase = null;
function initSupabase() {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("initSupabase: supabase env not configured");
    _supabase = null;
    return null;
  }
  try {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _supabase;
  } catch (e) {
    console.warn("initSupabase: createClient failed", e);
    _supabase = null;
    return null;
  }
}

function normalizeRecord(r) {
  return {
    device_id: r.device_id || r.deviceId || "local-device",
    date: r.date || (r.createdAt ? r.createdAt.slice(0,10) : ""),
    result: r.result || r.outcome || "",
    hand: r.hand || "",
    created_at: r.created_at || r.createdAt || new Date().toISOString(),
    ...(r.id ? { id: r.id } : {})
  };
}

export async function migrateLocalToSupabase() {
  try {
    const local = await loadRecords();
    if (!local || local.length === 0) return { inserted: 0, message: "no local records" };

    const client = initSupabase();
    if (!client) return { inserted: 0, error: "no supabase config" };

    const payload = local.map(normalizeRecord);
    const { data, error } = await client.from("records").insert(payload);
    if (error) return { inserted: 0, error };

    try { await saveRecords([]); } catch (e) { console.warn("migrateLocalToSupabase: clear local failed", e); }

    return { inserted: Array.isArray(data) ? data.length : 0, data };
  } catch (err) {
    return { inserted: 0, error: String(err) };
  }
}

export async function pushRecordToSupabase(record) {
  try {
    const client = initSupabase();
    if (!client) return { error: "no supabase client" };
    const { data, error } = await client.from("records").insert([normalizeRecord(record)]);
    if (error) return { error };
    return { data };
  } catch (e) {
    return { error: String(e) };
  }
}

/**
 * subscribeRealtime(onRecord)
 * - onRecord(record) will be called when a new record arrives via realtime (insert).
 * - Returns an unsubscribe() function. If realtime not available or not configured, returns noop.
 */
export function subscribeRealtime(onRecord) {
  try {
    const client = initSupabase();
    if (!client || !client.channel) {
      // older/newer supabase client versions differ - try best-effort
      console.warn("subscribeRealtime: supabase realtime not available or not configured");
      return { unsubscribe: () => {} };
    }

    // safe channel name
    const ch = client.channel("public:records").on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "records" },
      (payload) => {
        try { onRecord && onRecord(payload.new); } catch (e) { console.warn("subscribeRealtime onRecord failed", e); }
      }
    );

    // subscribe
    ch.subscribe((status, err) => {
      if (err) console.warn("realtime subscribe error", err);
    });

    return {
      unsubscribe: () => {
        try { ch.unsubscribe(); } catch(e) { /* ignore */ }
      }
    };
  } catch (e) {
    console.warn("subscribeRealtime failed", e);
    return { unsubscribe: () => {} };
  }
}

// default export for backward compatibility
export default {
  initSupabase,
  migrateLocalToSupabase,
  pushRecordToSupabase,
  subscribeRealtime
};
