"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/lib/client/wallet";
import { Copyable } from "@/components/Copyable";
import { validateAddress } from "@/lib/warp/crypto";
import { fluxToWarp, warpToFlux } from "@/lib/warp/format";

const CREDS_KEY = "warpwallet:merchant:v1";

interface MerchantCreds {
  id: string;
  name: string;
  payoutAddress: string;
  apiKey: string;
}

interface Invoice {
  id: string;
  amount: number;
  memo: string;
  orderRef?: string;
  status: string;
  createdAt: number;
  txid?: string;
}

export default function MerchantPage() {
  const [creds, setCreds] = useState<MerchantCreds | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CREDS_KEY);
      if (raw) setCreds(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  function save(c: MerchantCreds) {
    localStorage.setItem(CREDS_KEY, JSON.stringify(c));
    setCreds(c);
  }
  function reset() {
    localStorage.removeItem(CREDS_KEY);
    setCreds(null);
  }

  if (!loaded) return <p className="text-[var(--muted)]">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="chip w-fit">🛍️ Merchant gateway</span>
        <h1 className="text-3xl font-bold">Accept WarpCoin payments</h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Register once, mint an API key, and create invoices with a hosted
          checkout. Customers pay in WARP; you get an HMAC-signed webhook the
          moment funds land.
        </p>
      </header>
      {creds ? (
        <Dashboard creds={creds} onReset={reset} />
      ) : (
        <Register onRegistered={save} />
      )}
    </div>
  );
}

function Register({ onRegistered }: { onRegistered: (c: MerchantCreds) => void }) {
  const w = useWallet();
  const [name, setName] = useState("");
  const [payout, setPayout] = useState("");
  const [webhook, setWebhook] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (w.address && !payout) setPayout(w.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.address]);

  async function register() {
    setErr("");
    if (!name.trim()) return setErr("Business name required.");
    if (!validateAddress(payout)) return setErr("Payout must be a valid WarpCoin address.");
    setBusy(true);
    try {
      const res = await fetch("/api/merchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, payoutAddress: payout, webhookUrl: webhook || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed.");
      onRegistered({
        id: data.merchant.id,
        name: data.merchant.name,
        payoutAddress: data.merchant.payoutAddress,
        apiKey: data.merchant.apiKey,
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
      <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">Register your business</h2>
      <div>
        <label className="label">Business name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova Outfitters" />
      </div>
      <div>
        <label className="label">Payout address</label>
        <input className="input mono" value={payout} onChange={(e) => setPayout(e.target.value)} placeholder="Wf…" />
        {w.address && (
          <button className="mt-1 text-xs text-[var(--warp)] hover:underline" onClick={() => setPayout(w.address!)}>
            Use my wallet address
          </button>
        )}
      </div>
      <div>
        <label className="label">Webhook URL (optional)</label>
        <input className="input mono" value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://api.example.com/warp/webhook" />
      </div>
      {err && <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{err}</div>}
      <button className="btn btn-primary" onClick={register} disabled={busy}>
        {busy ? "Registering…" : "Create merchant account"}
      </button>
    </section>
  );
}

function Dashboard({ creds, onReset }: { creds: MerchantCreds; onReset: () => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/merchant/invoices?merchantId=${creds.id}`, { cache: "no-store" });
    if (res.ok) setInvoices((await res.json()).invoices ?? []);
  }, [creds.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <section className="panel flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{creds.name}</h2>
          <button className="btn btn-ghost py-1" onClick={onReset}>Switch account</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="label">Merchant ID</div>
            <Copyable text={creds.id} className="w-full" />
          </div>
          <div>
            <div className="label">API key (keep secret)</div>
            <Copyable text={creds.apiKey} className="w-full" />
          </div>
        </div>
        <div>
          <div className="label">Payout address</div>
          <Copyable text={creds.payoutAddress} className="w-full" />
        </div>
        <ApiHint apiKey={creds.apiKey} origin={origin} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <CreateInvoice apiKey={creds.apiKey} onCreated={load} />
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">Invoices</h2>
            <button className="btn btn-ghost py-1" onClick={load}>Refresh</button>
          </div>
          {invoices.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No invoices yet.</p>
          ) : (
            invoices.map((inv) => (
              <div key={inv.id} className="panel flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="chip" style={{ color: inv.status === "paid" ? "var(--ok)" : inv.status === "pending" ? "var(--warp)" : "var(--muted)" }}>
                    {inv.status}
                  </span>
                  <span className="font-bold">{fluxToWarp(inv.amount)} WARP</span>
                </div>
                {inv.memo && <p className="text-sm text-[var(--muted)]">{inv.memo}</p>}
                <Copyable text={`${origin}/pay/${inv.id}`} label={`${origin}/pay/${inv.id}`} className="w-full" />
                {inv.txid && <p className="mono truncate text-xs text-[var(--muted)]">txid: {inv.txid}</p>}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function CreateInvoice({ apiKey, onCreated }: { apiKey: string; onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [redirect, setRedirect] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/merchant/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          amount: warpToFlux(amount),
          memo,
          orderRef: orderRef || undefined,
          redirectUrl: redirect || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create invoice.");
      setAmount(""); setMemo(""); setOrderRef(""); setRedirect("");
      setNotice({ kind: "ok", msg: `Invoice ${data.invoice.id} created.` });
      onCreated();
    } catch (e) {
      setNotice({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel flex h-fit flex-col gap-4 p-6">
      <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">New invoice</h2>
      <div>
        <label className="label">Amount (WARP)</label>
        <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" />
      </div>
      <div>
        <label className="label">Description</label>
        <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Order #1234" />
      </div>
      <div>
        <label className="label">Order reference (optional)</label>
        <input className="input" value={orderRef} onChange={(e) => setOrderRef(e.target.value)} />
      </div>
      <div>
        <label className="label">Redirect URL after payment (optional)</label>
        <input className="input mono" value={redirect} onChange={(e) => setRedirect(e.target.value)} placeholder="https://shop.example.com/thanks" />
      </div>
      {notice && <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: notice.kind === "ok" ? "var(--ok)" : "var(--danger)", color: notice.kind === "ok" ? "var(--ok)" : "var(--danger)" }}>{notice.msg}</div>}
      <button className="btn btn-primary" onClick={create} disabled={busy}>
        {busy ? "Creating…" : "Create invoice"}
      </button>
    </section>
  );
}

function ApiHint({ apiKey, origin }: { apiKey: string; origin: string }) {
  const snippet = `curl -X POST ${origin || "https://your-app.vercel.app"}/api/merchant/invoices \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 250000000, "memo": "Order #1234", "orderRef": "1234"}'`;
  return (
    <details className="rounded-lg border border-[var(--panel-border)] bg-white/[0.02] p-3">
      <summary className="cursor-pointer text-sm text-[var(--warp)]">API: create an invoice from your backend</summary>
      <pre className="mono mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs text-[var(--muted)]">{snippet}</pre>
      <p className="mt-2 text-xs text-[var(--muted)]">Amount is in flux (1 WARP = 100,000,000 flux). The response includes a checkout URL at /pay/&lt;invoice&gt;.</p>
    </details>
  );
}
