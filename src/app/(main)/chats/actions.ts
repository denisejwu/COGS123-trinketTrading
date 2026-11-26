"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formText } from "@/lib/validation";

/** "Message" button: open (or create) your direct chat with someone. */
export async function startDirectChat(formData: FormData) {
  await requireUserId();
  const supabase = await createClient();
  const { data: threadId, error } = await supabase.rpc("start_direct_chat", { p_other: formText(formData, "other_id") });
  if (error || !threadId) redirect("/chats");
  redirect(`/chats/${threadId}`);
}
