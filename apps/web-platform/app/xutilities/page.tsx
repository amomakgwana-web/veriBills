"use client";

import { AreaGuard } from "../../src/AreaGuard";
import { XUtilitiesDashboard } from "../../src/screens/xutilities/Dashboard";

export default function XUtilitiesPage() {
  return (
    <AreaGuard area="xutilities">
      <XUtilitiesDashboard />
    </AreaGuard>
  );
}
