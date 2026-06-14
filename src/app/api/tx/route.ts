import { submitTransaction } from "@/lib/server/node";
import type { Transaction } from "@/lib/warp/tx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let tx: Transaction;
  try {
    tx = (await req.json()) as Transaction;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await submitTransaction(tx);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ txid: result.txid, status: "accepted" });
}
