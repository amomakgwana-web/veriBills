"use client";

import { Card, EmptyState } from "@veribills/ui-kit";
import { useAuth } from "../../auth/AuthContext";
import { ROLE_META } from "../../auth/session";

export function XUtilitiesDashboard() {
  const { session } = useAuth();
  return (
    <Card>
      <EmptyState
        title={`Welcome, ${session?.name ?? "there"} (${session ? ROLE_META[session.role].label : ""})`}
        hint="Rent roll, levies, water and electricity management, bill vetting, arrears kanban, and reporting land here in the next build stage."
      />
    </Card>
  );
}
