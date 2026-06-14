/**
 * Encrypted keystore. Private keys are encrypted at rest with AES-256-GCM using
 * a key derived from the user's passphrase via PBKDF2 (SHA-256, 310k iters).
 * The plaintext private key only ever exists transiently in memory after the
 * user unlocks; the ciphertext is what we persist to localStorage.
 */
import { keyPairFromPrivateHex } from "./crypto";

const PBKDF2_ITERATIONS = 310_000;

export interface EncryptedKeystore {
  version: 1;
  address: string;
  cipher: "AES-GCM";
  kdf: "PBKDF2";
  hash: "SHA-256";
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPrivateKey(
  privateKeyHex: string,
  password: string,
): Promise<EncryptedKeystore> {
  if (password.length < 8)
    throw new Error("passphrase must be at least 8 characters");
  const { address } = keyPairFromPrivateHex(privateKeyHex);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(privateKeyHex),
  );
  return {
    version: 1,
    address,
    cipher: "AES-GCM",
    kdf: "PBKDF2",
    hash: "SHA-256",
    iterations: PBKDF2_ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(new Uint8Array(ct)),
  };
}

export async function decryptPrivateKey(
  store: EncryptedKeystore,
  password: string,
): Promise<string> {
  const key = await deriveKey(
    password,
    fromB64(store.salt),
    store.iterations,
  );
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(store.iv) as BufferSource },
      key,
      fromB64(store.ciphertext),
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("incorrect passphrase");
  }
}
