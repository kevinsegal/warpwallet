export function Footer() {
  return (
    <footer className="border-t border-[var(--panel-border)] py-8 text-center text-sm text-[var(--muted)]">
      <div className="mx-auto max-w-6xl px-4">
        <p>
          WarpWallet · built on{" "}
          <a
            className="text-[var(--warp)] hover:underline"
            href="https://github.com/kevinsegal/warpcoin"
          >
            WarpCoin (WARP)
          </a>{" "}
          — a fast, mineable, account-based proof-of-work chain.
        </p>
        <p className="mt-2 text-xs">
          Demo software. Keys are generated and encrypted in your browser. Never
          share your private key or recovery passphrase.
        </p>
      </div>
    </footer>
  );
}
