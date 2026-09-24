import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let client: SupabaseClient | null = null;

// Storage/auth services accept either a legacy `eyJ…` JWT (recommended for the
// service key) or a first-party new-format key supabase-js knows how to send.
// Keys like `sb_service_sec_…` are not a valid format and Storage rejects them
// with "Invalid Compact JWS" even though the app booted without errors.
function isSupportedServiceKey(key: string): boolean {
  return key.startsWith("eyJ") || key.startsWith("sb_secret_");
}

export function getSupabaseServer(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured. Storage features are disabled.",
      );
    }
    return null;
  }
  if (supabaseServiceKey.startsWith("sb_") && !isSupportedServiceKey(supabaseServiceKey)) {
    console.error(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY looks unsupported (" +
        supabaseServiceKey.slice(0, 16) +
        "…). Use the legacy service_role JWT (Settings → API Keys → service_role, an eyJ… value) " +
        "or a first-party sb_secret_… key. Storage requests will be rejected by the server.",
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseServiceKey);
  }
  return client;
}

function getClientOrThrow(): SupabaseClient {
  const c = getSupabaseServer();
  if (!c) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return c;
}

// Backwards-compatible proxy: existing callers import `supabaseServer`
// directly. The Supabase client is created lazily on first property access so
// importing this module never crashes while env vars are missing.
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getClientOrThrow() as object, prop) as never;
  },
  set(_target, prop: string | symbol, value: unknown) {
    Reflect.set(getClientOrThrow() as object, prop, value);
    return true;
  },
});