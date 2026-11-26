import { MessageCircle } from "lucide-react";
import { startDirectChat } from "@/app/(main)/chats/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { ButtonVariant } from "@/components/ui/button";

/** Opens a direct chat with someone. */
export function MessageButton({
  otherId,
  label = "Message",
  variant = "secondary",
}: {
  otherId: string;
  label?: string;
  variant?: ButtonVariant;
}) {
  return (
    <form action={startDirectChat}>
      <input type="hidden" name="other_id" value={otherId} />
      <SubmitButton variant={variant} pendingText="Opening…">
        <MessageCircle aria-hidden="true" size={18} />
        {label}
      </SubmitButton>
    </form>
  );
}
