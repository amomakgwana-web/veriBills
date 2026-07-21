"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import type { VbRole } from "@veribills/shared-types";
import { T } from "@veribills/ui-kit";
import { useAuth } from "./AuthContext";
import { ROLE_META } from "./session";
import { supabaseUrl } from "../lib/supabaseClient";

interface DemoAccount {
  role: VbRole;
  email: string;
  password: string;
  name: string;
}

// Demo credentials from db/006_seed_demo_users.sql — one-click sign-in
// while veriBills has no self-registration (Section 3.3). SysAdmin first
// (broadest access).
const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "sysadmin", email: "sysadmin@veribills.demo", password: "SysAdmin!2026", name: "Demo SysAdmin" },
  { role: "landlord", email: "landlord@veribills.demo", password: "Landlord!2026", name: "Demo Landlord" },
  { role: "estate_manager", email: "estatemanager@veribills.demo", password: "EstateManager!2026", name: "Demo Estate Manager" },
  { role: "tenant", email: "tenant@veribills.demo", password: "Tenant!2026", name: "Demo Tenant" },
  { role: "it_admin", email: "itadmin@veribills.demo", password: "ItAdmin!2026", name: "Demo IT Admin" },
];

const ROLE_TONE: Record<VbRole, { bg: string; fg: string }> = {
  sysadmin: { bg: T.brandBg, fg: T.brandL },
  it_admin: { bg: T.purpleBg, fg: T.purpleT },
  landlord: { bg: T.blueBg, fg: T.blueT },
  estate_manager: { bg: T.greenBg, fg: T.greenT },
  data_admin: { bg: T.amberBg, fg: T.amberT },
  data_analyst: { bg: T.amberBg, fg: T.amberT },
  compliance_officer: { bg: T.amberBg, fg: T.amberT },
  tenant: { bg: T.white6, fg: T.white2 },
};

