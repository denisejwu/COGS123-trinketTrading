"use client";

import { buttonClasses } from "@/components/ui/button";

/**
 * Log out. With name-only accounts there's no password, so logging out
 * means this account can't be opened again; we ask first.
 */
export function LogoutButton() {
  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={(event) => {
        const ok = window.confirm(
          "Log out? Name-only accounts have no password, so you won't be able to get back into this one.",
        );
        if (!ok) event.preventDefault();
      }}
    >
      <button type="submit" className={buttonClasses("ghost", "text-danger hover:bg-danger-soft")}>
        Log out
      </button>
    </form>
  );
}
