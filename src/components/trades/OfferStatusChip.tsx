import type { OfferStatus } from "@/lib/types";

/** Label for a negotiation's state. "Your move" when it's your turn. */
export function OfferStatusChip({ status, yourMove = false }: { status: OfferStatus; yourMove?: boolean }) {
  const styles: Record<OfferStatus, { label: string; className: string }> = {
    pending: yourMove
      ? { label: "Your move", className: "bg-accent text-white" }
      : { label: "Waiting for reply", className: "bg-warning-soft text-navy" },
    accepted: { label: "Accepted", className: "bg-success-soft text-success" },
    declined: { label: "Declined", className: "bg-cream text-muted" },
    cancelled: { label: "Cancelled", className: "bg-cream text-muted" },
  };
  const { label, className } = styles[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`}>{label}</span>;
}
