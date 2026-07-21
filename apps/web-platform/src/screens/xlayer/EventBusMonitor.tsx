"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventLogEntry, WebhookDelivery, WebhookEndpoint } from "@veribills/shared-types";
import { Badge, Button, Card, EmptyState, Input, T, fmtN } from "@veribills/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap } from "../../lib/db";

const SOURCE_TONE: Record<EventLogEntry["source"], "neutral" | "green" | "red" | "amber"> = {
  xbilling: "amber",
  xutilities: "green",
  xlayer: "neutral",
};

const DELIVERY_TONE: Record<WebhookDelivery["status"], "neutral" | "green" | "red" | "amber"> = {
  pending: "neutral",
  delivered: "green",
  failed: "red",
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function EventBusMonitor() {
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | EventLogEntry["source"]>("all");
  const [newEndpoint, setNewEndpoint] = useState({ name: "", url: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventRows, endpointRows, deliveryRows] = await Promise.all([
        unwrap<EventLogEntry[]>(supabase.from("vb_event_log").select("*").order("createdAt", { ascending: false }).limit(100)),
        unwrap<WebhookEndpoint[]>(supabase.from("vb_webhook_endpoints").select("*").order("createdAt", { ascending: false })),
        unwrap<WebhookDelivery[]>(supabase.from("vb_webhook_deliveries").select("*").order("id", { ascending: false }).limit(100)),
      ]);
      setEvents(eventRows);
      setEndpoints(endpointRows);
      setDeliveries(deliveryRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event bus data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const endpointName = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of endpoints) map.set(e.id, e.name);
    return map;
  }, [endpoints]);

  const withBusy = async (fn: () => Promise<void>, successNotice?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (successNotice) setNotice(successNotice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const handleAddEndpoint = () =>
    withBusy(async () => {
      if (!newEndpoint.name || !newEndpoint.url) return;
      const id = "WH-" + Date.now().toString(36).toUpperCase();
      await unwrap(
        supabase.from("vb_webhook_endpoints").insert({ id, name: newEndpoint.name, url: newEndpoint.url, active: true }).select().single(),
      );
      setNewEndpoint({ name: "", url: "" });
      await load();
    }, "Webhook endpoint registered.");

  const handleToggleEndpoint = (endpoint: WebhookEndpoint) =>
    withBusy(async () => {
      await unwrap(supabase.from("vb_webhook_endpoints").update({ active: !endpoint.active }).eq("id", endpoint.id).select().single());
      await load();
    });

  // No real HTTP relay is deployed for xLayer (Section 5.1 describes this
  // as an audit/replay log, not a live delivery worker) — this simulates a
  // delivery attempt against the most recent event so IT Admin/SysAdmin
  // can exercise the monitor end-to-end, same "mock adapter" pattern
  // db/005 uses for BipraPay/MORR ERP/TransFund.
  const handleTestDelivery = (endpoint: WebhookEndpoint) =>
    withBusy(async () => {
      const latest = events[0];
      if (!latest) {
        setError("No events to deliver yet.");
        return;
      }
      const succeed = endpoint.active;
      await unwrap(
        supabase
          .from("vb_webhook_deliveries")
          .insert({
            eventId: latest.id,
            endpointId: endpoint.id,
            status: succeed ? "delivered" : "failed",
            responseCode: succeed ? 200 : null,
            error: succeed ? null : "Endpoint is inactive",
            attemptedAt: new Date().toISOString(),
          })
          .select()
          .single(),
      );
      await load();
    }, "Test delivery attempted.");

  if (loading) return null;

  const filteredEvents = sourceFilter === "all" ? events : events.filter((e) => e.source === sourceFilter);
  const failedDeliveries = deliveries.filter((d) => d.status === "failed");

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1000 }}>
      <Card>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Event Bus Monitor</div>
        <div style={{ color: T.white3, fontSize: 13 }}>
          xLayer's append-only event log — every write in xBilling/xUtilities lands here, plus webhook delivery status.
        </div>
      </Card>

      {error ? (
        <Card style={{ borderColor: T.redR }}>
          <div style={{ color: T.redT, fontSize: 13 }}>{error}</div>
        </Card>
      ) : null}
      {notice ? (
        <Card style={{ borderColor: T.greenR }}>
          <div style={{ color: T.greenT, fontSize: 13 }}>{notice}</div>
        </Card>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <Card>
          <div style={{ fontSize: 12, color: T.white3 }}>Events (last 100)</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtN(events.length)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: T.white3 }}>Webhook endpoints</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{endpoints.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: T.white3 }}>Failed deliveries</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: failedDeliveries.length ? T.redT : T.white }}>{failedDeliveries.length}</div>
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Webhook endpoints</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Input placeholder="Name" value={newEndpoint.name} onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })} />
          <Input placeholder="https://..." value={newEndpoint.url} onChange={(e) => setNewEndpoint({ ...newEndpoint, url: e.target.value })} />
          <Button disabled={busy || !newEndpoint.name || !newEndpoint.url} onClick={handleAddEndpoint}>
            Add
          </Button>
        </div>
        {endpoints.length === 0 ? (
          <EmptyState title="No webhook endpoints registered" />
        ) : (
          endpoints.map((ep) => (
            <div key={ep.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${T.white5}`, padding: "8px 0" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{ep.name}</div>
                <div style={{ fontSize: 12, color: T.white3 }}>{ep.url}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge tone={ep.active ? "green" : "neutral"}>{ep.active ? "active" : "paused"}</Badge>
                <Button variant="ghost" disabled={busy} onClick={() => handleTestDelivery(ep)}>
                  Send test delivery
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => handleToggleEndpoint(ep)}>
                  {ep.active ? "Pause" : "Resume"}
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Delivery status</div>
        {deliveries.length === 0 ? (
          <EmptyState title="No deliveries yet" hint="Send a test delivery from an endpoint above to see it here." />
        ) : (
          deliveries.slice(0, 30).map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: `1px solid ${T.white5}`, padding: "6px 0" }}>
              <span style={{ color: T.white2 }}>
                Event #{d.eventId} → {endpointName.get(d.endpointId) ?? d.endpointId}
                {d.error ? <span style={{ color: T.redT }}> — {d.error}</span> : null}
              </span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {d.responseCode ? <span style={{ color: T.white3 }}>{d.responseCode}</span> : null}
                <Badge tone={DELIVERY_TONE[d.status]}>{d.status}</Badge>
              </span>
            </div>
          ))
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>Recent events</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "xbilling", "xutilities", "xlayer"] as const).map((s) => (
              <Button key={s} variant={sourceFilter === s ? "primary" : "ghost"} onClick={() => setSourceFilter(s)}>
                {s}
              </Button>
            ))}
          </div>
        </div>
        {filteredEvents.length === 0 ? (
          <EmptyState title="No events" hint="Actions across xBilling and xUtilities will appear here as they happen." />
        ) : (
          filteredEvents.map((e) => (
            <div key={e.id} style={{ borderTop: `1px solid ${T.white5}`, padding: "8px 0" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setExpandedId((id) => (id === e.id ? null : e.id))}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge tone={SOURCE_TONE[e.source]}>{e.source}</Badge>
                  <span style={{ fontSize: 13, color: T.white2 }}>{e.eventType}</span>
                </div>
                <span style={{ fontSize: 12, color: T.white3 }}>{timeAgo(e.createdAt)}</span>
              </div>
              {expandedId === e.id ? (
                <pre
                  style={{
                    marginTop: 8,
                    background: T.surf3,
                    border: `1px solid ${T.white5}`,
                    borderRadius: 6,
                    padding: 10,
                    fontSize: 12,
                    color: T.white3,
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
