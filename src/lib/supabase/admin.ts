import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

function getEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env && key in process.env) {
    return process.env[key];
  }
  if (typeof import.meta !== "undefined" && import.meta.env && key in import.meta.env) {
    return import.meta.env[key];
  }
  return undefined;
}

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

export const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase admin client not initialized. Check VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return supabaseAdmin;
}
