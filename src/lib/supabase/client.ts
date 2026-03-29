import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function stripOuterQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    const q = t[0];
    if ((q === '"' || q === "'") && t[t.length - 1] === q) {
      return t.slice(1, -1).trim();
    }
  }
  return t;
}

function isValidSupabaseHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Reads NEXT_PUBLIC_* Supabase settings. Next.js inlines these at **build time**;
 * if they are missing in Vercel when `next build` runs, the browser bundle has no URL and auth breaks.
 */
export function getPublicSupabaseEnv(): { url: string; key: string } | null {
  let url = stripOuterQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  let key = stripOuterQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  if (url === "undefined" || key === "undefined") {
    return null;
  }
  if (!url || !key || url.includes("YOUR_") || key.includes("YOUR_")) {
    return null;
  }
  if (!isValidSupabaseHttpUrl(url)) {
    return null;
  }
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getPublicSupabaseEnv() !== null;
}

/** Browser client: `@supabase/ssr` + PKCE; pair with `src/proxy.ts` for session refresh. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("getSupabaseBrowserClient is only for use in Client Components");
  }
  const env = getPublicSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase env missing or invalid. Set NEXT_PUBLIC_SUPABASE_URL (https://… .supabase.co) and NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "In Vercel they must be enabled for the environment you deploy **and** available at build time (redploy after changing them). " +
        "Avoid wrapping values in extra quotes.",
    );
  }
  return createBrowserClient(env.url, env.key);
}
