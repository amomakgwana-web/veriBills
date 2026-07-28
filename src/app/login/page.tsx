import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/error-message";
import { WaveBackground } from "@/components/brand/wave-background";
import { LogoMark } from "@/components/brand/logo-mark";
import { authInputClass, authLabelClass } from "@/components/brand/auth-form";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Sign in" };

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Enter your email and password")}`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(authErrorMessage(error, "signIn"))}`);
    }
  } catch (error) {
    // A NEXT_REDIRECT throw from the line above passes straight through;
    // only a real failure (network, malformed response) lands here.
    if (isRedirectError(error)) throw error;
    redirect(`/login?error=${encodeURIComponent(authErrorMessage(error, "signIn"))}`);
  }

  redirect(next && next.startsWith("/") ? next : "/");
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
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
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <WaveBackground />

      <div className="animate-in w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoMark size="md" className="mx-auto mb-4 shadow-lg" />
          <h1 className="text-xl font-semibold text-white">Sign in to veriBills</h1>
          <p className="text-brand-100/80 mt-1 text-sm">
            Tenant, estate and platform administration
          </p>
        </div>

        {params.error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {params.error}
          </div>
        )}

        <form
          action={signIn}
          className="ring-white/60 space-y-4 rounded-2xl bg-white/80 p-6 shadow-[0_8px_40px_-8px_rgba(24,0,173,0.35)] ring-1 backdrop-blur-2xl backdrop-saturate-150"
        >
          <input type="hidden" name="next" value={params.next ?? ""} />

          <div>
            <label className={authLabelClass} htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className={authInputClass}
              placeholder="you@example.co.za"
            />
          </div>

          <div>
            <label className={authLabelClass} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={authInputClass}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className={`${buttonClass("primary")} w-full`}>
            Sign in
          </button>
        </form>

        <p className="text-brand-100/80 mt-4 text-center text-sm">
          Applying for a unit?{" "}
          <Link href="/signup" className="font-medium text-white hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
