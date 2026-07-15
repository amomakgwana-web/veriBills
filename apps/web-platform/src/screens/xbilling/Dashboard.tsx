"use client";

import { Card, EmptyState } from "@veribills/ui-kit";
import { useAuth } from "../../auth/AuthContext";

export function XBillingDashboard() {
  const { session } = useAuth();
  return (
    <Card>
      <EmptyState
        title={`Welcome, ${session?.name ?? "tenant"}`}
        hint="Your consolidated statement — rent, levies, charges, water, and electricity — lands here in the next build stage."
      />
    </Card>
  );
}