const AVATAR_TINT: Record<VbRole, string> = {
  sysadmin: T.brand,
  it_admin: T.purple,
  landlord: T.blue,
  estate_manager: T.green,
  data_admin: T.amber,
  data_analyst: T.amber,
  compliance_officer: T.amber,
  tenant: T.g400,
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?").slice(0, 2);
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-2.6-11.3-6.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41.4 36.5 44 30.8 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(true);
  const [debugDetail, setDebugDetail] = useState<string | null>(null);

  const runLogin = async (loginEmail: string, loginPassword: string, key: string) => {
    setError(null);
    setNotice(null);
    setDebugDetail(null);
    setBusy(key);
    try {
      await login(loginEmail, loginPassword);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      // A bare "Type error" / "Failed to fetch" / "Load failed" means the
      // request never left the browser as a completed HTTP round-trip.
      // Requests go through this app's own origin (/vbapi, proxied to
      // Supabase server-to-server by next.config.mjs — see
      // src/lib/supabaseClient.ts) specifically so a browser/network block
      // on supabase.co can't cause this; if it still happens, the failure
      // is same-origin (offline, or this deployment's own connectivity),
      // not a third-party block. Surface the configured Supabase URL so a
      // genuine misconfiguration is still visible.
      if (/type error|failed to fetch|load failed|networkerror|network error/i.test(msg)) {
        setError(
          `Couldn't reach the sign-in server (configured for ${supabaseUrl || "no URL configured"}) — ${msg}. ` +
            "This is a network or configuration issue, not a wrong password.",
        );
        // Safari/WebKit's literal "Type error" message is notoriously
        // unspecific — it covers several distinct fetch()/Headers/Request
        // construction failures, not just network blocks, and gives no
        // detail on its own. console.error the raw error (DevTools can
        // expand the object/stack) and also surface what we can read
        // synchronously — name, message, stack, cause — directly in the
        // UI, since asking someone to read their own DevTools has been the
        // bottleneck diagnosing this so far.
        console.error("veriBills login TypeError — raw error object:", err);
        if (err instanceof Error) {
          const parts = [`name: ${err.name}`, `message: ${err.message}`];
          if (err.stack) parts.push(`stack:\n${err.stack}`);
          const cause = (err as { cause?: unknown }).cause;
          if (cause !== undefined) parts.push(`cause: ${String(cause)}`);
          setDebugDetail(parts.join("\n\n"));
        }
      } else {
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await runLogin(email, password, "manual");
  };

  const ssoNotConfigured = () => {
    setError(null);
    setNotice("Single sign-on isn't set up for veriBills yet — use a demo account below, or your email and password.");
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    background: T.surf2,
    border: `1px solid ${T.white5}`,
    borderRadius: 10,
    padding: "13px 14px",
    color: T.white,
    fontSize: 15,
    outline: "none",
  };
  const labelStyle: CSSProperties = { fontSize: 13, color: T.white3, marginBottom: 7, display: "block" };
  const ssoButtonStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    background: T.surf2,
    border: `1px solid ${T.white5}`,
    borderRadius: 10,
    padding: "12px 10px",
    color: T.white,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center", padding: "40px 20px" }}>
      <div style={{ width: "min(440px, 100%)" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 40, lineHeight: 1.1, fontWeight: 800, color: T.white, letterSpacing: -1 }}>Welcome back</div>
          <div style={{ fontSize: 16, color: T.white3, marginTop: 10 }}>
            Sign in to your <span style={{ color: T.brandL, fontWeight: 600 }}>veriBills</span> workspace
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <button type="button" style={ssoButtonStyle} disabled={busy !== null} onClick={ssoNotConfigured}>
            <GoogleIcon /> Google
          </button>
          <button type="button" style={ssoButtonStyle} disabled={busy !== null} onClick={ssoNotConfigured}>
            <MicrosoftIcon /> Microsoft
          </button>
        </div>
        <button
          type="button"
          onClick={ssoNotConfigured}
          style={{
            display: "block",
            margin: "0 auto 24px",
            background: "transparent",
            border: "none",
            color: T.white2,
            fontSize: 13,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Sign in with company SSO (SAML) instead
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "8px 0 22px", color: T.white4, fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: T.white5 }} />
          or sign in with email
          <div style={{ flex: 1, height: 1, background: T.white5 }} />
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="vb-email">
              Work Email
            </label>
            <input
              id="vb-email"
              type="email"
              placeholder="you@estate.co.za"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label style={labelStyle} htmlFor="vb-password">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice("Password resets are handled by your estate manager or IT admin.");
                }}
                style={{ background: "transparent", border: "none", color: T.white3, fontSize: 13, cursor: "pointer", padding: 0 }}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="vb-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: T.white3,
                  cursor: "pointer",
                  padding: 8,
                  display: "flex",
                }}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy !== null}
            style={{
              width: "100%",
              background: T.brand,
              color: T.white,
              border: "none",
              borderRadius: 10,
              padding: "14px",
              fontSize: 16,
              fontWeight: 700,
              cursor: busy !== null ? "default" : "pointer",
              opacity: busy !== null ? 0.7 : 1,
            }}
          >
            {busy === "manual" ? "Signing in…" : "Sign in to veriBills"}
          </button>
        </form>

        {error ? <div style={{ color: T.redT, fontSize: 13, marginTop: 14 }}>{error}</div> : null}
        {debugDetail ? (
          <pre
            style={{
              marginTop: 8,
              padding: 10,
              background: T.surf3,
              border: `1px solid ${T.white5}`,
              borderRadius: 6,
              fontSize: 11,
              color: T.white3,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {debugDetail}
          </pre>
        ) : null}
        {notice ? <div style={{ color: T.white2, fontSize: 13, marginTop: 14 }}>{notice}</div> : null}

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20, color: T.white4, fontSize: 12 }}>
          <span>Privacy Policy</span>
          <span>·</span>
          <span>IT Support</span>
        </div>

        <div style={{ marginTop: 28, border: `1px solid ${T.white5}`, borderRadius: 12, overflow: "hidden", background: T.surf2 }}>
          <button
            type="button"
            onClick={() => setDemoOpen((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: T.white,
            }}
          >
            <span style={{ opacity: 0.7 }} aria-hidden>
              🔒
            </span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Demo Accounts</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.brandL,
                background: T.brandBg,
                border: `1px solid ${T.brandRim}`,
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              {DEMO_ACCOUNTS.length} ROLES
            </span>
            <span style={{ marginLeft: "auto", color: T.white3, fontSize: 12 }}>{demoOpen ? "▲" : "▼"}</span>
          </button>

          {demoOpen ? (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 10,
                  padding: "8px 16px",
                  fontSize: 11,
                  letterSpacing: 0.6,
                  color: T.white4,
                  borderTop: `1px solid ${T.white5}`,
                  textTransform: "uppercase",
                }}
              >
                <span>Account</span>
                <span>Password</span>
                <span>Role</span>
              </div>
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.role}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => runLogin(acct.email, acct.password, acct.role)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 16px",
                    background: "transparent",
                    border: "none",
                    borderTop: `1px solid ${T.white6}`,
                    cursor: busy !== null ? "default" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        flex: "0 0 auto",
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: AVATAR_TINT[acct.role],
                        color: T.white,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {initials(acct.name)}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 13,
                          color: T.white,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {busy === acct.role ? "Signing in…" : acct.email}
                      </span>
                      <span style={{ display: "block", fontSize: 11, color: T.white3 }}>{acct.name}</span>
                    </span>
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 12,
                      color: T.white2,
                      background: T.surf3,
                      border: `1px solid ${T.white5}`,
                      borderRadius: 6,
                      padding: "3px 8px",
                    }}
                  >
                    {acct.password}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: ROLE_TONE[acct.role].fg,
                      background: ROLE_TONE[acct.role].bg,
                      borderRadius: 6,
                      padding: "4px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ROLE_META[acct.role].label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
