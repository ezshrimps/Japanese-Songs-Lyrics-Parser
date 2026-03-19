import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { getSupabase } from "@/lib/supabase";

const SIGNUP_BONUS = 50;

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const svixId        = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await request.text();

  const wh = new Webhook(webhookSecret);
  let event: { type: string; data: { id: string } };
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: { id: string } };
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const userId = event.data.id;
    const db = getSupabase();

    await db.from("user_credits").upsert(
      { user_id: userId, balance: SIGNUP_BONUS, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    await db.from("credit_transactions").insert({
      user_id: userId,
      delta: SIGNUP_BONUS,
      reason: "signup_bonus",
    });
  }

  return NextResponse.json({ received: true });
}
