"use client";

import { useState } from "react";
import type { Household } from "@/types/db";
import { isProHousehold } from "@/lib/subscription";

type Props = {
  household: Household;
};

export function SubscriptionSection({ household }: Props) {
  const pro = isProHousehold(household);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);

  async function checkout() {
    setCheckoutBusy(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: household.id }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function portal() {
    setPortalBusy(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: household.id }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not open billing portal");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Portal failed");
    } finally {
      setPortalBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/50 p-5">
      <h2 className="font-headline text-lg font-bold text-on-surface">Chores+ Pro</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Support the app and help us ship integrations (maps, exports, and more). One subscription covers your whole
        household — both partners.
      </p>
      {pro ? (
        <p className="mt-3 text-sm font-semibold text-primary">You’re on Pro — thank you.</p>
      ) : (
        <ul className="mt-3 list-inside list-disc text-sm text-on-surface-variant">
          <li>Same fair VP rules; Pro funds the roadmap</li>
          <li>Cancel anytime from the billing portal</li>
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {pro ? (
          <button
            type="button"
            disabled={portalBusy}
            onClick={() => void portal()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary disabled:opacity-50"
          >
            {portalBusy ? "Opening…" : "Manage billing"}
          </button>
        ) : (
          <button
            type="button"
            disabled={checkoutBusy}
            onClick={() => void checkout()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary disabled:opacity-50"
          >
            {checkoutBusy ? "Redirecting…" : "Upgrade to Pro"}
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">
        Enable <code className="rounded bg-surface-container-highest px-1 font-mono text-[11px]">STRIPE_SECRET_KEY</code>,{" "}
        <code className="rounded bg-surface-container-highest px-1 font-mono text-[11px]">STRIPE_PRICE_ID_PRO</code>, and
        webhook signing secret in production for live billing.
      </p>
    </section>
  );
}
