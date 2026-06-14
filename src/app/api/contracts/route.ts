import { deployContract, listContractsBy } from "@/lib/server/contracts";
import type { ContractSpec } from "@/lib/warpscript/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const author = new URL(req.url).searchParams.get("author") ?? "";
  const contracts = await listContractsBy(author);
  return Response.json({ contracts });
}

export async function POST(req: Request) {
  let body: { spec: ContractSpec };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await deployContract(body.spec);
  if (!result.ok)
    return Response.json({ error: result.error, warnings: result.warnings }, { status: 400 });
  return Response.json({ contract: result.contract, warnings: result.warnings });
}
