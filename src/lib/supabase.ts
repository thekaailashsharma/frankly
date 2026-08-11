import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — set them in .env.local. " +
      "Never put the service-role/secret key here: this file ships to every visitor's browser."
  );
}

// The anon/publishable key only — safe to ship client-side, everything it
// can do is bounded by the RLS policies in supabase/schema.sql. The
// service-role key from supabase.env must never appear in this bundle.
export const supabase = createClient(url, anonKey);
