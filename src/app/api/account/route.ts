import { getAccount, getHistory } from "@/lib/server/node";
import { reverseLookup } from "@/lib/server/tags";
import { validateAddress } from "@/lib/warp/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!validateAddress(address))
    return Response.json({ error: "invalid address" }, { status: 400 });

  const [account, history, tag] = await Promise.all([
    getAccount(address),
    getHistory(address),
    reverseLookup(address),
  ]);
  return Response.json({ account, history, tag });
}
