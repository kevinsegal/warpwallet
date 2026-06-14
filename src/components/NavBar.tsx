"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/client/wallet";
import { fluxToWarp } from "@/lib/warp/format";

const LINKS = [
  { href: "/wallet", label: "Wallet" },
  { href: "/escrow", label: "Escrow" },
  { href: "/merchant", label: "Merchants" },
  { href: "/contracts", label: "Contracts" },
  { href: "/interplanetary", label: "Interplanetary" },
];

export function NavBar() {
  const pathname = usePathname();
  const { status, address, account } = useWallet();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--panel-border)] bg-[rgba(5,6,15,0.6)] backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[var(--warp)] to-[var(--warp-2)] text-black">
            ◈
          </span>
          <span className="hidden sm:inline">WarpWallet</span>
        </Link>

        <div className="ml-2 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-white/10 text-[var(--text)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {status === "unlocked" && account ? (
            <Link href="/wallet" className="chip mono" title={address ?? ""}>
              <span className="text-[var(--warp)]">●</span>
              {fluxToWarp(account.balance)} WARP
            </Link>
          ) : status === "locked" ? (
            <Link href="/wallet" className="btn btn-ghost py-1.5">
              Unlock
            </Link>
          ) : (
            <Link href="/wallet" className="btn btn-primary py-1.5">
              Open Wallet
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
