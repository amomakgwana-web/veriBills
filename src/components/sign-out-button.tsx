import { signOut } from "@/lib/actions/auth";
import { buttonClass } from "@/components/ui";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className={className ?? buttonClass("secondary")}>
        Sign out
      </button>
    </form>
  );
}
