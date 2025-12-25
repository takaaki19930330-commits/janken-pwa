// src/sync.js
// Supabase sync helpers.
// Exports a named function migrateLocalToSupabase() which attempts to push locally-stored records
// to the Supabase `records` table. Safe if env/config missing.

import { createClient } from "@supabase/supabase-js";
import { loadRecords, saveRecords } from "./db";

/**
 * Create Supabase client if env vars present.
 * In React apps REACT_APP_* are inlined at build time.
 */
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * normalizeRecord: convert app-local record shape into DB columns
 * (adjust these keys to your DB schema).
 */
function normalizeRecord(r) {
  return {
    // keep device_id if present, otherwise mark as local
    device_id: r.device_id || r.deviceId || "local-device",
    date: r.date || (r.created_at ? r.created_at.slice(0, 10) : ""),
    result: r.result || r.outcome || "",
    hand: r.hand || "",
    created_at: r.created_at || new Date().toISOString(),
    // if you have an id/uuid in local model, include it; Supabase will ignore unknown keys if schema doesn't have them
    ...(r.id ? { id: r.id } : {})
  };
}

/**
 * migrateLocalToSupabase
 * - reads local records via loadRecords()
 * - if supabase configured, inserts them into `records` table
 * - returns an object { inserted, error, skipped }
 *
 * Important: this function is idempotent only if your DB schema has constraints or you dedupe.
 * We try a naive insert; adjust to upsert if your table has unique key constraints.
 */
export async function migrateLocalToSupabase() {
  try {
    const local = await loadRecords(); // always a Promise per db.js
    if (!local || local.length === 0) {
      return { inserted: 0, message: "no local records" };
    }

    if (!supabase) {
      // No config — keep local and tell caller
      return { inserted: 0, error: "no supabase config (REACT_APP_SUPABASE_URL / KEY missing)" };
    }

    // Map to DB shape
    const payload = local.map(normalizeRecord);

    // Try inserting in a single call (adjust upsert/duplicate handling as needed)
    const { data, error } = await supabase.from("records").insert(payload);
    if (error) {
      // if insert fails (eg duplicate PK), caller can decide what to do
      return { inserted: 0, error };
    }

    // On success: optionally clear local storage / save only server copy
    // Here we clear local store (you can change this behavior if you want to keep local only)
    try {
      await saveRecords([]); // clear local
    } catch (e) {
      // non-fatal: report but continue
      console.warn("migrate: failed to clear local after migrate", e);
    }

    return { inserted: Array.isArray(data) ? data.length : 0, data };
  } catch (err) {
    return { inserted: 0, error: err };
  }
}

/**
 * Optional small helper to push one record to supabase (used by UI if needed)
 */
export async function pushRecordToSupabase(record) {
  if (!supabase) return { error: "no supabase client" };
  try {
    const { data, error } = await supabase.from("records").insert([normalizeRecord(record)]);
    return { data, error };
  } catch (e) {
    return { error: e };
  }
}

// Default export (optional) — keep for compatibility if some code imports default.
export default {
  migrateLocalToSupabase,
  pushRecordToSupabase
};
