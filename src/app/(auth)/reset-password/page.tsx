import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { RequestResetForm } from "./RequestResetForm";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { error } = await searchParams;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Reset your password</h1>
        <p className="text-sm text-muted">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>
      </div>

      {error === "link" && (
        <Notice tone="warning">
          That reset link expired or was opened in a different browser. Request a new one below
          and open it in this browser.
        </Notice>
      )}

      <RequestResetForm />

      <p className="text-center text-sm">
        <Link href="/login" className="font-bold text-accent hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
