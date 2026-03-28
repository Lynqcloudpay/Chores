"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MobileShell } from "@/components/MobileShell";
import { ChoreVpSettings } from "@/components/ChoreVpSettings";
import { ResetHouseholdSection } from "@/components/ResetHouseholdSection";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sessionOrRecover } from "@/lib/supabase/session";
import type { Household, Profile } from "@/types/db";

export default function AccountPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (!prof) {
      setProfile(null);
      setPartner(null);
      setHousehold(null);
      return;
    }
    setProfile(prof as Profile);
    const hid = (prof as Profile).household_id;
    const [hhRes, othersRes] = await Promise.all([
      supabase.from("households").select("*").eq("id", hid).single(),
      supabase.from("profiles").select("*").eq("household_id", hid).neq("id", uid),
    ]);
    if (hhRes.error) setHousehold(null);
    else setHousehold(hhRes.data as Household);
    if (othersRes.error) setPartner(null);
    else setPartner((othersRes.data?.[0] as Profile | undefined) ?? null);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      let effective = session;
      if (event === "INITIAL_SESSION") {
        effective = await sessionOrRecover(supabase, session);
      }
      const uid = effective?.user?.id ?? null;
      setEmail(effective?.user?.email ?? null);
      setUserId(uid);
      if (uid) {
        setLoading(true);
        void load(uid).finally(() => setLoading(false));
      } else {
        setEmail(null);
        setProfile(null);
        setPartner(null);
        setHousehold(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [load]);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw1.length < 6) {
      setPwMsg("Use at least 6 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setPwMsg("New passwords do not match.");
      return;
    }
    setPwBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setPwBusy(false);
    if (error) {
      setPwMsg(error.message);
      return;
    }
    setPw1("");
    setPw2("");
    setPwMsg("Password updated.");
  }

  async function copyInvite() {
    if (!household?.invite_code) return;
    setCopyMsg(null);
    try {
      await navigator.clipboard.writeText(household.invite_code);
      setCopyMsg("Copied");
      window.setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg("Could not copy — select and copy manually.");
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-on-surface-variant">
        Configure Supabase env vars first.
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <p className="text-on-surface-variant">
          <Link href="/login" className="font-semibold text-primary underline">
            Sign in
          </Link>{" "}
          to manage your account.
        </p>
      </div>
    );
  }

  return (
    <MobileShell active="account">
      <AppHeader displayName={profile?.display_name} />
      <main className="mx-auto w-full max-w-2xl space-y-8 px-3 pb-32 pt-6 sm:px-4 sm:pb-40">
        <div>
          <Link
            href="/"
            className="text-sm font-semibold text-primary underline underline-offset-2"
          >
            ← Back to home
          </Link>
          <h1 className="mt-3 font-headline text-2xl font-bold text-on-surface">Account</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Security, chore VP defaults, invite, and data controls.
          </p>
        </div>

        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : (
          <>
            <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/50 p-5">
              <h2 className="font-headline text-lg font-bold text-on-surface">Sign-in &amp; password</h2>
              {email ? (
                <p className="mt-1 text-sm text-on-surface-variant">Signed in as {email}</p>
              ) : null}
              <form onSubmit={changePassword} className="mt-4 space-y-3">
                <label className="block text-sm font-semibold text-on-surface">
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={pw1}
                    onChange={(e) => setPw1(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3 text-on-surface"
                  />
                </label>
                <label className="block text-sm font-semibold text-on-surface">
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3 text-on-surface"
                  />
                </label>
                {pwMsg ? (
                  <p className={`text-sm ${pwMsg.startsWith("Password updated") ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-300"}`}>
                    {pwMsg}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={pwBusy || pw1.length < 1}
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary disabled:opacity-50"
                >
                  {pwBusy ? "Saving…" : "Update password"}
                </button>
              </form>
            </section>

            {household && profile ? (
              <ChoreVpSettings
                household={household}
                profile={profile}
                partner={partner}
                onRefresh={async () => {
                  await load(userId);
                }}
              />
            ) : null}

            {household ? (
              <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/50 p-5">
                <h2 className="font-headline text-lg font-bold text-on-surface">Invite partner</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Share this code so the other person can join your household during sign-up.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="rounded-lg bg-surface-container-highest px-3 py-2 font-mono text-lg font-bold tracking-wider text-on-surface">
                    {household.invite_code}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyInvite()}
                    className="rounded-full border border-outline-variant/30 px-4 py-2 text-sm font-semibold text-primary"
                  >
                    Copy code
                  </button>
                  {copyMsg ? <span className="text-xs text-on-surface-variant">{copyMsg}</span> : null}
                </div>
              </section>
            ) : null}

            {household ? (
              <ResetHouseholdSection
                householdId={household.id}
                onResetComplete={async () => {
                  await load(userId);
                }}
              />
            ) : null}

            <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/50 p-5">
              <h2 className="font-headline text-lg font-bold text-on-surface">Sign out</h2>
              <p className="mt-1 text-sm text-on-surface-variant">End this session on this device.</p>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-4 rounded-full border border-outline-variant/40 px-5 py-2.5 text-sm font-semibold text-on-surface"
              >
                Sign out
              </button>
            </section>
          </>
        )}
      </main>
    </MobileShell>
  );
}
