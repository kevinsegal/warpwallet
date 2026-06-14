/** Amount helpers. 1 WARP = 100,000,000 flux (8 decimals), mirroring core.Flux. */

export const DECIMALS = 8;
export const FLUX_PER_WARP = 100_000_000;
export const TICKER = "WARP";

/** Parse a human WARP string ("12.5") into integer flux, without float error. */
export function warpToFlux(input: string | number): number {
  const s = String(input).trim();
  if (s === "" || !/^\d*\.?\d*$/.test(s)) throw new Error("invalid amount");
  const [whole, frac = ""] = s.split(".");
  if (frac.length > DECIMALS)
    throw new Error(`at most ${DECIMALS} decimal places`);
  const padded = (frac + "0".repeat(DECIMALS)).slice(0, DECIMALS);
  const flux = BigInt(whole || "0") * BigInt(FLUX_PER_WARP) + BigInt(padded);
  return Number(flux);
}

/** Format integer flux as a human WARP string, trimming trailing zeros. */
export function fluxToWarp(flux: number): string {
  const neg = flux < 0;
  const v = BigInt(Math.abs(Math.round(flux)));
  const whole = v / BigInt(FLUX_PER_WARP);
  const frac = (v % BigInt(FLUX_PER_WARP))
    .toString()
    .padStart(DECIMALS, "0")
    .replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : `${whole}`;
  return neg ? `-${body}` : body;
}

/** Format flux as a display string with the ticker, e.g. "12.5 WARP". */
export function formatWarp(flux: number): string {
  return `${fluxToWarp(flux)} ${TICKER}`;
}
