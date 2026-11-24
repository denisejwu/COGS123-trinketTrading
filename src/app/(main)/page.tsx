import { requireProfile } from "@/lib/auth";
import { HomeView } from "./HomeView";

/** Home page: loads your profile, then draws HomeView. */
export default async function HomePage() {
  const profile = await requireProfile();
  return <HomeView displayName={profile.display_name} />;
}
