// sync.js
// Exports: initSupabase(), startSync(callback) - both are best-effort and safe if env not set.
export async function initSupabase() {
  // Try to initialize Supabase client only if env present
  try {
    const url = process.env.REACT_APP_SUPABASE_URL;
    const anon = process.env.REACT_APP_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      console.info("Supabase env not configured");
      return false;
    }
    // lazy import to avoid build errors if package missing
    const { createClient } = await import("@supabase/supabase-js");
    window.__SB = createClient(url, anon);
    console.info("Supabase initialized");
    return true;
  } catch (e) {
    console.warn("initSupabase failed", e);
    return false;
  }
}

export async function startSync(pullCallback) {
  // If supabase client exists, start a lightweight polling sync (best-effort)
  if (!window.__SB) return;
  try {
    // simple periodic poll every 20s to pull remote records and call callback
    setInterval(async () => {
      try {
        const { data, error } = await window.__SB.from("records").select("*").order("created_at", { ascending: false }).limit(100);
        if (!error) {
          // call user callback to refresh local view (the DB merge logic not implemented here)
          if (typeof pullCallback === "function") pullCallback();
        }
      } catch(e) { console.warn("sync poll failed", e); }
    }, 20000);
  } catch(e){ console.warn(e); }
}
