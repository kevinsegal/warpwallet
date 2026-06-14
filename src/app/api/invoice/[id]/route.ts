import { getInvoice } from "@/lib/server/merchant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const invoice = await getInvoice(id);
  if (!invoice) return Response.json({ error: "invoice not found" }, { status: 404 });
  return Response.json({ invoice });
}
