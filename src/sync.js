// src/sync.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEVICE_KEY = "janken_device_id_v1";

function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "dev-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (e) {
    console.warn("getDeviceId failed", e);
    return "dev-unknown";
  }
}

// 1件アップロード
export async function uploadRecord(record) {
  try {
    const device_id = getDeviceId();
    const payload = {
      device_id,
      date: record.date,
      result: record.result,
      hand: record.hand,
    };
    const { error } = await supabase.from("records").insert(payload);
    if (error) {
      console.warn("uploadRecord error", error);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e) {
    console.warn("uploadRecord exception", e);
    return { ok: false, error: e };
  }
}

// fetch remote records for this device and merge (remote first, then local for dedupe)
// Important: include created_at -> createdAt (ms) so front-end sorting by timestamp works
export async function fetchRemoteRecordsAndMerge(localRecords = []) {
  try {
    const device_id = getDeviceId();
    const { data, error } = await supabase
      .from("records")
      .select("date,result,hand,created_at")
      .eq("device_id", device_id)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("fetchRemoteRecords error", error);
      return localRecords;
    }

    // Normalize remote rows to include createdAt (ms)
    const remoteNormalized = (data || []).map((r) => ({
      date: r.date,
      result: r.result,
      hand: r.hand,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }));

    // merge remote (first) then local (dedupe)
    const key = (r) => `${r.date}|${r.result}|${r.hand}`;
    const seen = new Set();
    const merged = [];

    for (const r of remoteNormalized) {
      const k = key(r);
      if (!seen.has(k)) {
        merged.push(r);
        seen.add(k);
      }
    }

    for (const r of localRecords) {
      const k = key(r);
      if (!seen.has(k)) {
        // ensure local items have createdAt (if user created before change)
        const withCreated = {
          date: r.date,
          result: r.result,
          hand: r.hand,
          createdAt: r.createdAt ?? Date.now(),
        };
        merged.push(withCreated);
        seen.add(k);
      }
    }

    // Save merged locally (ensure createdAt persisted)
    try {
      localStorage.setItem("janken_records_v1", JSON.stringify(merged));
    } catch (e) {
      console.warn("save merged local failed", e);
    }

    return merged;
  } catch (e) {
    console.warn("fetchRemoteRecordsAndMerge exception", e);
    return localRecords;
  }
}

// bulk upload any local-only records not yet on server
export async function syncUp(localRecords = []) {
  try {
    const device_id = getDeviceId();
    const { data: remote = [], error: rerr } = await supabase
      .from("records")
      .select("date,result,hand")
      .eq("device_id", device_id);

    if (rerr) {
      console.warn("syncUp fetch remote failed", rerr);
      return { ok: false, error: rerr };
    }

    const remoteKeys = new Set(remote.map((r) => `${r.date}|${r.result}|${r.hand}`));
    const toUpload = localRecords.filter((r) => !remoteKeys.has(`${r.date}|${r.result}|${r.hand}`));

    for (const r of toUpload) {
      const { error } = await supabase.from("records").insert({
        device_id,
        date: r.date,
        result: r.result,
        hand: r.hand,
      });
      if (error) console.warn("syncUp insert error", error);
    }

    return { ok: true, uploaded: toUpload.length };
  } catch (e) {
    console.warn("syncUp exception", e);
    return { ok: false, error: e };
  }
}
