"use client";

import { useState, type FormEvent } from "react";
import type { VbRole } from "@veribills/shared-types";
import { Button, Card, Input, T } from "@veribills/ui-kit";
import { useAuth } from "./AuthContext";
import { ROLE_META } from "./session";

// Demo credentials from db/006_seed_demo_users.sql — quick sign-in while
// veriBills has no self-registration (Section 3.3). SysAdmin is
// first/default since it's the broadest-access role, useful for exploring
// every area.
const DEMO_ACCOUNTS: Array<{ role: VbRole; email: string; password: string }> = [
  { role: "sysadmin", email: "sysadmin@veribills.demo", password: "SysAdmin!2026" },
  { role: "landlord", email: "landlord@veribills.demo", password: "Landlord!2026" },
  { role: "estate_manager", email: "estatemanager@veribills.demo", password: "EstateManager!2026" },
  { role: "tenant", email: "tenant@veribills.demo", password: "Tenant!2026" },
  { role: "it_admin", email: "itadmin@veribills.demo", password: "ItAdmin!2026" },
];

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const runLogin = async (loginEmail: string, loginPassword: string, key: string) => {
    setError(null);
    setBusy(key);
    try {
      await login(loginEmail, loginPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await runLogin(email, password, "manual");
  };

  return (
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center", padding: 24 }}>
      <Card style={{ width: 400 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: T.brandL }}>veriBills</div>
        <div style={{ fontSize: 13, color: T.white3, marginBottom: 20 }}>
          Sign in to your account. There is no self-registration — access is invite-only.
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: T.white3, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Demo accounts
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {DEMO_ACCOUNTS.map((acct, i) => (
            <Button
              key={acct.role}
              variant={i === 0 ? "primary" : "secondary"}
              disabled={busy !== null}
              onClick={() => runLogin(acct.email, acct.password, acct.role)}
              style={{ justifyContent: "space-between", display: "flex", textAlign: "left" }}
            >
              <span>{ROLE_META[acct.role].label}</span>
              <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 12 }}>
                {busy === acct.role ? "Signing in…" : acct.email}
              </span>
            </Button>
          ))}
        </div>

        {error ? <div style={{ color: T.redT, fontSize: 13, marginBottom: 12 }}>{error}</div> : null}

        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          style={{ background: "transparent", border: "none", color: T.white3, fontSize: 12, cursor: "pointer", padding: 0 }}
        >
          {showManual ? "Hide manual sign-in" : "Sign in with a different account"}
        </button>

        {showManual ? (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" disabled={busy !== null}>
              {busy === "manual" ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
