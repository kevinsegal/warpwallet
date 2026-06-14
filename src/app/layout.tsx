import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/client/wallet";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "WarpWallet — WarpCoin for every world",
  description:
    "A security-first web wallet for WarpCoin (WARP): warp#tags, escrow, a merchant payment gateway, and a no-code smart-contract studio — built for cross-border and inter-planetary payments.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "WarpWallet",
    description:
      "Security-first WarpCoin wallet, escrow, merchant gateway, and no-code smart contracts — for cross-border and inter-planetary payments.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <NavBar />
          <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8">
            {children}
          </main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
