"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Login } from "../../src/auth/Login";
import { useAuth } from "../../src/auth/AuthContext";
import { ROLE_META } from "../../src/auth/session";

export default function LoginPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace(ROLE_META[session.role].home);
  }, [session, loading, router]);

  if (loading || session) return null;
  return <Login />;
}
