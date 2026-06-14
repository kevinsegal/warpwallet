/**
 * Escrow service. A buyer locks funds; the seller delivers; funds release on
 * buyer (or arbiter) approval, or refund on dispute resolution. Every state
 * transition that moves money is authorized by a wallet signature from a party
 * permitted to make it. In demo mode the held funds move on the demo ledger; in
 * live mode the same transitions are realized as signed on-chain transactions.
 */
import { validateAddress } from "../warp/crypto";
import { demoCredit, demoDebit, DEMO_MODE } from "./node";
import { getStore, newId } from "./store";
import { verifySignedAction, type SignedAction } from "./auth";

export type EscrowStatus =
  | "created"
  | "funded"
  | "released"
  | "refunded"
  | "disputed";

export interface Escrow {
  id: string;
  buyer: string;
  seller: string;
  arbiter?: string;
  amount: number; // flux
  memo: string;
  status: EscrowStatus;
  createdAt: number;
  fundedAt?: number;
  resolvedAt?: number;
  events: { at: number; by: string; action: string; note?: string }[];
}

const key = (id: string) => `escrow:${id}`;

export async function getEscrow(id: string): Promise<Escrow | null> {
  return getStore().get<Escrow>(key(id));
}

export async function listEscrowsFor(address: string): Promise<Escrow[]> {
  const all = await getStore().list<Escrow>("escrow:");
  return all
    .filter((e) => [e.buyer, e.seller, e.arbiter].includes(address))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export interface CreateEscrowInput {
  buyer: string;
  seller: string;
  arbiter?: string;
  amount: number;
  memo: string;
}

export async function createEscrow(
  input: CreateEscrowInput,
): Promise<{ ok: boolean; error?: string; escrow?: Escrow }> {
  if (!validateAddress(input.buyer)) return { ok: false, error: "invalid buyer address" };
  if (!validateAddress(input.seller)) return { ok: false, error: "invalid seller address" };
  if (input.arbiter && !validateAddress(input.arbiter))
    return { ok: false, error: "invalid arbiter address" };
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    return { ok: false, error: "amount must be a positive integer (flux)" };

  const escrow: Escrow = {
    id: newId("esc"),
    buyer: input.buyer,
    seller: input.seller,
    arbiter: input.arbiter || undefined,
    amount: input.amount,
    memo: input.memo ?? "",
    status: "created",
    createdAt: Date.now(),
    events: [{ at: Date.now(), by: input.buyer, action: "created" }],
  };
  await getStore().set(key(escrow.id), escrow);
  return { ok: true, escrow };
}

async function save(e: Escrow) {
  await getStore().set(key(e.id), e);
}

/** Buyer funds the escrow (locks `amount`). */
export async function fundEscrow(
  id: string,
  signed: SignedAction,
): Promise<{ ok: boolean; error?: string; escrow?: Escrow }> {
  const e = await getEscrow(id);
  if (!e) return { ok: false, error: "escrow not found" };
  if (e.status !== "created") return { ok: false, error: `cannot fund a ${e.status} escrow` };
  const auth = verifySignedAction(signed, `escrow:fund:${id}`, [e.buyer]);
  if (!auth.ok) return { ok: false, error: auth.reason };

  if (DEMO_MODE) {
    const ok = await demoDebit(e.buyer, e.amount, `Escrow ${id} funding`);
    if (!ok) return { ok: false, error: "insufficient balance to fund escrow" };
  }
  e.status = "funded";
  e.fundedAt = Date.now();
  e.events.push({ at: Date.now(), by: e.buyer, action: "funded" });
  await save(e);
  return { ok: true, escrow: e };
}

/** Release held funds to the seller. Buyer or arbiter may release. */
export async function releaseEscrow(
  id: string,
  signed: SignedAction,
  note?: string,
): Promise<{ ok: boolean; error?: string; escrow?: Escrow }> {
  const e = await getEscrow(id);
  if (!e) return { ok: false, error: "escrow not found" };
  if (e.status !== "funded" && e.status !== "disputed")
    return { ok: false, error: `cannot release a ${e.status} escrow` };
  const authorized = [e.buyer, ...(e.arbiter ? [e.arbiter] : [])];
  const auth = verifySignedAction(signed, `escrow:release:${id}`, authorized);
  if (!auth.ok) return { ok: false, error: auth.reason };

  if (DEMO_MODE) await demoCredit(e.seller, e.amount, `Escrow ${id} release`);
  e.status = "released";
  e.resolvedAt = Date.now();
  e.events.push({ at: Date.now(), by: signed.address, action: "released", note });
  await save(e);
  return { ok: true, escrow: e };
}

/** Refund held funds to the buyer. Seller or arbiter may refund. */
export async function refundEscrow(
  id: string,
  signed: SignedAction,
  note?: string,
): Promise<{ ok: boolean; error?: string; escrow?: Escrow }> {
  const e = await getEscrow(id);
  if (!e) return { ok: false, error: "escrow not found" };
  if (e.status !== "funded" && e.status !== "disputed")
    return { ok: false, error: `cannot refund a ${e.status} escrow` };
  const authorized = [e.seller, ...(e.arbiter ? [e.arbiter] : [])];
  const auth = verifySignedAction(signed, `escrow:refund:${id}`, authorized);
  if (!auth.ok) return { ok: false, error: auth.reason };

  if (DEMO_MODE) await demoCredit(e.buyer, e.amount, `Escrow ${id} refund`);
  e.status = "refunded";
  e.resolvedAt = Date.now();
  e.events.push({ at: Date.now(), by: signed.address, action: "refunded", note });
  await save(e);
  return { ok: true, escrow: e };
}

/** Flag a dispute. Buyer or seller may dispute a funded escrow. */
export async function disputeEscrow(
  id: string,
  signed: SignedAction,
  note?: string,
): Promise<{ ok: boolean; error?: string; escrow?: Escrow }> {
  const e = await getEscrow(id);
  if (!e) return { ok: false, error: "escrow not found" };
  if (e.status !== "funded") return { ok: false, error: `cannot dispute a ${e.status} escrow` };
  const auth = verifySignedAction(signed, `escrow:dispute:${id}`, [e.buyer, e.seller]);
  if (!auth.ok) return { ok: false, error: auth.reason };

  e.status = "disputed";
  e.events.push({ at: Date.now(), by: signed.address, action: "disputed", note });
  await save(e);
  return { ok: true, escrow: e };
}
