import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !serviceKey || !url) {
    return NextResponse.json({ error: "Billing or database not configured" }, { status: 503 });
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

  const admin = createClient(url, serviceKey);
  const { data: household, error: hhErr } = await admin
    .from("households")
    .select("stripe_customer_id")
    .eq("id", householdId)
    .single();
  if (hhErr || !household?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing customer on file" }, { status: 400 });
  }

  const stripe = new Stripe(secret);
  const origin = siteOrigin(request);

  const portal = await stripe.billingPortal.sessions.create({
    customer: household.stripe_customer_id as string,
    return_url: `${origin}/account`,
  });

  return NextResponse.json({ url: portal.url });
}
