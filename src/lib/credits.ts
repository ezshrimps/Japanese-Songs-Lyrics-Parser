import { getSupabase } from "@/lib/supabase";

// ── Guest (IP-based) credit system ────────────────────────────────────────
// Unauthenticated users get 5 grammar parses per day.
export const DAILY_LIMIT = 5;

declare global {
  // eslint-disable-next-line no-var
  var grammarUsage: Map<string, { date: string; count: number }> | undefined;
}
if (!global.grammarUsage) global.grammarUsage = new Map();

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function getUsage(ip: string): { date: string; count: number } {
  const store = global.grammarUsage!;
  const entry = store.get(ip);
  if (!entry || entry.date !== today()) {
    const fresh = { date: today(), count: 0 };
    store.set(ip, fresh);
    return fresh;
  }
  return entry;
}

export function consumeCredit(ip: string): number {
  const entry = getUsage(ip);
  entry.count += 1;
  global.grammarUsage!.set(ip, entry);
  return Math.max(0, DAILY_LIMIT - entry.count);
}

export function remaining(ip: string): number {
  return Math.max(0, DAILY_LIMIT - getUsage(ip).count);
}

// ── Supabase (per-user) credit system ─────────────────────────────────────

export async function getSupabaseCredits(userId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();
  if (error || !data) return 0;
  return data.balance as number;
}

export async function consumeSupabaseCredit(userId: string): Promise<number> {
  return consumeSupabaseCredits(userId, 1);
}

export async function consumeSupabaseCredits(userId: string, n: number): Promise<number> {
  const current = await getSupabaseCredits(userId);
  if (current < n) throw new Error("积分不足");
  const newBalance = current - n;
  const { error } = await getSupabase()
    .from("user_credits")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error("积分扣除失败");
  await getSupabase().from("credit_transactions").insert({
    user_id: userId,
    delta: -n,
    reason: "grammar",
  });
  return newBalance;
}
