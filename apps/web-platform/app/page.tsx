"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../src/auth/AuthContext";
import { ROLE_META } from "../src/auth/session";

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? ROLE_META[session.role].home : "/login");
  }, [session, loading, router]);

  return null;
}
