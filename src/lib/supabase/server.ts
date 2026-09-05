import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { parseCookies } from "../utils";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

function getAllCookies(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  return Object.entries(cookies).map(([name, value]) => ({ name, value }));
}

export function createSupabaseServerClient(request: Request) {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return getAllCookies(request);
      },
      setAll() {
        // Cannot set cookies here — handled at response level if needed.
      },
    },
  });
}

// Anon SSR client for public reads — enforces RLS (public can only see published)
export function createPublicClient() {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // no-op for public requests
      },
    },
  });
}
