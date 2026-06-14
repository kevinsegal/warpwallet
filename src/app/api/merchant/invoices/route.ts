import { createInvoice, listInvoices } from "@/lib/server/merchant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const merchantId = new URL(req.url).searchParams.get("merchantId");
  if (!merchantId)
    return Response.json({ error: "provide ?merchantId=" }, { status: 400 });
  const invoices = await listInvoices(merchantId);
  return Response.json({ invoices });
}

export async function POST(req: Request) {
  const apiKey =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.headers.get("x-api-key") ??
    "";
  let body: { amount: number; memo?: string; orderRef?: string; redirectUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await createInvoice(apiKey, body);
  if (!result.ok) {
    const status = result.error === "invalid API key" ? 401 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ invoice: result.invoice });
}
