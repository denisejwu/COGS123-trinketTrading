"use server";

/**
 * Server Actions for logging in, signing up and resetting passwords.
 * A Server Action is a function that runs on the server when a form is
 * submitted. It returns a FormState so the form can show errors.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  formText,
  safeNextPath,
  USERNAME_PATTERN,
  USERNAME_RULES,
  MIN_PASSWORD_LENGTH,
  type FormState,
} from "@/lib/validation";

/** The site's address, used to build links inside emails. */
async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

const RATE_LIMIT_MESSAGE =
  "Too many emails were sent recently. Please wait a few minutes and try again.";

// ---------------------------------------------------------------------------
export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = formText(formData, "email");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formText(formData, "next"));
  const values = { email };

  if (!email || !password) {
    return { status: "error", message: "Enter your email and password.", values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Please confirm your email first. Check your inbox for the link we sent.",
        values,
      };
    }
    return {
      status: "error",
      message: "That email and password don't match. Try again, or reset your password.",
      values,
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

// ---------------------------------------------------------------------------
export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const displayName = formText(formData, "display_name");
  const username = formText(formData, "username").toLowerCase();
  const email = formText(formData, "email");
  const password = String(formData.get("password") ?? "");
  const values = { display_name: displayName, username, email };

  // 1. Check the form before talking to Supabase.
  const fieldErrors: Record<string, string> = {};
  if (!displayName) fieldErrors.display_name = "Enter a display name.";
  else if (displayName.length > 50) fieldErrors.display_name = "Keep it under 50 characters.";
  if (!USERNAME_PATTERN.test(username)) fieldErrors.username = `Usernames need ${USERNAME_RULES}.`;
  if (!email.includes("@")) fieldErrors.email = "Enter a valid email address.";
  if (password.length < MIN_PASSWORD_LENGTH)
    fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;

  const supabase = await createClient();

  // 2. Make sure the username is free (works before you have an account).
  if (!fieldErrors.username) {
    const { data: available, error } = await supabase.rpc("username_available", {
      name: username,
    });
    if (error) {
      return {
        status: "error",
        message:
          "Couldn't check usernames. Has supabase/migrations/0001_profiles.sql been run?",
        values,
      };
    }
    if (!available) fieldErrors.username = "That username is taken. Try another one.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  // 3. Create the account. The username and display name travel along as
  //    "metadata"; our database trigger copies them into `profiles`.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/`,
      data: { username, display_name: displayName },
    },
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { status: "error", message: RATE_LIMIT_MESSAGE, values };
    }
    if (error.code === "weak_password") {
      return {
        status: "error",
        message: "That password is too easy to guess. Try a longer one.",
        fieldErrors: { password: "Choose a stronger password." },
        values,
      };
    }
    return { status: "error", message: error.message, values };
  }

  // If email confirmation is turned off in Supabase, we're already logged in.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }

  return {
    status: "success",
    message: `We sent a confirmation link to ${email}. Click it to finish signing up.`,
    values,
  };
}

// ---------------------------------------------------------------------------
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = formText(formData, "email");
  if (!email.includes("@")) {
    return { status: "error", message: "Enter the email you signed up with.", values: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password/update`,
  });

  if (error?.code === "over_email_send_rate_limit") {
    return { status: "error", message: RATE_LIMIT_MESSAGE, values: { email } };
  }

  // Same message whether or not the account exists, so this form can't be
  // used to find out who has an account.
  return {
    status: "success",
    message: `If there's an account for ${email}, we sent a reset link. Open it in this same browser.`,
  };
}

// ---------------------------------------------------------------------------
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      fieldErrors: { password: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
    };
  }
  if (password !== confirm) {
    return { status: "error", fieldErrors: { confirm: "The two passwords don't match." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    if (error.code === "same_password") {
      return { status: "error", message: "That's your current password. Choose a new one." };
    }
    if (error.code === "weak_password") {
      return { status: "error", message: "That password is too easy to guess. Try a longer one." };
    }
    return { status: "error", message: error.message };
  }

  return { status: "success", message: "Your password has been updated." };
}
