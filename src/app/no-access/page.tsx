import { getSession } from "@/lib/auth/session";
import { LinkButton } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata = { title: "No access" };

export default async function NoAccessPage() {
  const session = await getSession();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Your account is not linked to a unit yet
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {session?.email
            ? `We could not find a lease or staff role for ${session.email}.`
            : "We could not find a lease or staff role for this account."}{" "}
          Once the estate adds you to a unit, your portal will appear here.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <LinkButton href="/apply" variant="primary">
            Apply for a unit
          </LinkButton>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
