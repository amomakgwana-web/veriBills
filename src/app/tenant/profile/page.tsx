import { requireTenant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/tenant/profile-form";
import { formatMoney } from "@/lib/domain/money";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireTenant();
  const supabase = await createClient();

  const [profile, methods, score] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name, preferred_name, email, phone, alt_phone, id_number, id_type, date_of_birth, postal_address, emergency_contact_name, emergency_contact_phone, notify_email, notify_sms, marketing_opt_in",
      )
      .eq("id", session.userId)
      .maybeSingle(),
    supabase
      .from("payment_methods")
      .select("id, method, brand, last4, expiry_month, expiry_year, is_default, is_active, bank_name, account_last4")
      .eq("profile_id", session.userId)
      .eq("is_active", true),
    supabase
      .from("tenant_scores")
      .select("score, band, on_time_payments, late_payments, missed_payments, months_tenancy")
      .eq("profile_id", session.userId)
      .maybeSingle(),
  ]);

  return (
    <>
      <PageHeader title="My profile" description="Your details, cards and notification settings." />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Personal details">
            <ProfileForm profile={profile.data} email={session.email} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Your units">
            <ul className="space-y-3">
              {session.units.map((unit) => (
                <li key={unit.unitId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {unit.propertyName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Unit {unit.unitNumber} · {unit.accountNumber}
                  </p>
                  <p className="tabular mt-1 text-sm">
                    Balance:{" "}
                    <span
                      className={
                        Number(unit.balance ?? 0) > 0
                          ? "font-medium text-red-600 dark:text-red-400"
                          : "font-medium text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {formatMoney(unit.balance ?? 0)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          {score.data && (
            <Card title="Payment standing">
              <div className="flex items-center justify-between">
                <div>
                  <p className="tabular text-3xl font-semibold text-slate-900 dark:text-slate-50">
                    {score.data.score}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">out of 100</p>
                </div>
                <Badge
                  tone={
                    score.data.band === "excellent" || score.data.band === "good"
                      ? "success"
                      : score.data.band === "fair"
                        ? "warning"
                        : "danger"
                  }
                >
                  {humanise(score.data.band)}
                </Badge>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <ScoreRow label="On time" value={score.data.on_time_payments} />
                <ScoreRow label="Late" value={score.data.late_payments} />
                <ScoreRow label="Missed" value={score.data.missed_payments} />
                <ScoreRow label="Months as tenant" value={score.data.months_tenancy} />
              </dl>
            </Card>
          )}

          <Card title="Payment methods">
            {methods.data && methods.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Method</Th>
                    <Th>Detail</Th>
                    <Th>Default</Th>
                  </tr>
                </thead>
                <tbody>
                  {methods.data.map((method) => (
                    <tr key={method.id}>
                      <Td>{humanise(method.method)}</Td>
                      <Td>
                        {method.method === "card"
                          ? `${method.brand ?? "Card"} ···· ${method.last4 ?? "____"} (${method.expiry_month}/${method.expiry_year})`
                          : `${method.bank_name ?? ""} ···· ${method.account_last4 ?? "____"}`}
                      </Td>
                      <Td>{method.is_default ? <Badge tone="brand">Default</Badge> : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                title="No saved cards"
                description="Cards are tokenised at the gateway when you pay; only the last four digits are ever stored here."
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="tabular font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}
