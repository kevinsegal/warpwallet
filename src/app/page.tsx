import Link from "next/link";

const FEATURES = [
  {
    icon: "👛",
    title: "Self-custody wallet",
    body: "Create or import a WarpCoin wallet in seconds. Keys are generated in your browser, encrypted with AES-256-GCM, and never leave your device.",
    href: "/wallet",
  },
  {
    icon: "🏷️",
    title: "warp#tags",
    body: "Claim a human handle like warp#nova and let anyone pay you without copying a long address. Tags are bound to your key by signature.",
    href: "/wallet",
  },
  {
    icon: "🤝",
    title: "Escrow",
    body: "Lock funds until both parties are satisfied. Buyer-, seller- and arbiter-authorized releases, every transition signed by a real key.",
    href: "/escrow",
  },
  {
    icon: "🛍️",
    title: "Merchant gateway",
    body: "Accept WARP on any site. Mint an API key, create invoices, drop in a hosted checkout, and receive HMAC-signed webhooks on payment.",
    href: "/merchant",
  },
  {
    icon: "🧩",
    title: "No-code contracts",
    body: "Compose escrows, vesting, multisig and more from visual blocks. Compile to deterministic, content-addressed WarpScript — no Solidity required.",
    href: "/contracts",
  },
  {
    icon: "🪐",
    title: "Inter-planetary ready",
    body: "Settlement that respects the speed of light. Light-time-aware contracts and confirmation windows for Earth, Luna, Mars and beyond.",
    href: "/interplanetary",
  },
];

const SECURITY = [
  ["Client-side keys", "ECDSA P-256 keypairs are generated and signed with locally — the server only ever sees signed transactions."],
  ["Encrypted at rest", "Private keys are sealed with AES-256-GCM behind a PBKDF2-stretched passphrase (310k iterations)."],
  ["Server-side verification", "Every transaction and privileged action is re-verified on the server: signature, key↔address binding, nonce and balance."],
  ["Hardened transport", "Strict security headers (HSTS, nosniff, frame-deny, locked-down permissions policy) on every response."],
];

export default function Home() {
  return (
    <div className="flex flex-col gap-20">
      {/* Hero */}
      <section className="relative flex flex-col items-center gap-6 pt-10 text-center">
        <span className="chip">◈ WarpCoin · WARP — payments for every world</span>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
          Send WarpCoin across{" "}
          <span className="bg-gradient-to-r from-[var(--warp)] via-[var(--warp-2)] to-[var(--warp-3)] bg-clip-text text-transparent">
            borders and worlds
          </span>
        </h1>
        <p className="max-w-2xl text-lg text-[var(--muted)]">
          A security-first web wallet with warp#tags, escrow, a merchant payment
          gateway, and a no-code smart-contract studio. Built on the WarpCoin
          proof-of-work chain — fast P2P payments today, inter-planetary
          settlement by design.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/wallet" className="btn btn-primary">
            Open your wallet →
          </Link>
          <Link href="/contracts" className="btn btn-ghost">
            Build a contract
          </Link>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Runs in self-contained demo mode out of the box — new wallets get a
          1,000 WARP faucet to explore.
        </p>
      </section>

      {/* Features */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="panel group flex flex-col gap-3 p-6 transition hover:border-[var(--warp-2)]"
          >
            <div className="text-3xl">{f.icon}</div>
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="text-sm text-[var(--muted)]">{f.body}</p>
            <span className="mt-auto text-sm text-[var(--warp)] opacity-0 transition group-hover:opacity-100">
              Explore →
            </span>
          </Link>
        ))}
      </section>

      {/* Security */}
      <section className="panel p-8">
        <div className="flex flex-col gap-2 text-center">
          <span className="chip mx-auto">🔒 Security by construction</span>
          <h2 className="text-2xl font-bold">Your keys. Your coins. Your worlds.</h2>
          <p className="mx-auto max-w-2xl text-sm text-[var(--muted)]">
            WarpWallet mirrors WarpCoin&apos;s on-chain cryptography exactly, so a
            transaction you sign in the browser is valid on the live chain.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECURITY.map(([title, body]) => (
            <div key={title} className="rounded-xl border border-[var(--panel-border)] bg-white/[0.02] p-4">
              <h4 className="font-semibold text-[var(--warp)]">{title}</h4>
              <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Interplanetary banner */}
      <section className="panel relative overflow-hidden p-8 text-center">
        <div className="relative z-10 flex flex-col items-center gap-3">
          <span className="chip">🪐 Inter-planetary transacting</span>
          <h2 className="max-w-2xl text-2xl font-bold">
            When your counterparty is on Mars, latency isn&apos;t the network — it&apos;s
            physics.
          </h2>
          <p className="max-w-2xl text-sm text-[var(--muted)]">
            WarpWallet estimates one-way light delay between worlds and lets
            contracts settle on light-time-aware deadlines — so a payment to a
            Mars colony finalizes when it physically can, not before.
          </p>
          <Link href="/interplanetary" className="btn btn-ghost mt-2">
            Open the light-time calculator
          </Link>
        </div>
      </section>
    </div>
  );
}
