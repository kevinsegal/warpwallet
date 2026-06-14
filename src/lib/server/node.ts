/**
 * Chain access layer. When WARP_RPC_URL is set, every call proxies to a real
 * WarpCoin full node (kevinsegal/Warpcoin JSON-RPC). Otherwise the app runs a
 * self-contained DEMO ledger backed by the KV store, so the whole product is
 * usable on a fresh Vercel deploy with zero infrastructure. New addresses get a
 * one-time demo faucet so users can immediately transact.
 */
import { FLUX_PER_WARP } from "../warp/format";
import { verifyTransaction, type Transaction, txid } from "../warp/tx";
import { getStore } from "./store";

const RPC = process.env.WARP_RPC_URL;
export const DEMO_MODE = !RPC;

const FAUCET_FLUX = 1000 * FLUX_PER_WARP; // 1000 WARP demo grant

export interface Account {
  address: string;
  balance: number; // flux
  nonce: number;
  faucetGranted?: boolean;
}

export interface TxRecord {
  txid: string;
  from: string;
  to: string;
  amount: number;
  fee: number;
  timestamp: number;
  status: "confirmed" | "pending";
  direction?: "in" | "out";
  memo?: string;
}

const ledgerKey = (addr: string) => `ledger:acct:${addr}`;
const historyKey = (addr: string) => `ledger:hist:${addr}`;

// --- real-node proxy ---------------------------------------------------------

async function rpcGet(path: string): Promise<Response> {
  return fetch(`${RPC}${path}`, { cache: "no-store" });
}

export async function getAccount(address: string): Promise<Account> {
  if (!DEMO_MODE) {
    const res = await rpcGet(`/balance?address=${encodeURIComponent(address)}`);
    if (!res.ok) throw new Error(`node balance ${res.status}`);
    const j = (await res.json()) as { balance: number; nonce: number };
    return { address, balance: j.balance, nonce: j.nonce };
  }
  const store = getStore();
  let acct = await store.get<Account>(ledgerKey(address));
  if (!acct) {
    acct = { address, balance: FAUCET_FLUX, nonce: 0, faucetGranted: true };
    await store.set(ledgerKey(address), acct);
  }
  return acct;
}

export async function getStatus(): Promise<Record<string, unknown>> {
  if (!DEMO_MODE) {
    const res = await rpcGet("/status");
    return (await res.json()) as Record<string, unknown>;
  }
  return {
    coin: "WarpCoin",
    ticker: "WARP",
    mode: "demo",
    note: "Self-contained demo ledger. Set WARP_RPC_URL to use a live node.",
  };
}

export async function getHistory(address: string): Promise<TxRecord[]> {
  if (!DEMO_MODE) {
    // The reference node does not index per-address history; return empty and
    // let the explorer handle history in production.
    return [];
  }
  const store = getStore();
  const hist = (await store.get<TxRecord[]>(historyKey(address))) ?? [];
  return hist.sort((a, b) => b.timestamp - a.timestamp);
}

async function appendHistory(address: string, rec: TxRecord) {
  const store = getStore();
  const hist = (await store.get<TxRecord[]>(historyKey(address))) ?? [];
  hist.push(rec);
  await store.set(historyKey(address), hist.slice(-200));
}

export interface SubmitResult {
  ok: boolean;
  txid?: string;
  error?: string;
}

/**
 * Validate and broadcast a signed transaction. The signature and address↔key
 * binding are verified here independently of the client — the server never
 * trusts the browser. In demo mode the transfer is applied to the KV ledger
 * with the same nonce/balance rules as the chain.
 */
export async function submitTransaction(tx: Transaction): Promise<SubmitResult> {
  const check = verifyTransaction(tx);
  if (!check.valid) return { ok: false, error: check.reason };

  if (!DEMO_MODE) {
    const res = await fetch(`${RPC}/tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tx),
    });
    const j = (await res.json()) as { txid?: string; error?: string };
    if (!res.ok || j.error) return { ok: false, error: j.error ?? `node ${res.status}` };
    return { ok: true, txid: j.txid };
  }

  // Demo ledger application — mirrors core blockchain rules.
  const sender = await getAccount(tx.from);
  if (tx.nonce !== sender.nonce)
    return { ok: false, error: `bad nonce: have ${sender.nonce}, tx ${tx.nonce}` };
  if (sender.balance < tx.amount + tx.fee)
    return { ok: false, error: "insufficient balance" };

  const recipient = await getAccount(tx.to);
  const store = getStore();
  sender.balance -= tx.amount + tx.fee;
  sender.nonce += 1;
  recipient.balance += tx.amount;
  await store.set(ledgerKey(sender.address), sender);
  await store.set(ledgerKey(recipient.address), recipient);

  const id = txid(tx);
  const ts = tx.timestamp;
  await appendHistory(tx.from, {
    txid: id, from: tx.from, to: tx.to, amount: tx.amount, fee: tx.fee,
    timestamp: ts, status: "confirmed", direction: "out",
  });
  await appendHistory(tx.to, {
    txid: id, from: tx.from, to: tx.to, amount: tx.amount, fee: tx.fee,
    timestamp: ts, status: "confirmed", direction: "in",
  });
  return { ok: true, txid: id };
}

/**
 * Internal demo-only ledger credit/debit used by escrow and merchant flows that
 * move funds without a user-signed P2P transaction (e.g. escrow release). In
 * live mode these are realized as real signed transactions by the parties, so
 * this is a no-op that callers must not rely on outside demo mode.
 */
export async function demoCredit(address: string, flux: number, memo: string) {
  if (!DEMO_MODE) return;
  const store = getStore();
  const acct = await getAccount(address);
  acct.balance += flux;
  await store.set(ledgerKey(address), acct);
  await appendHistory(address, {
    txid: `demo_${Date.now()}`, from: "WARP_ESCROW", to: address, amount: flux,
    fee: 0, timestamp: Math.floor(Date.now() / 1000), status: "confirmed",
    direction: "in", memo,
  });
}

export async function demoDebit(address: string, flux: number, memo: string): Promise<boolean> {
  if (!DEMO_MODE) return true;
  const store = getStore();
  const acct = await getAccount(address);
  if (acct.balance < flux) return false;
  acct.balance -= flux;
  await store.set(ledgerKey(address), acct);
  await appendHistory(address, {
    txid: `demo_${Date.now()}`, from: address, to: "WARP_ESCROW", amount: flux,
    fee: 0, timestamp: Math.floor(Date.now() / 1000), status: "confirmed",
    direction: "out", memo,
  });
  return true;
}
