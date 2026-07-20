"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Input, T } from "@veribills/ui-kit";
import { supabase } from "../../src/lib/supabaseClient";
import { callEdgeFunction } from "../../src/lib/db";

interface ActivateResult {
  userId: string;
  email: string;
}

function ActivateForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const result = await callEdgeFunction<ActivateResult>("activate-tenant", { token, name, password });
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: result.email, password });
      if (signInError) throw new Error(signInError.message);
      router.replace("/xbilling");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <Card style={{ width: 360 }}>
        <div style={{ color: T.redT }}>This activation link is missing its token. Ask your estate for a new invite.</div>
      </Card>
    );
  }

  return (
    <Card style={{ width: 360 }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: T.brandL }}>Activate your account</div>
      <div style={{ fontSize: 13, color: T.white3, marginBottom: 20 }}>
        Confirm your details and set a password to start viewing and paying your statement.
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input
          type="password"
          placeholder="Password (min. 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <Input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
        />
        {error ? <div style={{ color: T.redT, fontSize: 13 }}>{error}</div> : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Activating…" : "Activate account"}
        </Button>
      </form>
    </Card>
  );
}

export default function ActivatePage() {
  return (
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center", padding: 24 }}>
      <Suspense fallback={null}>
        <ActivateForm />
      </Suspense>
    </div>
  );
}
