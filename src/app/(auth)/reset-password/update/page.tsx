import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

/**
 * You land here from the reset email (the link logs you in first), or from
 * Settings → Change password.
 */
export default async function UpdatePasswordPage() {
  const userId = await getUserId();
  if (!userId) redirect("/reset-password?error=link");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Choose a new password</h1>
        <p className="text-sm text-muted">You&apos;ll use it the next time you log in.</p>
      </div>
      <UpdatePasswordForm />
    </div>
  );
}
