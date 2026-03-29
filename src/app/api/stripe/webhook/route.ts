import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function proFromStripeStatus(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 503 });
  }
  const supabase = admin;

  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "verify failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  async function applySubscription(sub: Stripe.Subscription) {
    let householdId = sub.metadata?.household_id ?? null;
    if (!householdId) {
      const { data: row } = await supabase
        .from("households")
        .select("id")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();
      householdId = row?.id ?? null;
    }
    if (!householdId) return;
    await patchHousehold(householdId, sub);
  }

  async function patchHousehold(householdId: string, sub: Stripe.Subscription) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const pro = proFromStripeStatus(sub.status);
    const periodEndIso = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    await supabase
      .from("households")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        subscription_tier: pro ? "pro" : "free",
        pro_access_until: periodEndIso,
      })
      .eq("id", householdId);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const householdId = session.metadata?.household_id;
        const subId = session.subscription;
        if (!householdId || typeof subId !== "string") break;
        const sub = await stripe.subscriptions.retrieve(subId);
        await patchHousehold(householdId, sub);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await applySubscription(sub);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("stripe webhook handler", e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
