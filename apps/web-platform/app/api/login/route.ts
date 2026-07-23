// Server-side login: this route runs in Vercel's Node.js runtime, not the
// browser, specifically so a browser-side fetch() quirk can never be the
// thing standing between a correct password and a session again — this app
// spent a long debugging arc chasing a Safari-only `TypeError: Type error`
// out of the browser's own fetch() call inside supabase-js's auth client,
// without ever fully nailing the exact trigger. Doing the actual HTTP call
// to Supabase's GoTrue token endpoint from here sidesteps that whole class
// of browser-fetch issue entirely: Node's fetch has none of it. The browser
// only ever talks to this same-origin route; AuthContext.login() then hands
// the returned tokens to supabase.auth.setSession() to hydrate the client's
// own session state (localStorage, auto-refresh) without it having made the
// network call itself.
import { NextResponse } from "next/server";

const CONTROL_CHARS = new RegExp("[\\x00-\\x1f\\x7f]", "g");

// Same intent as src/lib/supabaseClient.ts's `.trim()`, but stronger: strips
// *any* embedded control character (not just leading/trailing whitespace) a
// bad copy-paste into Vercel's env var UI could have introduced. Read
// independently here since this route runs in its own request handler, not
// sharing that module's state.
function sanitize(value: string | undefined): string {
  return (value ?? "").replace(CONTROL_CHARS, "").trim();
}

export async function POST(req: Request) {
  const supabaseUrl = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "veriBills is missing its Supabase configuration on the server." }, { status: 500 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
  } catch (err) {
    // A genuine failure to reach Supabase from Vercel's own servers — real
    // infrastructure issue, not a browser quirk, and worth knowing as such.
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `This deployment could not reach Supabase: ${message}` }, { status: 502 });
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok || !data) {
    const message = (data && (data.error_description || data.msg || data.error)) || `Sign-in failed (${upstream.status})`;
    return NextResponse.json({ error: message }, { status: upstream.status || 400 });
  }

  return NextResponse.json({ access_token: data.access_token, refresh_token: data.refresh_token });
}
