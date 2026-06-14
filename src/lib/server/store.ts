/**
 * Minimal async key/value store powering shared, server-side state (warp#tags,
 * escrows, merchants, invoices, deployed contracts, and the demo ledger).
 *
 *  - If KV_REST_API_URL + KV_REST_API_TOKEN are set (Vercel KV / Upstash), state
 *    is persisted there and survives across serverless invocations.
 *  - Otherwise an in-memory map (stashed on globalThis to survive dev hot
 *    reloads) is used. This is perfect for local dev and demos; on serverless it
 *    is per-instance and ephemeral.
 */

export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  list<T>(prefix: string): Promise<T[]>;
}

// --- in-memory implementation ------------------------------------------------

const g = globalThis as unknown as { __warpStore?: Map<string, string> };
if (!g.__warpStore) g.__warpStore = new Map();
const mem = g.__warpStore;

const memoryStore: KVStore = {
  async get<T>(key: string) {
    const raw = mem.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async set<T>(key: string, value: T) {
    mem.set(key, JSON.stringify(value));
  },
  async del(key: string) {
    mem.delete(key);
  },
  async list<T>(prefix: string) {
    const out: T[] = [];
    for (const [k, v] of mem) if (k.startsWith(prefix)) out.push(JSON.parse(v) as T);
    return out;
  },
};

// --- Upstash/Vercel KV REST implementation (no extra dependency) -------------

function upstashStore(url: string, token: string): KVStore {
  async function cmd(args: (string | number)[]): Promise<unknown> {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`KV error ${res.status}`);
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) throw new Error(json.error);
    return json.result;
  }
  return {
    async get<T>(key: string) {
      const r = (await cmd(["GET", key])) as string | null;
      return r ? (JSON.parse(r) as T) : null;
    },
    async set<T>(key: string, value: T) {
      await cmd(["SET", key, JSON.stringify(value)]);
    },
    async del(key: string) {
      await cmd(["DEL", key]);
    },
    async list<T>(prefix: string) {
      const keys = (await cmd(["KEYS", `${prefix}*`])) as string[];
      if (!keys || keys.length === 0) return [];
      const vals = (await cmd(["MGET", ...keys])) as (string | null)[];
      return vals.filter(Boolean).map((v) => JSON.parse(v as string) as T);
    },
  };
}

let store: KVStore = memoryStore;
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
if (KV_URL && KV_TOKEN) store = upstashStore(KV_URL, KV_TOKEN);

export function getStore(): KVStore {
  return store;
}

/** Whether shared state is durable (KV configured) or ephemeral (memory). */
export const STORE_DURABLE = Boolean(KV_URL && KV_TOKEN);

/** Short, URL-safe random id. */
export function newId(prefix = ""): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return prefix ? `${prefix}_${id}` : id;
}
