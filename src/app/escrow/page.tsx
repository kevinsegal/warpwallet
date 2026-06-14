"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/lib/client/wallet";
import { validateAddress } from "@/lib/warp/crypto";
import { normalizeTag } from "@/lib/warp/tag";
import { fluxToWarp, warpToFlux } from "@/lib/warp/format";

interface Escrow {
  id: string;
  buyer: string;
  seller: string;
  arbiter?: string;
  amount: number;
  memo: string;
  status: "created" | "funded" | "released" | "refunded" | "disputed";
  createdAt: number;
}

async function resolveAddress(input: string): Promise<string | null> {
  const v = input.trim();
  if (!v) return null;
  if (validateAddress(v)) return v;
  const res = await fetch(`/api/tags?tag=${encodeURIComponent(normalizeTag(v))}`);
  if (res.ok) return (await res.json()).record.address as string;
  return null;
}

export default function EscrowPage() {
  const w = useWallet();

  if (w.status !== "unlocked")
    return (
      <Gate text="Open your wallet to create and manage escrow agreements." />
    );

  return <EscrowApp />;
}

function Gate({ text }: { text: string }) {
  return (
    <div className="panel mx-auto max-w-md p-8 text-center">
      <h1 className="mb-2 text-xl font-bold">Wallet required</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">{text}</p>
      <Link href="/wallet" className="btn btn-primary">
        Open wallet
      </Link>
    </div>
  );
}

function EscrowApp() {
  const w = useWallet();
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(async () => {
    if (!w.address) return;
    const res = await fetch(`/api/escrow?address=${w.address}`, { cache: "no-store" });
    if (res.ok) setEscrows((await res.json()).escrows ?? []);
  }, [w.address]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="chip w-fit">🤝 Escrow</span>
        <h1 className="text-3xl font-bold">Trustless escrow</h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Lock WARP until the deal is done. Each state change is authorized by a
          signature from a party allowed to make it — no custodian holds your
          keys.
        </p>
      </header>

      {notice && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: notice.kind === "ok" ? "var(--ok)" : "var(--danger)", color: notice.kind === "ok" ? "var(--ok)" : "var(--danger)" }}
        >
          {notice.msg}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        <CreateEscrow onDone={(m) => { setNotice(m); void load(); void w.refresh(); }} />
        <div className="flex flex-col gap-4">
          <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">
            Your escrows
          </h2>
          {escrows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No escrows yet.</p>
          ) : (
            escrows.map((e) => (
              <EscrowCard
                key={e.id}
                escrow={e}
                onAction={(m) => { setNotice(m); void load(); void w.refresh(); }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CreateEscrow({ onDone }: { onDone: (m: { kind: "ok" | "err"; msg: string }) => void }) {
  const w = useWallet();
  const [seller, setSeller] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const sellerAddr = await resolveAddress(seller);
      if (!sellerAddr) throw new Error("Seller is not a valid address or warp#tag.");
      let arbiterAddr: string | undefined;
      if (arbiter.trim()) {
        arbiterAddr = (await resolveAddress(arbiter)) ?? undefined;
        if (!arbiterAddr) throw new Error("Arbiter is not a valid address or warp#tag.");
      }
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer: w.address,
          seller: sellerAddr,
          arbiter: arbiterAddr,
          amount: warpToFlux(amount),
          memo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create escrow.");
      setSeller(""); setArbiter(""); setAmount(""); setMemo("");
      onDone({ kind: "ok", msg: `Escrow ${data.escrow.id} created. Fund it to lock the amount.` });
    } catch (e) {
      onDone({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel flex h-fit flex-col gap-4 p-6">
      <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">New escrow (you are the buyer)</h2>
      <div>
        <label className="label">Seller (address or warp#tag)</label>
        <input className="input mono" value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="Wf… or warp#nova" />
      </div>
      <div>
        <label className="label">Arbiter (optional)</label>
        <input className="input mono" value={arbiter} onChange={(e) => setArbiter(e.target.value)} placeholder="dispute resolver" />
      </div>
      <div>
        <label className="label">Amount (WARP)</label>
        <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" />
      </div>
      <div>
        <label className="label">Memo</label>
        <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this for?" />
      </div>
      <button className="btn btn-primary" onClick={create} disabled={busy}>
        {busy ? "Creating…" : "Create escrow"}
      </button>
    </section>
  );
}

const STATUS_COLOR: Record<string, string> = {
  created: "var(--muted)",
  funded: "var(--warp)",
  released: "var(--ok)",
  refunded: "var(--warp-3)",
  disputed: "var(--danger)",
};

function EscrowCard({
  escrow,
  onAction,
}: {
  escrow: Escrow;
  onAction: (m: { kind: "ok" | "err"; msg: string }) => void;
}) {
  const w = useWallet();
  const [busy, setBusy] = useState(false);
  const me = w.address;
  const isBuyer = me === escrow.buyer;
  const isSeller = me === escrow.seller;
  const isArbiter = me === escrow.arbiter;

  async function act(action: "fund" | "release" | "refund" | "dispute") {
    setBusy(true);
    try {
      const signed = w.signAction(`escrow:${action}:${escrow.id}`);
      const res = await fetch(`/api/escrow/${escrow.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, signed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      onAction({ kind: "ok", msg: `Escrow ${escrow.id}: ${action} ok.` });
    } catch (e) {
      onAction({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const canFund = isBuyer && escrow.status === "created";
  const canRelease = (isBuyer || isArbiter) && (escrow.status === "funded" || escrow.status === "disputed");
  const canRefund = (isSeller || isArbiter) && (escrow.status === "funded" || escrow.status === "disputed");
  const canDispute = (isBuyer || isSeller) && escrow.status === "funded";

  return (
    <div className="panel flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="chip" style={{ color: STATUS_COLOR[escrow.status] }}>
            {escrow.status}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {isBuyer ? "buyer" : isSeller ? "seller" : isArbiter ? "arbiter" : "party"}
          </span>
        </div>
        <div className="text-lg font-bold">{fluxToWarp(escrow.amount)} WARP</div>
      </div>
      {escrow.memo && <p className="text-sm text-[var(--muted)]">{escrow.memo}</p>}
      <div className="mono grid gap-1 text-xs text-[var(--muted)]">
        <span className="truncate">buyer: {escrow.buyer}</span>
        <span className="truncate">seller: {escrow.seller}</span>
        {escrow.arbiter && <span className="truncate">arbiter: {escrow.arbiter}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {canFund && <button className="btn btn-primary py-1.5" disabled={busy} onClick={() => act("fund")}>Fund</button>}
        {canRelease && <button className="btn btn-primary py-1.5" disabled={busy} onClick={() => act("release")}>Release to seller</button>}
        {canRefund && <button className="btn btn-ghost py-1.5" disabled={busy} onClick={() => act("refund")}>Refund buyer</button>}
        {canDispute && <button className="btn btn-danger py-1.5" disabled={busy} onClick={() => act("dispute")}>Dispute</button>}
      </div>
    </div>
  );
}
