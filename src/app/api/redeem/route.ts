import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!code) {
    return NextResponse.json({ error: "请输入激活码" }, { status: 400 });
  }

  const db = getSupabase();

  // Look up the activation code
  const { data: codeRow, error: codeError } = await db
    .from("activation_codes")
    .select("*")
    .eq("code", code)
    .single();

  if (codeError || !codeRow) {
    return NextResponse.json({ error: "激活码无效" }, { status: 404 });
  }

  if (codeRow.redeemed_by) {
    return NextResponse.json({ error: "该激活码已被使用" }, { status: 409 });
  }

  const credits: number = codeRow.credits as number;

  // Mark code as redeemed
  await db
    .from("activation_codes")
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq("code", code);

  // Get current balance
  const { data: creditsRow } = await db
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  const currentBalance: number = (creditsRow?.balance as number) ?? 0;
  const newBalance = currentBalance + credits;

  // Update balance
  await db
    .from("user_credits")
    .upsert(
      { user_id: userId, balance: newBalance, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  // Record transaction
  await db.from("credit_transactions").insert({
    user_id: userId,
    delta: credits,
    reason: "redeem",
  });

  return NextResponse.json({ credits, newBalance });
}
