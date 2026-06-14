"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#05060f", light: "#e8ecff" },
    })
      .then((u) => {
        if (active) setUrl(u);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!url)
    return (
      <div
        className="animate-pulse rounded-lg bg-white/10"
        style={{ width: size, height: size }}
      />
    );
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt="QR code"
      width={size}
      height={size}
      className="rounded-lg"
    />
  );
}
