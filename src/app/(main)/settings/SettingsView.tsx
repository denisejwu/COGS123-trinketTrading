import { LogoutButton } from "@/components/LogoutButton";
import type { Profile } from "@/lib/types";
import { AvatarUploader } from "./AvatarUploader";
import { ProfileForm } from "./ProfileForm";

/** What the Settings page looks like (page.tsx loads the data). */
export function SettingsView({ profile }: { profile: Profile }) {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-extrabold md:text-3xl">Settings</h1>

      <section aria-labelledby="photo-heading" className="space-y-4 rounded-3xl border border-line bg-card p-6">
        <h2 id="photo-heading" className="text-lg font-extrabold">
          Profile photo
        </h2>
        <AvatarUploader
          userId={profile.id}
          avatarPath={profile.avatar_path}
          displayName={profile.display_name}
        />
      </section>

      <section aria-labelledby="profile-heading" className="space-y-4 rounded-3xl border border-line bg-card p-6">
        <div>
          <h2 id="profile-heading" className="text-lg font-extrabold">
            Profile
          </h2>
          <p className="text-sm text-muted">Everything here is visible to other PopSwap members.</p>
        </div>
        <ProfileForm profile={profile} />
      </section>

      <section aria-labelledby="account-heading" className="space-y-3 rounded-3xl border border-line bg-card p-6">
        <h2 id="account-heading" className="text-lg font-extrabold">
          Account
        </h2>
        <p className="text-sm">
          <strong>Name-only account (prototype).</strong> There&apos;s no email or password: you stay logged in
          on this browser.
        </p>
        <p className="text-xs text-muted">
          If you log out or clear this browser&apos;s data, you can&apos;t get back into this account. You can
          always start a new one with a name.
        </p>
        <LogoutButton />
      </section>
    </div>
  );
}
