import { createEscrow, listEscrowsFor } from "@/lib/server/escrow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address) return Response.json({ error: "provide ?address=" }, { status: 400 });
  const escrows = await listEscrowsFor(address);
  return Response.json({ escrows });
}

export async function POST(req: Request) {
  let body: { buyer: string; seller: string; arbiter?: string; amount: number; memo?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await createEscrow({
    buyer: body.buyer,
    seller: body.seller,
    arbiter: body.arbiter,
    amount: body.amount,
    memo: body.memo ?? "",
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ escrow: result.escrow });
}
