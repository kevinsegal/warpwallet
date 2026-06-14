"use client";

import { useState } from "react";

export function Copyable({
  text,
  label,
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      className={`mono inline-flex items-center gap-2 break-all rounded-lg border border-[var(--panel-border)] bg-white/[0.02] px-3 py-2 text-left text-sm hover:border-[var(--warp-2)] ${className}`}
      title="Copy"
    >
      <span className="break-all">{label ?? text}</span>
      <span className="ml-auto shrink-0 text-xs text-[var(--warp)]">
        {copied ? "copied!" : "copy"}
      </span>
    </button>
  );
}
