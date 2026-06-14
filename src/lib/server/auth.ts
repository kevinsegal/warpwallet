/**
 * Signature-based authorization for state-changing operations. Sensitive actions
 * (claiming a warp#tag, releasing/refunding escrow) require the caller to sign a
 * canonical action string with their WarpCoin key. The server re-derives the
 * address from the public key and verifies the signature — the same trust model
 * as on-chain transactions, so no passwords or sessions are needed.
 */
import { addressFromPubKey, sha256d, verifyDigest, bytesToHex, hexToBytes } from "../warp/crypto";

export interface SignedAction {
  /** Canonical action string, e.g. "escrow:release:abc123". */
  action: string;
  /** Address the caller claims to be. */
  address: string;
  pubkey: string;
  signature: string;
}

/** Digest a caller signs to authorize an action. */
export function actionDigest(action: string): string {
  return bytesToHex(sha256d(new TextEncoder().encode(action)));
}

/**
 * Verify a signed action. Returns true only if the signature is valid AND the
 * public key derives to the claimed address AND (if expectedAddresses given) the
 * address is among the authorized set.
 */
export function verifySignedAction(
  signed: SignedAction,
  expectedAction: string,
  authorized?: string[],
): { ok: boolean; reason?: string } {
  if (signed.action !== expectedAction)
    return { ok: false, reason: "action mismatch" };
  let pub: Uint8Array;
  try {
    pub = hexToBytes(signed.pubkey);
  } catch {
    return { ok: false, reason: "malformed public key" };
  }
  if (addressFromPubKey(pub) !== signed.address)
    return { ok: false, reason: "public key does not match address" };
  if (!verifyDigest(actionDigest(expectedAction), signed.signature, signed.pubkey))
    return { ok: false, reason: "invalid signature" };
  if (authorized && !authorized.includes(signed.address))
    return { ok: false, reason: "address not authorized for this action" };
  return { ok: true };
}
