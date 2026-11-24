"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Home, PlusCircle, Settings, UserRound, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { buttonClasses } from "@/components/ui/button";

type NavProps = {
  username: string;
  displayName: string;
  avatarPath: string | null;
};

/**
 * Navigation: a top bar on desktop, and a bottom tab bar on phones
 * (Home, Communities, Post, Trades, Profile) like a native app.
 * It's a client component because it highlights the current page.
 */
export function AppNav({ username, displayName, avatarPath }: NavProps) {
  const pathname = usePathname();
  const profileHref = `/u/${username}`;

  const items = [
    { href: "/", label: "Home", icon: Home, active: pathname === "/" },
    {
      href: "/communities",
      label: "Communities",
      icon: Users,
      active: pathname.startsWith("/communities") || pathname.startsWith("/c/"),
    },
    { href: "/listings/new", label: "Post", icon: PlusCircle, active: pathname === "/listings/new" },
    {
      href: "/trades",
      label: "Trades",
      icon: ArrowLeftRight,
      active: pathname.startsWith("/trades") || pathname.startsWith("/offers"),
    },
    { href: profileHref, label: "Profile", icon: UserRound, active: pathname === profileHref },
  ];

  return (
    <>
      {/* Skip link: lets keyboard users jump past the navigation. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* ---------- Top bar ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <Link href="/" aria-label="PopSwap home">
            <Logo />
          </Link>

          {/* Desktop links (hidden on phones; they use the bottom bar). */}
          <nav aria-label="Main" className="ml-6 hidden md:block">
            <ul className="flex items-center gap-1">
              {items
                .filter((item) => item.label !== "Post" && item.label !== "Profile")
                .map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={item.active ? "page" : undefined}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                        item.active ? "bg-accent-soft text-accent" : "text-muted hover:text-navy"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Desktop only: phones have "Post" in the bottom bar. */}
            <div className="hidden md:block">
              <Link href="/listings/new" className={buttonClasses("primary")}>
                <PlusCircle aria-hidden="true" size={18} />
                Post a listing
              </Link>
            </div>
            <Link
              href="/settings"
              aria-label="Settings"
              aria-current={pathname === "/settings" ? "page" : undefined}
              className="rounded-full p-2 text-muted hover:bg-accent-soft hover:text-navy"
            >
              <Settings aria-hidden="true" size={22} />
            </Link>
            <Link
              href={profileHref}
              aria-label={`Your profile (${displayName})`}
              className="hidden rounded-full md:block"
            >
              <Avatar path={avatarPath} name={displayName} size={36} />
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Bottom tab bar (phones only) ---------- */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {items.map(({ href, label, icon: Icon, active }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                {label === "Post" ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white">
                    <Icon aria-hidden="true" size={20} />
                  </span>
                ) : (
                  <Icon aria-hidden="true" size={22} />
                )}
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
