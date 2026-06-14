"use client";

import { useMemo, useState } from "react";
import {
  BODIES,
  bodyName,
  formatLightDelay,
  lightTime,
} from "@/lib/warp/interplanetary";

export default function InterplanetaryPage() {
  const [from, setFrom] = useState("earth");
  const [to, setTo] = useState("mars");

  const lt = useMemo(() => lightTime(from, to), [from, to]);
  const fromEarth = useMemo(
    () =>
      BODIES.filter((b) => b.id !== "earth").map((b) => ({
        body: b,
        lt: lightTime("earth", b.id),
      })),
    [],
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="chip w-fit">🪐 Inter-planetary settlement</span>
        <h1 className="text-3xl font-bold">Light-time calculator</h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Across worlds, the binding constraint on settlement isn&apos;t the
          network — it&apos;s the speed of light. WarpWallet sizes confirmation
          windows and light-time-aware contracts using these delays.
        </p>
      </header>

      <section className="panel grid gap-6 p-6 md:grid-cols-[1fr_auto_1fr] md:items-end">
        <div>
          <label className="label">From</label>
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {BODIES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden pb-2 text-center text-2xl text-[var(--warp)] md:block">→</div>
        <div>
          <label className="label">To</label>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {BODIES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Distance now" value={`${(lt.distanceKm / 1e6).toFixed(2)} M km`} />
        <Stat label="One-way light time" value={formatLightDelay(lt.oneWaySeconds)} highlight />
        <Stat label="Round-trip" value={formatLightDelay(lt.roundTripSeconds)} />
      </section>

      <section className="panel p-6">
        <p className="text-sm text-[var(--muted)]">
          Over a full synodic cycle, the one-way delay between{" "}
          <strong className="text-[var(--text)]">{bodyName(from)}</strong> and{" "}
          <strong className="text-[var(--text)]">{bodyName(to)}</strong> ranges from{" "}
          <strong className="text-[var(--warp)]">{formatLightDelay(lt.minOneWaySeconds)}</strong>{" "}
          to{" "}
          <strong className="text-[var(--warp-3)]">{formatLightDelay(lt.maxOneWaySeconds)}</strong>
          . A light-time-aware contract waits for the round trip before
          finalizing, so a counterparty has physically had the chance to respond.
        </p>
      </section>

      <section className="panel p-6">
        <h2 className="mb-4 text-sm uppercase tracking-wide text-[var(--muted)]">
          From Earth, right now
        </h2>
        <ul className="flex flex-col divide-y divide-[var(--panel-border)]">
          {fromEarth.map(({ body, lt }) => (
            <li key={body.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="font-semibold">{body.name}</div>
                <div className="text-xs text-[var(--muted)]">{body.blurb}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-[var(--warp)]">
                  {formatLightDelay(lt.oneWaySeconds)}
                </div>
                <div className="text-xs text-[var(--muted)]">one-way</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="panel p-6">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div
        className="mt-2 text-2xl font-bold"
        style={{ color: highlight ? "var(--warp)" : "var(--text)" }}
      >
        {value}
      </div>
    </div>
  );
}
