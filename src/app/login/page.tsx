import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { buttonClass, inputClass, labelClass } from "@/components/ui";

export const metadata = { title: "Sign in" };

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Enter your email and password")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next && next.startsWith("/") ? next : "/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");

  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="bg-brand-700 mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white">
            vB
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Sign in to veriBills
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tenant, estate and platform administration
          </p>
        </div>

        {params.error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {params.error}
          </div>
        )}

        <form
          action={signIn}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <input type="hidden" name="next" value={params.next ?? ""} />

          <div>
            <label className={labelClass} htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className={inputClass}
              placeholder="you@example.co.za"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className={`${buttonClass("primary")} w-full`}>
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Applying for a unit?{" "}
          <Link href="/signup" className="text-brand-700 dark:text-brand-400 font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
