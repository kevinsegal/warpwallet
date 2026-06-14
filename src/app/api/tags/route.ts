import { registerTag, resolveTag, reverseLookup } from "@/lib/server/tags";
import type { SignedAction } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const tag = params.get("tag");
  const address = params.get("address");
  if (tag) {
    const record = await resolveTag(tag);
    if (!record) return Response.json({ error: "tag not found" }, { status: 404 });
    return Response.json({ record });
  }
  if (address) {
    const t = await reverseLookup(address);
    return Response.json({ tag: t });
  }
  return Response.json({ error: "provide ?tag= or ?address=" }, { status: 400 });
}

export async function POST(req: Request) {
  let body: { tag: string; signed: SignedAction };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await registerTag({ tag: body.tag, signed: body.signed });
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ record: result.record });
}
