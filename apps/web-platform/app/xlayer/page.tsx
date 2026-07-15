"use client";

import { AreaGuard } from "../../src/AreaGuard";
import { EventBusMonitor } from "../../src/screens/xlayer/EventBusMonitor";

export default function XLayerPage() {
  return (
    <AreaGuard area="xlayer">
      <EventBusMonitor />
    </AreaGuard>
  );
}
