/** Isomorphic warp#tag helpers (safe to import on client and server). */

/** Normalize "Warp#Alice", "@alice", "alice" → "alice". */
export function normalizeTag(input: string): string {
  return input.trim().replace(/^warp#/i, "").replace(/^@/, "").toLowerCase();
}

export function isValidTag(tag: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(tag);
}
