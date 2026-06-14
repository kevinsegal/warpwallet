/**
 * warp#tags — human-friendly handles that resolve to WarpCoin addresses, so
 * users can pay "warp#alice" instead of a long Base58 string. A tag is bound to
 * an address by a signature from that address's key (proof of ownership).
 */
import { getStore } from "./store";
import { verifySignedAction, type SignedAction } from "./auth";
import { isValidTag, normalizeTag } from "../warp/tag";

export interface TagRecord {
  tag: string; // normalized, without leading "warp#"
  address: string;
  createdAt: number;
}

const key = (tag: string) => `tag:${tag}`;

export { isValidTag, normalizeTag };

export async function resolveTag(input: string): Promise<TagRecord | null> {
  const tag = normalizeTag(input);
  if (!isValidTag(tag)) return null;
  return getStore().get<TagRecord>(key(tag));
}

export async function reverseLookup(address: string): Promise<string | null> {
  const all = await getStore().list<TagRecord>("tag:");
  return all.find((t) => t.address === address)?.tag ?? null;
}

export interface RegisterTagInput {
  tag: string;
  signed: SignedAction; // action: "warptag:register:<tag>:<address>"
}

export async function registerTag(
  input: RegisterTagInput,
): Promise<{ ok: boolean; error?: string; record?: TagRecord }> {
  const tag = normalizeTag(input.tag);
  if (!isValidTag(tag))
    return { ok: false, error: "tag must be 3–20 chars: a–z, 0–9, _" };

  const expected = `warptag:register:${tag}:${input.signed.address}`;
  const auth = verifySignedAction(input.signed, expected);
  if (!auth.ok) return { ok: false, error: auth.reason };

  const store = getStore();
  const existing = await store.get<TagRecord>(key(tag));
  if (existing && existing.address !== input.signed.address)
    return { ok: false, error: "tag already taken" };

  const record: TagRecord = {
    tag,
    address: input.signed.address,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  await store.set(key(tag), record);
  return { ok: true, record };
}
