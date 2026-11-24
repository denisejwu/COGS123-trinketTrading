import Link from "next/link";

/**
 * Tabs made of links (e.g. ?tab=showcase), so each tab has its own URL you
 * can bookmark or share, and the back button works.
 */
export function LinkTabs({
  label,
  tabs,
  active,
}: {
  /** Describes the tab group for screen readers, e.g. "Profile sections". */
  label: string;
  tabs: { key: string; label: string; href: string; count?: number }[];
  active: string;
}) {
  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto">
      <ul className="flex w-fit gap-1 rounded-full border border-line bg-card p-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={`block whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  isActive ? "bg-accent text-white" : "text-muted hover:bg-accent-soft hover:text-navy"
                }`}
              >
                {tab.label}
                {typeof tab.count === "number" && (
                  <span className={isActive ? "ml-1.5 text-white/80" : "ml-1.5 text-muted"}>
                    {tab.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
