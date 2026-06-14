/**
 * Merchant payment gateway. Businesses register a payout address, mint an API
 * key, create invoices, and accept WARP at a hosted checkout. A paid invoice
 * fires an optional, HMAC-signed webhook so the merchant's backend can fulfill.
 */
import { createHmac } from "crypto";
import { validateAddress } from "../warp/crypto";
import { submitTransaction } from "./node";
import { getStore, newId } from "./store";
import type { Transaction } from "../warp/tx";

export interface Merchant {
  id: string;
  name: string;
  payoutAddress: string;
  apiKey: string;
  webhookUrl?: string;
  createdAt: number;
}

export type InvoiceStatus = "pending" | "paid" | "expired" | "canceled";

export interface Invoice {
  id: string;
  merchantId: string;
  merchantName: string;
  payoutAddress: string;
  amount: number; // flux
  memo: string;
  orderRef?: string;
  redirectUrl?: string;
  status: InvoiceStatus;
  createdAt: number;
  expiresAt: number;
  paidAt?: number;
  txid?: string;
  payerAddress?: string;
}

const mKey = (id: string) => `merchant:${id}`;
const iKey = (id: string) => `invoice:${id}`;

// --- merchants ---------------------------------------------------------------

export async function registerMerchant(input: {
  name: string;
  payoutAddress: string;
  webhookUrl?: string;
}): Promise<{ ok: boolean; error?: string; merchant?: Merchant }> {
  if (!input.name?.trim()) return { ok: false, error: "merchant name required" };
  if (!validateAddress(input.payoutAddress))
    return { ok: false, error: "invalid payout address" };
  const merchant: Merchant = {
    id: newId("mer"),
    name: input.name.trim(),
    payoutAddress: input.payoutAddress,
    apiKey: `wk_live_${newId()}`,
    webhookUrl: input.webhookUrl?.trim() || undefined,
    createdAt: Date.now(),
  };
  await getStore().set(mKey(merchant.id), merchant);
  return { ok: true, merchant };
}

export async function getMerchant(id: string): Promise<Merchant | null> {
  return getStore().get<Merchant>(mKey(id));
}

async function merchantByApiKey(apiKey: string): Promise<Merchant | null> {
  const all = await getStore().list<Merchant>("merchant:");
  return all.find((m) => m.apiKey === apiKey) ?? null;
}

// --- invoices ----------------------------------------------------------------

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function createInvoice(
  apiKey: string,
  input: { amount: number; memo?: string; orderRef?: string; redirectUrl?: string; ttlMs?: number },
): Promise<{ ok: boolean; error?: string; invoice?: Invoice }> {
  const merchant = await merchantByApiKey(apiKey);
  if (!merchant) return { ok: false, error: "invalid API key" };
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    return { ok: false, error: "amount must be a positive integer (flux)" };

  const now = Date.now();
  const invoice: Invoice = {
    id: newId("inv"),
    merchantId: merchant.id,
    merchantName: merchant.name,
    payoutAddress: merchant.payoutAddress,
    amount: input.amount,
    memo: input.memo ?? "",
    orderRef: input.orderRef,
    redirectUrl: input.redirectUrl,
    status: "pending",
    createdAt: now,
    expiresAt: now + (input.ttlMs ?? DEFAULT_TTL_MS),
  };
  await getStore().set(iKey(invoice.id), invoice);
  return { ok: true, invoice };
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const inv = await getStore().get<Invoice>(iKey(id));
  if (inv && inv.status === "pending" && Date.now() > inv.expiresAt) {
    inv.status = "expired";
    await getStore().set(iKey(id), inv);
  }
  return inv;
}

export async function listInvoices(merchantId: string): Promise<Invoice[]> {
  const all = await getStore().list<Invoice>("invoice:");
  return all
    .filter((i) => i.merchantId === merchantId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Pay an invoice with a client-signed transfer. The transfer is broadcast (and
 * its signature verified) by the node layer; we then confirm it pays the
 * merchant's payout address at least the invoice amount, mark the invoice paid,
 * and fire the webhook.
 */
export async function payInvoice(
  invoiceId: string,
  tx: Transaction,
): Promise<{ ok: boolean; error?: string; invoice?: Invoice; txid?: string }> {
  const inv = await getInvoice(invoiceId);
  if (!inv) return { ok: false, error: "invoice not found" };
  if (inv.status === "paid") return { ok: true, invoice: inv, txid: inv.txid };
  if (inv.status !== "pending") return { ok: false, error: `invoice is ${inv.status}` };
  if (tx.to !== inv.payoutAddress)
    return { ok: false, error: "payment recipient does not match invoice" };
  if (tx.amount < inv.amount)
    return { ok: false, error: "payment amount is less than invoice amount" };

  const result = await submitTransaction(tx);
  if (!result.ok) return { ok: false, error: result.error };

  inv.status = "paid";
  inv.paidAt = Date.now();
  inv.txid = result.txid;
  inv.payerAddress = tx.from;
  await getStore().set(iKey(inv.id), inv);

  void fireWebhook(inv);
  return { ok: true, invoice: inv, txid: result.txid };
}

async function fireWebhook(inv: Invoice) {
  const merchant = await getMerchant(inv.merchantId);
  if (!merchant?.webhookUrl) return;
  const payload = JSON.stringify({
    type: "invoice.paid",
    invoice: {
      id: inv.id,
      amount: inv.amount,
      orderRef: inv.orderRef,
      txid: inv.txid,
      payerAddress: inv.payerAddress,
      paidAt: inv.paidAt,
    },
  });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.WARP_WEBHOOK_SECRET;
  if (secret) {
    const sig = createHmac("sha256", secret).update(payload).digest("hex");
    headers["X-Warp-Signature"] = `sha256=${sig}`;
  }
  try {
    await fetch(merchant.webhookUrl, { method: "POST", headers, body: payload });
  } catch {
    // best-effort; a production gateway would retry with backoff
  }
}
