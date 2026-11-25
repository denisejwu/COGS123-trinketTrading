"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/**
 * Copies a link so the host can paste it into a class chat (Canvas, Slack,
 * Zoom). Handy for people on laptops, who can't scan a QR code.
 */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers block the clipboard; fall back to a prompt they can copy from.
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button type="button" onClick={copy} className={buttonClasses("secondary")}>
      {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
      <span aria-live="polite">{copied ? "Link copied!" : "Copy link for laptops"}</span>
    </button>
  );
}
