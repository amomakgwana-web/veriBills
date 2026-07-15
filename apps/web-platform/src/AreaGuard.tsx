"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth/AuthContext";
import { AREA_ACCESS, ROLE_META } from "./auth/session";
import { Shell } from "./Shell";

/** Route guard: requires a session AND that the role may see this area (Sections 3.3/4.3/5.3). */
export function AreaGuard({ area, children }: { area: keyof typeof AREA_ACCESS; children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!AREA_ACCESS[area].includes(session.role)) {
      router.replace(ROLE_META[session.role].home);
    }
  }, [session, loading, area, router]);

  if (loading || !session || !AREA_ACCESS[area].includes(session.role)) return null;
  return <Shell area={area}>{children}</Shell>;
}
