import { payInvoice } from "@/lib/server/merchant";
import type { Transaction } from "@/lib/warp/tx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let body: { tx: Transaction };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await payInvoice(id, body.tx);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ invoice: result.invoice, txid: result.txid });
}
