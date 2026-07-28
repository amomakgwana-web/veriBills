import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { buttonClass } from "@/components/ui";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className={className ?? buttonClass("secondary")}>
        Sign out
      </button>
    </form>
  );
}
