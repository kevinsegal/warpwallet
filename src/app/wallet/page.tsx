"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/client/wallet";
import { Copyable } from "@/components/Copyable";
import { QrCode } from "@/components/QrCode";
import { fluxToWarp, formatWarp, warpToFlux } from "@/lib/warp/format";
import { validateAddress } from "@/lib/warp/crypto";
import { normalizeTag } from "@/lib/warp/tag";

const DEFAULT_FEE_FLUX = 100_000; // 0.001 WARP

export default function WalletPage() {
  const w = useWallet();

  if (w.status === "loading")
    return <p className="text-[var(--muted)]">Loading wallet…</p>;
  if (w.status === "none") return <Onboard />;
  if (w.status === "locked") return <Unlock />;
  return <Dashboard />;
}

function Notice({ kind, msg }: { kind: "ok" | "err" | "info"; msg: string }) {
  const color =
    kind === "ok" ? "var(--ok)" : kind === "err" ? "var(--danger)" : "var(--warp-2)";
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm"
      style={{ borderColor: color, color }}
    >
      {msg}
    </div>
  );
}

function Onboard() {
  const w = useWallet();
  const [mode, setMode] = useState<"create" | "import">("create");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [priv, setPriv] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    if (password.length < 8) return setErr("Passphrase must be at least 8 characters.");
    if (password !== confirm) return setErr("Passphrases do not match.");
    setBusy(true);
    try {
      if (mode === "create") await w.createWallet(password);
      else await w.importWallet(priv, password);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Your WarpCoin wallet</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Keys are generated and encrypted in your browser. We never see your
        private key.
      </p>
      <div className="panel flex flex-col gap-4 p-6">
        <div className="flex gap-2">
          <button
            className={`btn flex-1 ${mode === "create" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("create")}
          >
            Create new
          </button>
          <button
            className={`btn flex-1 ${mode === "import" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("import")}
          >
            Import key
          </button>
        </div>

        {mode === "import" && (
          <div>
            <label className="label">Private key (hex)</label>
            <input
              className="input mono"
              placeholder="64 hex characters"
              value={priv}
              onChange={(e) => setPriv(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="label">Encryption passphrase</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Confirm passphrase</label>
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {err && <Notice kind="err" msg={err} />}
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Working…" : mode === "create" ? "Create wallet" : "Import wallet"}
        </button>
        <p className="text-xs text-[var(--muted)]">
          The passphrase encrypts your key locally. If you lose it, your key
          cannot be recovered — back up your private key after creation.
        </p>
      </div>
    </div>
  );
}

function Unlock() {
  const w = useWallet();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      await w.unlock(password);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold">Unlock wallet</h1>
      <p className="mb-1 text-sm text-[var(--muted)]">Welcome back.</p>
      <p className="mono mb-6 break-all text-xs text-[var(--muted)]">{w.address}</p>
      <div className="panel flex flex-col gap-4 p-6">
        <div>
          <label className="label">Passphrase</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
        </div>
        {err && <Notice kind="err" msg={err} />}
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        <button
          className="text-xs text-[var(--danger)] hover:underline"
          onClick={() => {
            if (confirm("Remove this wallet from this browser? Make sure you have your private key backed up."))
              w.forget();
          }}
        >
          Forget this wallet
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
  const w = useWallet();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          {w.tag ? (
            <p className="text-sm text-[var(--warp)]">warp#{w.tag}</p>
          ) : (
            <p className="text-sm text-[var(--muted)]">No warp#tag yet</p>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost py-1.5" onClick={() => w.refresh()}>
            Refresh
          </button>
          <button className="btn btn-ghost py-1.5" onClick={() => w.lock()}>
            Lock
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Balance />
        <SendForm />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <TagPanel />
        <SecurityPanel />
      </div>
      <History />
    </div>
  );
}

function Balance() {
  const w = useWallet();
  return (
    <section className="panel flex flex-col gap-4 p-6">
      <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">Balance</h2>
      <div className="text-4xl font-extrabold">
        {w.account ? fluxToWarp(w.account.balance) : "—"}{" "}
        <span className="text-lg text-[var(--muted)]">WARP</span>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--panel-border)] bg-white/[0.02] p-4">
        {w.address && <QrCode value={`warp:${w.address}`} />}
        <span className="text-xs text-[var(--muted)]">Scan to pay this wallet</span>
        {w.address && <Copyable text={w.address} className="w-full" />}
      </div>
    </section>
  );
}

function SendForm() {
  const w = useWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err" | "info"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function resolveRecipient(input: string): Promise<string | null> {
    const v = input.trim();
    if (validateAddress(v)) return v;
    if (v.startsWith("warp#") || v.startsWith("@") || /^[a-z0-9_]{3,20}$/i.test(v)) {
      const res = await fetch(`/api/tags?tag=${encodeURIComponent(normalizeTag(v))}`);
      if (res.ok) return (await res.json()).record.address as string;
    }
    return null;
  }

  async function send() {
    setNotice(null);
    setBusy(true);
    try {
      const recipient = await resolveRecipient(to);
      if (!recipient) throw new Error("Recipient is not a valid address or warp#tag.");
      const flux = warpToFlux(amount);
      if (flux <= 0) throw new Error("Amount must be greater than zero.");
      const tx = w.signTransferTo(recipient, flux, DEFAULT_FEE_FLUX);
      const res = await fetch("/api/tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tx),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transaction rejected.");
      setNotice({ kind: "ok", msg: `Sent! txid ${data.txid.slice(0, 16)}…` });
      setTo("");
      setAmount("");
      await w.refresh();
    } catch (e) {
      setNotice({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel flex flex-col gap-4 p-6">
      <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">Send</h2>
      <div>
        <label className="label">To (address or warp#tag)</label>
        <input
          className="input mono"
          placeholder="Wf… or warp#nova"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Amount (WARP)</label>
        <input
          className="input"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <p className="text-xs text-[var(--muted)]">
        Network fee: {formatWarp(DEFAULT_FEE_FLUX)} · signed locally with your key
      </p>
      {notice && <Notice kind={notice.kind} msg={notice.msg} />}
      <button className="btn btn-primary" onClick={send} disabled={busy || !w.account}>
        {busy ? "Signing & sending…" : "Sign & send"}
      </button>
    </section>
  );
}

function TagPanel() {
  const w = useWallet();
  const [tag, setTag] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function claim() {
    setNotice(null);
    setBusy(true);
    try {
      const norm = normalizeTag(tag);
      const signed = w.signAction(`warptag:register:${norm}:${w.address}`);
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: norm, signed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not claim tag.");
      setNotice({ kind: "ok", msg: `Claimed warp#${data.record.tag}` });
      setTag("");
      await w.refresh();
    } catch (e) {
      setNotice({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel flex flex-col gap-4 p-6">
      <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">warp#tag</h2>
      {w.tag ? (
        <>
          <p className="text-sm text-[var(--muted)]">Your tag:</p>
          <Copyable text={`warp#${w.tag}`} />
          <p className="text-xs text-[var(--muted)]">
            Share it so anyone can pay you by tag. You can re-claim a new tag any
            time.
          </p>
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Claim a handle so people can pay you without your full address.
        </p>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label">Choose a tag</label>
          <div className="flex items-center gap-2">
            <span className="text-[var(--muted)]">warp#</span>
            <input
              className="input"
              placeholder="nova"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={claim} disabled={busy || !tag}>
          {busy ? "…" : "Claim"}
        </button>
      </div>
      {notice && <Notice kind={notice.kind} msg={notice.msg} />}
    </section>
  );
}

function SecurityPanel() {
  const w = useWallet();
  const [revealed, setRevealed] = useState(false);
  const priv = w.exportPrivateKey();

  return (
    <section className="panel flex flex-col gap-4 p-6">
      <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">Security</h2>
      <p className="text-sm text-[var(--muted)]">
        Back up your private key offline. Anyone who has it controls this wallet.
      </p>
      {revealed && priv ? (
        <Copyable text={priv} />
      ) : (
        <button className="btn btn-ghost" onClick={() => setRevealed(true)}>
          Reveal private key
        </button>
      )}
      <button
        className="btn btn-danger"
        onClick={() => {
          if (confirm("Remove this wallet from this browser? Back up your private key first."))
            w.forget();
        }}
      >
        Forget wallet on this device
      </button>
    </section>
  );
}

function History() {
  const w = useWallet();
  const [items, setItems] = useState<
    { txid: string; direction?: string; amount: number; from: string; to: string; timestamp: number }[]
  >([]);

  async function load() {
    if (!w.address) return;
    const res = await fetch(`/api/account?address=${w.address}`, { cache: "no-store" });
    if (res.ok) setItems((await res.json()).history ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.address]);

  return (
    <section className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">Activity</h2>
        <button className="btn btn-ghost py-1" onClick={load}>
          Load history
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No activity loaded. Click “Load history”.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--panel-border)]">
          {items.map((t) => (
            <li key={t.txid} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div className="min-w-0">
                <span
                  className="chip"
                  style={{ color: t.direction === "in" ? "var(--ok)" : "var(--warp-2)" }}
                >
                  {t.direction === "in" ? "received" : "sent"}
                </span>
                <p className="mono mt-1 truncate text-xs text-[var(--muted)]">
                  {t.direction === "in" ? `from ${t.from}` : `to ${t.to}`}
                </p>
              </div>
              <div className="text-right">
                <div
                  className="font-semibold"
                  style={{ color: t.direction === "in" ? "var(--ok)" : "var(--text)" }}
                >
                  {t.direction === "in" ? "+" : "−"}
                  {fluxToWarp(t.amount)} WARP
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {new Date(t.timestamp * 1000).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
