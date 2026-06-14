/**
 * WarpCoin transaction model — a faithful port of core.Transaction (Go). The
 * canonical signing serialization is reproduced byte-for-byte so a transaction
 * signed in the browser is valid on the live chain:
 *
 *   signingBytes = string(From) || string(To) || u64(Amount) || u64(Fee)
 *                  || u64(Nonce) || i64(Timestamp) || string(PubKey)
 *   where string(s) = u64(len(s)) || utf8(s),  u64 = 8-byte big-endian.
 *
 *   SigningHash = sha256d(signingBytes)
 *   txid        = hex( sha256d( signingBytes || ascii(signatureHex) ) )
 */
import {
  bytesToHex,
  keyPairFromPrivateHex,
  sha256d,
  signDigest,
  validateAddress,
  verifyDigest,
  addressFromPubKey,
} from "./crypto";
import { hexToBytes } from "@noble/hashes/utils";

export const COINBASE_SENDER = "WARP_COINBASE";

export interface Transaction {
  from: string;
  to: string;
  amount: number; // flux (integer)
  fee: number; // flux (integer)
  nonce: number;
  timestamp: number; // unix seconds
  pubkey: string; // hex compressed public key
  signature: string; // hex 64-byte r||s
}

const encoder = new TextEncoder();

function u64BE(value: number | bigint): Uint8Array {
  const out = new Uint8Array(8);
  let v = BigInt(value);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function lenPrefixedString(s: string): Uint8Array {
  const body = encoder.encode(s);
  const out = new Uint8Array(8 + body.length);
  out.set(u64BE(body.length), 0);
  out.set(body, 8);
  return out;
}

function signingBytes(tx: Transaction): Uint8Array {
  const parts = [
    lenPrefixedString(tx.from),
    lenPrefixedString(tx.to),
    u64BE(tx.amount),
    u64BE(tx.fee),
    u64BE(tx.nonce),
    u64BE(tx.timestamp), // int64 written as the same 8-byte big-endian
    lenPrefixedString(tx.pubkey),
  ];
  const len = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return buf;
}

/** The 32-byte digest the sender signs, hex-encoded. */
export function signingHashHex(tx: Transaction): string {
  return bytesToHex(sha256d(signingBytes(tx)));
}

/** The transaction id (hex). Requires the signature to be set. */
export function txid(tx: Transaction): string {
  const sb = signingBytes(tx);
  const sig = encoder.encode(tx.signature);
  const all = new Uint8Array(sb.length + sig.length);
  all.set(sb, 0);
  all.set(sig, sb.length);
  return bytesToHex(sha256d(all));
}

export interface BuildTransferParams {
  to: string;
  amount: number; // flux
  fee: number; // flux
  nonce: number;
  privateKeyHex: string;
  timestamp?: number;
}

/** Build and sign a transfer transaction entirely client-side. */
export function buildSignedTransfer(params: BuildTransferParams): Transaction {
  const kp = keyPairFromPrivateHex(params.privateKeyHex);
  const tx: Transaction = {
    from: kp.address,
    to: params.to,
    amount: params.amount,
    fee: params.fee,
    nonce: params.nonce,
    timestamp: params.timestamp ?? Math.floor(Date.now() / 1000),
    pubkey: kp.publicKeyHex,
    signature: "",
  };
  tx.signature = signDigest(signingHashHex(tx), params.privateKeyHex);
  return tx;
}

/**
 * Stateless validation mirroring core.Transaction.Verify: structural sanity,
 * address well-formedness, pubkey↔address binding, and signature validity.
 * Balance/nonce are checked against ledger state elsewhere.
 */
export function verifyTransaction(tx: Transaction): {
  valid: boolean;
  reason: string;
} {
  if (tx.from === COINBASE_SENDER) return { valid: true, reason: "" };
  if (!Number.isInteger(tx.amount) || tx.amount <= 0)
    return { valid: false, reason: "amount must be a positive integer" };
  if (!Number.isInteger(tx.fee) || tx.fee < 0)
    return { valid: false, reason: "fee must be a non-negative integer" };
  if (!validateAddress(tx.to))
    return { valid: false, reason: `invalid recipient address ${tx.to}` };
  if (!validateAddress(tx.from))
    return { valid: false, reason: `invalid sender address ${tx.from}` };
  let pub: Uint8Array;
  try {
    pub = hexToBytes(tx.pubkey);
  } catch {
    return { valid: false, reason: "malformed public key" };
  }
  if (addressFromPubKey(pub) !== tx.from)
    return { valid: false, reason: "public key does not match sender address" };
  if (!verifyDigest(signingHashHex(tx), tx.signature, tx.pubkey))
    return { valid: false, reason: "invalid signature" };
  return { valid: true, reason: "" };
}

/** Serialize to the exact JSON shape the WarpCoin node RPC expects. */
export function toRPCJSON(tx: Transaction) {
  return {
    from: tx.from,
    to: tx.to,
    amount: tx.amount,
    fee: tx.fee,
    nonce: tx.nonce,
    timestamp: tx.timestamp,
    pubkey: tx.pubkey,
    signature: tx.signature,
  };
}
