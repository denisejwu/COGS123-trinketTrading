import type { Metadata } from "next";
import { getUserEmail, requireProfile } from "@/lib/auth";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [profile, email] = await Promise.all([requireProfile(), getUserEmail()]);
  return <SettingsView profile={profile} email={email} />;
}
