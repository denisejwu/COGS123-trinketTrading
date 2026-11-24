import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Create your account</h1>
        <p className="text-sm text-muted">
          Join collector communities and start swapping.
        </p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-accent hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
