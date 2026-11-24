import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { getUserEmail, requireProfile } from "@/lib/auth";
import { AvatarUploader } from "./AvatarUploader";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [profile, email] = await Promise.all([requireProfile(), getUserEmail()]);

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

      <section aria-labelledby="account-heading" className="space-y-4 rounded-3xl border border-line bg-card p-6">
        <h2 id="account-heading" className="text-lg font-extrabold">
          Account
        </h2>
        <dl className="text-sm">
          <dt className="font-bold">Email</dt>
          <dd className="text-muted">{email ?? "Unknown"}</dd>
          <dd className="text-xs text-muted">Only you can see this.</dd>
        </dl>
        <div className="flex flex-wrap gap-3">
          <Link href="/reset-password/update" className={buttonClasses("secondary")}>
            Change password
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className={buttonClasses("ghost")}>
              Log out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
