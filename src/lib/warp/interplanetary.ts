/**
 * Interplanetary settlement helper. WarpCoin targets not just cross-border but
 * cross-*world* payments, where the speed of light — not network latency — is
 * the binding constraint. This module estimates one-way light time between
 * Solar System bodies so the wallet can show realistic settlement windows and
 * so contracts can pick light-time-aware confirmation deadlines.
 *
 * Model: coplanar circular heliocentric orbits using J2000 mean longitudes and
 * sidereal periods. Accurate to a few percent for distance — more than enough to
 * communicate the scale (Mars is minutes away; Saturn is over an hour).
 */

const AU_KM = 149_597_870.7;
const C_KM_S = 299_792.458;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

interface Orbit {
  id: string;
  name: string;
  /** semi-major axis in AU (0 for Earth-orbiting bodies handled specially) */
  a: number;
  /** sidereal period in days */
  period: number;
  /** mean longitude at J2000 in degrees */
  l0: number;
  blurb: string;
}

const ORBITS: Record<string, Orbit> = {
  mercury: { id: "mercury", name: "Mercury", a: 0.387098, period: 87.969, l0: 252.25084, blurb: "Sun-baked inner world" },
  venus: { id: "venus", name: "Venus", a: 0.723332, period: 224.701, l0: 181.97973, blurb: "Cloud-deck stations" },
  earth: { id: "earth", name: "Earth", a: 1.0, period: 365.256, l0: 100.46435, blurb: "Home ledger" },
  mars: { id: "mars", name: "Mars", a: 1.523679, period: 686.98, l0: 355.45332, blurb: "Colony frontier" },
  jupiter: { id: "jupiter", name: "Jupiter", a: 5.2044, period: 4332.59, l0: 34.40438, blurb: "Galilean moon hubs" },
  saturn: { id: "saturn", name: "Saturn", a: 9.5826, period: 10759.22, l0: 49.94432, blurb: "Titan outpost" },
};

export interface Body {
  id: string;
  name: string;
  blurb: string;
}

export const BODIES: Body[] = [
  { id: "earth", name: "Earth", blurb: ORBITS.earth.blurb },
  { id: "luna", name: "Luna (Moon)", blurb: "Lunar gateway" },
  ...["mercury", "venus", "mars", "jupiter", "saturn"].map((id) => ({
    id,
    name: ORBITS[id].name,
    blurb: ORBITS[id].blurb,
  })),
];

function daysSinceJ2000(date: Date): number {
  return (date.getTime() - J2000_MS) / 86_400_000;
}

function helioXY(o: Orbit, date: Date): [number, number] {
  const t = daysSinceJ2000(date);
  const lonDeg = o.l0 + (360 * t) / o.period;
  const lon = (lonDeg * Math.PI) / 180;
  return [o.a * Math.cos(lon), o.a * Math.sin(lon)];
}

function distanceKm(aId: string, bId: string, date: Date): number {
  // Luna: treat as Earth + a fixed offset for the Earth↔Luna leg.
  const earthMoonKm = 384_400;
  if (aId === bId) return aId === "luna" ? 0 : 0;
  const pair = new Set([aId, bId]);
  if (pair.has("earth") && pair.has("luna")) return earthMoonKm;
  // For any leg involving Luna and another planet, approximate as that planet
  // ↔ Earth (the Moon is a rounding error at interplanetary scale).
  const resolve = (id: string) => (id === "luna" ? "earth" : id);
  const oa = ORBITS[resolve(aId)];
  const ob = ORBITS[resolve(bId)];
  if (!oa || !ob) throw new Error("unknown body");
  if (oa.id === ob.id) return 0;
  const [ax, ay] = helioXY(oa, date);
  const [bx, by] = helioXY(ob, date);
  return Math.hypot(ax - bx, ay - by) * AU_KM;
}

export interface LightTime {
  fromId: string;
  toId: string;
  distanceKm: number;
  oneWaySeconds: number;
  roundTripSeconds: number;
  /** Human range over the full synodic cycle, for context. */
  minOneWaySeconds: number;
  maxOneWaySeconds: number;
}

/** Estimate light time between two bodies at a given date (default: now). */
export function lightTime(fromId: string, toId: string, date = new Date()): LightTime {
  const km = distanceKm(fromId, toId, date);
  const oneWay = km / C_KM_S;

  // Sample a year to find the realistic min/max separation for these bodies.
  let min = Infinity;
  let max = 0;
  for (let d = 0; d < 800; d += 4) {
    const sample = new Date(date.getTime() + d * 86_400_000);
    const s = distanceKm(fromId, toId, sample) / C_KM_S;
    if (s < min) min = s;
    if (s > max) max = s;
  }
  return {
    fromId,
    toId,
    distanceKm: km,
    oneWaySeconds: oneWay,
    roundTripSeconds: oneWay * 2,
    minOneWaySeconds: Number.isFinite(min) ? min : oneWay,
    maxOneWaySeconds: max || oneWay,
  };
}

/** Format a duration in seconds as a compact human string. */
export function formatLightDelay(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  if (seconds < 90) return `${seconds.toFixed(1)} s`;
  const m = seconds / 60;
  if (m < 90) return `${m.toFixed(1)} min`;
  return `${(m / 60).toFixed(2)} h`;
}

export function bodyName(id: string): string {
  return BODIES.find((b) => b.id === id)?.name ?? id;
}
