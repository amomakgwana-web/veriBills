import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { buttonClass, inputClass, labelClass } from "@/components/ui";

export const metadata = { title: "Create an account" };

async function signUp(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent("Password must be at least 8 characters")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="bg-brand-700 mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white">
            vB
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Apply for a unit, office or retail space
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
          action={signUp}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <label className={labelClass} htmlFor="full_name">
              Full name
            </label>
            <input id="full_name" name="full_name" required className={inputClass} />
          </div>

          <div>
            <label className={labelClass} htmlFor="phone">
              Mobile number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className={inputClass}
              placeholder="082 123 4567"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="email">
              Email address
            </label>
            <input id="email" name="email" type="email" required className={inputClass} />
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
              minLength={8}
              className={inputClass}
            />
          </div>

          <button type="submit" className={`${buttonClass("primary")} w-full`}>
            Create account
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Already registered?{" "}
          <Link href="/login" className="text-brand-700 dark:text-brand-400 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
