import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function siteOrigin(request: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID_PRO;
  if (!secret || !priceId) {
    return NextResponse.json(
      { error: "Billing is not configured. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO." },
      { status: 503 },
    );
  }

  let body: { householdId?: string };
  try {
    body = (await request.json()) as { householdId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const householdId = body.householdId?.trim();
  if (!householdId) {
    return NextResponse.json({ error: "householdId required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();
  if (profErr || !profile || profile.household_id !== householdId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: household, error: hhErr } = await supabase
    .from("households")
    .select("id, stripe_customer_id")
    .eq("id", householdId)
    .single();
  if (hhErr || !household) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  const stripe = new Stripe(secret);
  const origin = siteOrigin(request);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/account?subscription=success`,
    cancel_url: `${origin}/account?subscription=cancel`,
    metadata: { household_id: householdId },
    subscription_data: {
      metadata: { household_id: householdId },
    },
  };

  const cust = household.stripe_customer_id as string | null | undefined;
  if (cust) {
    sessionParams.customer = cust;
  } else if (user.email) {
    sessionParams.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    return NextResponse.json({ error: "No checkout URL" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
