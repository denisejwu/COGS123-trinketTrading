import { LinkTabs } from "@/components/ui/LinkTabs";

/** Switch between the Offers (negotiations) and Trades (agreed swaps) pages. */
export function TradesTabs({ active }: { active: "offers" | "trades" }) {
  return (
    <LinkTabs
      label="Trading"
      active={active}
      tabs={[
        { key: "offers", label: "Offers", href: "/offers" },
        { key: "trades", label: "Swaps", href: "/trades" },
      ]}
    />
  );
}
