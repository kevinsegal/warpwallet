import { compileContract } from "@/lib/warpscript/compile";
import type { ContractSpec } from "@/lib/warpscript/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Compile a spec to a deployable artifact WITHOUT persisting it (live preview). */
export async function POST(req: Request) {
  let body: { spec: ContractSpec };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const compiled = compileContract(body.spec);
  return Response.json({ compiled });
}
