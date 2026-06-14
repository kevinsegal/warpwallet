"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/lib/client/wallet";
import { QrCode } from "@/components/QrCode";
import { Copyable } from "@/components/Copyable";
import { fluxToWarp } from "@/lib/warp/format";

interface Invoice {
  id: string;
  merchantName: string;
  payoutAddress: string;
  amount: number;
  memo: string;
  status: "pending" | "paid" | "expired" | "canceled";
  redirectUrl?: string;
  txid?: string;
}

const FEE_FLUX = 100_000;

export default function CheckoutPage() {
  const params = useParams<{ invoice: string }>();
  const id = params.invoice;
  const w = useWallet();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoice/${id}`, { cache: "no-store" });
    if (res.ok) setInvoice((await res.json()).invoice);
    else setError("Invoice not found.");
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function pay() {
    if (!invoice) return;
    setError("");
    setBusy(true);
    try {
      const tx = w.signTransferTo(invoice.payoutAddress, invoice.amount, FEE_FLUX);
      const res = await fetch(`/api/invoice/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed.");
      setInvoice(data.invoice);
      await w.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !invoice)
    return <div className="panel mx-auto max-w-md p-8 text-center">{error}</div>;
  if (!invoice) return <p className="text-[var(--muted)]">Loading checkout…</p>;

  const paid = invoice.status === "paid";
  const payable = invoice.status === "pending";
  const uri = `warp:${invoice.payoutAddress}?amount=${fluxToWarp(invoice.amount)}&memo=${invoice.id}`;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="panel flex flex-col items-center gap-4 p-8 text-center">
        <span className="chip">🛍️ {invoice.merchantName}</span>
        <div className="text-sm text-[var(--muted)]">Amount due</div>
        <div className="text-4xl font-extrabold">
          {fluxToWarp(invoice.amount)} <span className="text-xl text-[var(--muted)]">WARP</span>
        </div>
        {invoice.memo && <p className="text-sm text-[var(--muted)]">{invoice.memo}</p>}

        {paid ? (
          <div className="flex w-full flex-col items-center gap-3">
            <div className="text-5xl">✅</div>
            <div className="font-semibold" style={{ color: "var(--ok)" }}>Payment received</div>
            {invoice.txid && (
              <p className="mono break-all text-xs text-[var(--muted)]">txid: {invoice.txid}</p>
            )}
            {invoice.redirectUrl && (
              <a className="btn btn-primary w-full" href={invoice.redirectUrl}>
                Continue →
              </a>
            )}
          </div>
        ) : payable ? (
          <div className="flex w-full flex-col items-center gap-4">
            <QrCode value={uri} />
            <div className="w-full">
              <div className="label text-left">Pay to</div>
              <Copyable text={invoice.payoutAddress} className="w-full" />
            </div>
            {w.status === "unlocked" ? (
              <button className="btn btn-primary w-full" onClick={pay} disabled={busy}>
                {busy ? "Paying…" : `Pay ${fluxToWarp(invoice.amount)} WARP from my wallet`}
              </button>
            ) : (
              <Link href="/wallet" className="btn btn-primary w-full">
                Open wallet to pay
              </Link>
            )}
            {error && (
              <div className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="text-[var(--muted)]">This invoice is {invoice.status}.</div>
        )}
      </div>
      <p className="text-center text-xs text-[var(--muted)]">
        Secured by WarpWallet. Your payment is signed locally and verified on the
        WarpCoin network.
      </p>
    </div>
  );
}
