import { DEMO_MODE, getStatus } from "@/lib/server/node";
import { STORE_DURABLE } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getStatus();
  return Response.json({
    ...status,
    demoMode: DEMO_MODE,
    storeDurable: STORE_DURABLE,
  });
}
