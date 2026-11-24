import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireProfile();
  return <SettingsView profile={profile} />;
}
