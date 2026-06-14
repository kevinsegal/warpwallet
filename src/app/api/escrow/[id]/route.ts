import {
  disputeEscrow,
  fundEscrow,
  getEscrow,
  refundEscrow,
  releaseEscrow,
} from "@/lib/server/escrow";
import type { SignedAction } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const escrow = await getEscrow(id);
  if (!escrow) return Response.json({ error: "escrow not found" }, { status: 404 });
  return Response.json({ escrow });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let body: { action: string; signed: SignedAction; note?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { action, signed, note } = body;
  let result;
  switch (action) {
    case "fund":
      result = await fundEscrow(id, signed);
      break;
    case "release":
      result = await releaseEscrow(id, signed, note);
      break;
    case "refund":
      result = await refundEscrow(id, signed, note);
      break;
    case "dispute":
      result = await disputeEscrow(id, signed, note);
      break;
    default:
      return Response.json({ error: "unknown action" }, { status: 400 });
  }
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ escrow: result.escrow });
}
