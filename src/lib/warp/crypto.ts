/**
 * WarpCoin cryptography — a faithful TypeScript port of the on-chain Go
 * implementation in `kevinsegal/Warpcoin` (internal/wallet). Everything here is
 * byte-compatible with the live chain:
 *
 *  - Curve:       NIST P-256 (secp256r1) ECDSA
 *  - Hash:        double SHA-256 ("sha256d")
 *  - PubKeyHash:  first 20 bytes of sha256d(compressedPubKey)
 *  - Address:     Base58Check( version(0x49) || pubKeyHash ) → starts with "W"
 *  - Signature:   64-byte r||s, low-S normalized (accepted by Go ecdsa.Verify)
 *
 * Keys are generated and used here; they NEVER leave the device unless the user
 * explicitly exports them. This module runs unchanged in the browser and in
 * Node/Edge runtimes, so the server can independently verify every signature.
 */
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

/** Address version byte. Mirrors core.AddressVersion (0x49) → addresses start "W". */
export const ADDRESS_VERSION = 0x49;
const PUBKEY_HASH_LEN = 20;

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Double SHA-256, the workhorse hash of WarpCoin. */
export function sha256d(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

/** First 20 bytes of sha256d(compressed pubkey). */
export function pubKeyHash(pubKey: Uint8Array): Uint8Array {
  return sha256d(pubKey).slice(0, PUBKEY_HASH_LEN);
}

// --- Base58 / Base58Check ----------------------------------------------------

export function base58Encode(input: Uint8Array): string {
  let x = 0n;
  for (const b of input) x = x * 256n + BigInt(b);

  let out = "";
  while (x > 0n) {
    const mod = Number(x % 58n);
    x = x / 58n;
    out = BASE58_ALPHABET[mod] + out;
  }
  // Preserve leading zero bytes as '1'.
  for (const b of input) {
    if (b !== 0) break;
    out = BASE58_ALPHABET[0] + out;
  }
  return out;
}

export function base58Decode(input: string): Uint8Array {
  let x = 0n;
  for (const ch of input) {
    const idx = BASE58_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("invalid base58 character");
    x = x * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (x > 0n) {
    bytes.unshift(Number(x % 256n));
    x = x / 256n;
  }
  // Restore leading zero bytes encoded as '1'.
  for (const ch of input) {
    if (ch !== BASE58_ALPHABET[0]) break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

function checksum(payload: Uint8Array): Uint8Array {
  return sha256d(payload).slice(0, 4);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Derive a Base58Check WarpCoin address from a compressed public key. */
export function addressFromPubKey(pubKey: Uint8Array): string {
  const payload = concat(Uint8Array.of(ADDRESS_VERSION), pubKeyHash(pubKey));
  return base58Encode(concat(payload, checksum(payload)));
}

/** Report whether a string is a well-formed WarpCoin address. */
export function validateAddress(addr: string): boolean {
  let raw: Uint8Array;
  try {
    raw = base58Decode(addr);
  } catch {
    return false;
  }
  if (raw.length !== 1 + PUBKEY_HASH_LEN + 4) return false;
  if (raw[0] !== ADDRESS_VERSION) return false;
  const payload = raw.slice(0, raw.length - 4);
  const want = raw.slice(raw.length - 4);
  const got = checksum(payload);
  for (let i = 0; i < 4; i++) if (want[i] !== got[i]) return false;
  return true;
}

// --- Keys & signatures -------------------------------------------------------

export interface KeyPair {
  /** 32-byte private scalar, hex-encoded. Treat as a secret. */
  privateKeyHex: string;
  /** 33-byte compressed public key, hex-encoded. */
  publicKeyHex: string;
  /** Base58Check WarpCoin address. */
  address: string;
}

export function keyPairFromPrivateHex(privateKeyHex: string): KeyPair {
  const priv = hexToBytes(privateKeyHex);
  if (priv.length !== 32) throw new Error("private key must be 32 bytes");
  const pub = p256.getPublicKey(priv, true); // compressed
  return {
    privateKeyHex: bytesToHex(priv),
    publicKeyHex: bytesToHex(pub),
    address: addressFromPubKey(pub),
  };
}

/** Generate a fresh, cryptographically random WarpCoin key pair. */
export function generateKeyPair(): KeyPair {
  const priv = p256.utils.randomPrivateKey();
  return keyPairFromPrivateHex(bytesToHex(priv));
}

/**
 * Sign a 32-byte digest, returning a 64-byte r||s signature (hex). low-S
 * normalization is applied so signatures are canonical; Go's ecdsa.Verify
 * accepts them regardless.
 */
export function signDigest(digestHex: string, privateKeyHex: string): string {
  const sig = p256.sign(hexToBytes(digestHex), hexToBytes(privateKeyHex), {
    lowS: true,
  });
  return bytesToHex(sig.toCompactRawBytes());
}

/** Verify a 64-byte r||s signature (hex) of a digest against a compressed pubkey. */
export function verifyDigest(
  digestHex: string,
  signatureHex: string,
  publicKeyHex: string,
): boolean {
  try {
    return p256.verify(
      hexToBytes(signatureHex),
      hexToBytes(digestHex),
      hexToBytes(publicKeyHex),
    );
  } catch {
    return false;
  }
}

export { bytesToHex, hexToBytes };
