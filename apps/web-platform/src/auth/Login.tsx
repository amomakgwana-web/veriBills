"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Input, T } from "@veribills/ui-kit";
import { useAuth } from "./AuthContext";

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center", padding: 24 }}>
      <Card style={{ width: 360 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: T.brandL }}>veriBills</div>
        <div style={{ fontSize: 13, color: T.white3, marginBottom: 20 }}>
          Sign in to your account. There is no self-registration — access is invite-only.
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <div style={{ color: T.redT, fontSize: 13 }}>{error}</div> : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
