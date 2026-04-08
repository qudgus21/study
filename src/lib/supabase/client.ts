import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder";

if (supabaseUrl === "https://placeholder.supabase.co" || supabaseServiceKey === "placeholder") {
  console.warn("Supabase: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});
