import { AppNav } from "@/components/nav/AppNav";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout for every logged-in page: navigation + page content.
 * requireProfile() sends logged-out visitors to /login.
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: unreadChats }, { count: unreadNotifications }] = await Promise.all([
    supabase.rpc("unread_chat_count"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  return (
    <>
      <AppNav
        username={profile.username}
        displayName={profile.display_name}
        avatarPath={profile.avatar_path}
        unreadChats={unreadChats ?? 0}
        userId={profile.id}
        unreadNotifications={unreadNotifications ?? 0}
      />
      {/* Extra bottom padding on phones so content isn't hidden behind the tab bar. */}
      <main id="main" className="mx-auto max-w-5xl px-4 pb-28 pt-5 md:pb-16 md:pt-8">
        {children}
      </main>
    </>
  );
}
