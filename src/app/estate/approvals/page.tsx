import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { ApprovalCard } from "@/components/estate/approval-card";
import {
  Card,
  EmptyState,
  PageHeader,
  StatTile,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { session, membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [approvals, policies] = await Promise.all([
    supabase
      .from("approvals")
      .select(
        "id, type, status, title, description, amount, required_approvals, approvals_received, created_at, resolved_at, approval_decisions(decided_by, decision, comment, decided_at)",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("approval_policies")
      .select("type, amount_threshold, required_approvals, approver_roles, is_active")
      .eq("org_id", orgId),
  ]);

  const pending = (approvals.data ?? []).filter((a) => a.status === "pending");
  const resolved = (approvals.data ?? []).filter((a) => a.status !== "pending");

  const pendingValue = pending.reduce((sum, a) => sum + Number(a.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Large payments, banking changes and other items needing sign-off."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Pending" value={pending.length} tone={pending.length ? "warning" : "success"} />
        <StatTile label="Value held" value={formatMoney(pendingValue)} />
        <StatTile label="Resolved" value={resolved.length} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Awaiting decision
          </h2>

          {pending.length > 0 ? (
            pending.map((approval) => {
              const decisions = (approval.approval_decisions ?? []) as Array<{
                decided_by: string;
                decision: string;
              }>;
              const alreadyDecided = decisions.some((d) => d.decided_by === session.userId);

              return (
                <ApprovalCard
                  key={approval.id}
                  approval={{
                    id: approval.id,
                    type: approval.type,
                    title: approval.title,
                    description: approval.description,
                    amount: approval.amount,
                    requiredApprovals: approval.required_approvals,
                    approvalsReceived: approval.approvals_received,
                    createdAt: approval.created_at,
                  }}
                  alreadyDecided={alreadyDecided}
                />
              );
            })
          ) : (
            <Card>
              <EmptyState
                title="Nothing awaiting approval"
                description="Items over your configured thresholds will appear here."
              />
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Approval policies">
            {policies.data && policies.data.length > 0 ? (
              <ul className="space-y-3 text-sm">
                {policies.data.map((policy) => (
                  <li key={policy.type} className="border-b border-slate-100 pb-2 last:border-0">
                    <p className="font-medium text-slate-800">
                      {humanise(policy.type)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {policy.amount_threshold
                        ? `Over ${formatMoney(policy.amount_threshold)}`
                        : "Always required"}{" "}
                      · {policy.required_approvals} approver
                      {policy.required_approvals === 1 ? "" : "s"} ·{" "}
                      {policy.approver_roles.map((r) => humanise(r)).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No policies configured"
                description="Without a policy, nothing is held for approval."
              />
            )}
          </Card>

          <Card title="Recently resolved">
            {resolved.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th align="right">Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.slice(0, 12).map((approval) => (
                    <tr key={approval.id}>
                      <Td className="max-w-[12rem] truncate">{approval.title}</Td>
                      <Td align="right">
                        {approval.amount ? formatMoney(approval.amount) : "—"}
                      </Td>
                      <Td>
                        <StatusBadge status={approval.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="Nothing resolved yet" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
