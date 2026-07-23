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

// The one message shown to the caller for any failure that isn't a plain
// wrong-email/wrong-password rejection from Supabase Auth itself — never the
// backend name, a URL, or a raw Node/fetch error string. Full detail always
// still goes to console.error, which lands in this deployment's own
// server-side function logs (Vercel dashboard / MCP), never in the response
// body a browser can render.
const GENERIC_FAILURE = "Couldn't sign in right now. Please try again in a moment, or contact IT Support if this persists.";

export async function POST(req: Request) {
  const supabaseUrl = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !anonKey) {
    console.error("veriBills /api/login: missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 500 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
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
    // infrastructure issue, not a browser quirk, worth knowing as such, but
    // only in our own logs.
    console.error("veriBills /api/login: could not reach Supabase:", err);
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 502 });
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok || !data) {
    // Supabase Auth's own rejection reasons (wrong password, unconfirmed
    // email, etc.) are written to be shown to the person signing in — pass
    // those through as-is. Anything else (a malformed response, an
    // unexpected status) gets the generic message instead of whatever raw
    // text came back.
    const knownAuthMessage = data && typeof data.error_description === "string" ? data.error_description : null;
    if (!knownAuthMessage) console.error("veriBills /api/login: unexpected response from Supabase Auth:", upstream.status, data);
    return NextResponse.json({ error: knownAuthMessage ?? GENERIC_FAILURE }, { status: upstream.status || 400 });
  }

  return NextResponse.json({ access_token: data.access_token, refresh_token: data.refresh_token });
}
