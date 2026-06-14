import { getMerchant, registerMerchant } from "@/lib/server/merchant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "provide ?id=" }, { status: 400 });
  const merchant = await getMerchant(id);
  if (!merchant) return Response.json({ error: "merchant not found" }, { status: 404 });
  // Never expose the API key on lookup; only on creation.
  const { apiKey: _apiKey, ...safe } = merchant;
  void _apiKey;
  return Response.json({ merchant: safe });
}

export async function POST(req: Request) {
  let body: { name: string; payoutAddress: string; webhookUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await registerMerchant(body);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  // Returned once: includes the API key. Store it securely, merchant.
  return Response.json({ merchant: result.merchant });
}
