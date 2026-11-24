import { AppNav } from "@/components/nav/AppNav";
import { requireProfile } from "@/lib/auth";

/**
 * Layout for every logged-in page: navigation + page content.
 * requireProfile() sends logged-out visitors to /login.
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <>
      <AppNav
        username={profile.username}
        displayName={profile.display_name}
        avatarPath={profile.avatar_path}
      />
      {/* Extra bottom padding on phones so content isn't hidden behind the tab bar. */}
      <main id="main" className="mx-auto max-w-5xl px-4 pb-28 pt-5 md:pb-16 md:pt-8">
        {children}
      </main>
    </>
  );
}
