"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { decideApproval, type ActionState } from "@/lib/actions/estate";
import { Badge, buttonClass, Card, inputClass, humanise } from "@/components/ui";
import { formatMoney } from "@/lib/domain/money";

const INITIAL: ActionState = { status: "idle" };

type Approval = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  amount: number | null;
  requiredApprovals: number;
  approvalsReceived: number;
  createdAt: string;
};

export function ApprovalCard({
  approval,
  alreadyDecided,
}: {
  approval: Approval;
  alreadyDecided: boolean;
}) {
  const [state, action] = useActionState(decideApproval, INITIAL);

  // Deleting a user requires a typed signature as the record of who authorised it.
  const needsSignature = approval.type === "user_deletion";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone="warning">{humanise(approval.type)}</Badge>
            <span className="text-xs text-slate-400">
              {new Date(approval.createdAt).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <h3 className="mt-1.5 text-sm font-semibold text-slate-900">
            {approval.title}
          </h3>
          {approval.description && (
            <p className="mt-0.5 text-sm text-slate-500">
              {approval.description}
            </p>
          )}
        </div>

        <div className="text-right">
          {approval.amount && (
            <p className="tabular text-lg font-semibold text-slate-900">
              {formatMoney(approval.amount)}
            </p>
          )}
          <p className="text-xs text-slate-500">
            {approval.approvalsReceived} of {approval.requiredApprovals} approvals
          </p>
        </div>
      </div>

      {alreadyDecided ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          You have already recorded a decision on this item.
        </p>
      ) : (
        <form action={action} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="approval_id" value={approval.id} />

          <input
            name="comment"
            placeholder="Comment (optional)"
            className={`${inputClass} text-sm`}
          />

          {needsSignature && (
            <input
              name="signature_name"
              required
              placeholder="Type your full name to sign"
              className={`${inputClass} text-sm`}
            />
          )}

          {state.status === "error" && (
            <p role="alert" className="text-xs text-red-600">
              {state.message}
            </p>
          )}
          {state.status === "success" && (
            <p role="status" className="text-xs text-brand-600">
              {state.message}
            </p>
          )}

          <div className="flex gap-2">
            <DecisionButton value="approved" variant="primary" label="Approve" />
            <DecisionButton value="rejected" variant="danger" label="Reject" />
          </div>
        </form>
      )}
    </Card>
  );
}

function DecisionButton({
  value,
  variant,
  label,
}: {
  value: string;
  variant: "primary" | "danger";
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="decision"
      value={value}
      disabled={pending}
      className={buttonClass(variant, "sm")}
    >
      {pending ? "Recording…" : label}
    </button>
  );
}
