import { notFound } from "next/navigation";
import Link from "next/link";

import { requireTenant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Maintenance request" };

export default async function MaintenanceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireTenant();

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select(
      `id, reference, title, description, category, priority, status, location_detail,
       permission_to_enter, created_at, acknowledged_at, scheduled_for, resolved_at, closed_at,
       resolution_notes, actual_cost, is_tenant_liable, satisfaction_rating,
       units(unit_number, properties(name)),
       contractors(name, trade)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!request) notFound();

  // Internal notes are filtered out by RLS, so this is safe to render as-is.
  const [comments, history] = await Promise.all([
    supabase
      .from("maintenance_comments")
      .select("id, body, created_at, is_internal, profiles(full_name)")
      .eq("request_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("maintenance_status_history")
      .select("id, from_status, to_status, note, changed_at")
      .eq("request_id", id)
      .order("changed_at", { ascending: true }),
  ]);

  const unit = request.units as {
    unit_number: string;
    properties: { name: string } | null;
  } | null;
  const contractor = request.contractors as { name: string; trade: string | null } | null;

  return (
    <>
      <PageHeader
        title={request.reference}
        description={`${unit?.properties?.name ?? ""} · Unit ${unit?.unit_number ?? ""}`}
        action={
          <Link
            href="/tenant/maintenance"
            className="text-brand-700 dark:text-brand-400 text-sm font-medium"
          >
            Back to requests
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={request.title}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={request.status} />
              <Badge
                tone={
                  request.priority === "emergency"
                    ? "danger"
                    : request.priority === "high"
                      ? "warning"
                      : "neutral"
                }
              >
                {humanise(request.priority)}
              </Badge>
              <Badge>{humanise(request.category)}</Badge>
            </div>

            <p className="text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-400">
              {request.description}
            </p>

            {request.location_detail && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium">Location:</span> {request.location_detail}
              </p>
            )}

            {request.resolution_notes && (
              <div className="mt-4 rounded-lg bg-brand-50 px-3 py-2.5 dark:bg-brand-950/40">
                <p className="text-xs font-medium tracking-wide text-brand-800 uppercase dark:text-brand-300">
                  Resolution
                </p>
                <p className="mt-1 text-sm text-brand-900 dark:text-brand-200">
                  {request.resolution_notes}
                </p>
              </div>
            )}
          </Card>

          <Card title="Updates">
            {comments.data && comments.data.length > 0 ? (
              <ul className="space-y-4">
                {comments.data.map((comment) => (
                  <li key={comment.id} className="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {(comment.profiles as { full_name: string | null } | null)?.full_name ??
                        "Estate team"}{" "}
                      ·{" "}
                      {new Date(comment.created_at).toLocaleString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
                      {comment.body}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No updates yet"
                description="The estate team will post progress here."
              />
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Progress">
            <ol className="space-y-3">
              <TimelineRow label="Logged" at={request.created_at} />
              <TimelineRow label="Acknowledged" at={request.acknowledged_at} />
              <TimelineRow label="Scheduled" at={request.scheduled_for} />
              <TimelineRow label="Resolved" at={request.resolved_at} />
              <TimelineRow label="Closed" at={request.closed_at} />
            </ol>

            {history.data && history.data.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {history.data.map((entry) => (
                  <li key={entry.id}>
                    {humanise(entry.from_status ?? "new")} → {humanise(entry.to_status)} ·{" "}
                    {new Date(entry.changed_at).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                    })}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Details">
            <dl className="space-y-2 text-sm">
              <Row label="Entry permission">
                {request.permission_to_enter ? "Granted" : "Arrange with tenant"}
              </Row>
              <Row label="Contractor">
                {contractor ? `${contractor.name}${contractor.trade ? ` (${contractor.trade})` : ""}` : "Not assigned"}
              </Row>
              <Row label="Cost to you">
                {request.is_tenant_liable && request.actual_cost
                  ? formatMoney(request.actual_cost)
                  : "None"}
              </Row>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function TimelineRow({ label, at }: { label: string; at: string | null }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${at ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700"}`}
      />
      <span className={at ? "text-sm text-slate-800 dark:text-slate-200" : "text-sm text-slate-400"}>
        {label}
      </span>
      <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
        {at
          ? new Date(at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
          : "—"}
      </span>
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-200">{children}</dd>
    </div>
  );
}
