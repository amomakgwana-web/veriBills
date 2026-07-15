"use client";

import type { ReactNode } from "react";
import { T } from "@veribills/ui-kit";
import { useAuth } from "./auth/AuthContext";
import { ROLE_META } from "./auth/session";

const AREA_LABEL: Record<string, string> = {
  xbilling: "xBilling",
  xutilities: "xUtilities",
  xlayer: "xLayer",
};

export function Shell({ area, children }: { area: keyof typeof AREA_LABEL; children: ReactNode }) {
  const { session, logout } = useAuth();
  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: `1px solid ${T.white5}`,
          background: T.surf3,
        }}
      >
        <div style={{ fontWeight: 700, color: T.brandL }}>
          veriBills <span style={{ color: T.white3, fontWeight: 400 }}>/ {AREA_LABEL[area]}</span>
        </div>
        {session ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
            <span style={{ color: T.white2 }}>{session.name}</span>
            <span style={{ color: T.white3 }}>{ROLE_META[session.role].label}</span>
            <button
              onClick={() => void logout()}
              style={{ background: "transparent", border: "none", color: T.white3, cursor: "pointer", fontSize: 13 }}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </header>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
