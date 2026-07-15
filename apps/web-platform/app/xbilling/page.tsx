"use client";

import { AreaGuard } from "../../src/AreaGuard";
import { XBillingDashboard } from "../../src/screens/xbilling/Dashboard";

export default function XBillingPage() {
  return (
    <AreaGuard area="xbilling">
      <XBillingDashboard />
    </AreaGuard>
  );
}
