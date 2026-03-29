import type { Session, SupabaseClient } from "@supabase/supabase-js";

/**
 * `INITIAL_SESSION` can briefly report no user before cookies/storage finish hydrating.
 * One `getSession()` read fixes the false "logged out" state without waiting on another event.
 */
export async function sessionOrRecover(
  supabase: SupabaseClient,
  session: Session | null,
): Promise<Session | null> {
  if (session?.user) return session;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}
