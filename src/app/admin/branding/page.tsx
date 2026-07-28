import { requireSystemAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "White labelling" };

/**
 * Per-organisation branding that drives the letterhead on statements, invoices
 * and outbound email. Each card renders a live preview of the letterhead the
 * notification layer will produce for that org.
 */
export default async function BrandingPage() {
  await requireSystemAdmin();
  const supabase = await createClient();

  const { data: brands } = await supabase
    .from("org_branding")
    .select(
      "org_id, logo_url, primary_color, accent_color, font_family, base_font_size_px, statement_footer, postal_address, portal_domain, email_header_html, email_footer_html, organisations(name, vat_number)",
    );

  return (
    <>
      <PageHeader
        title="White labelling"
        description="Letterhead, colours and typography applied to each estate's statements and email."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {(brands ?? []).map((brand) => {
          const org = brand.organisations as { name: string; vat_number: string | null } | null;

          return (
            <Card
              key={brand.org_id}
              title={org?.name ?? "Organisation"}
              description={brand.portal_domain ?? "No custom domain"}
            >
              <div className="mb-4 flex flex-wrap gap-4">
                <Swatch label="Primary" color={brand.primary_color} />
                <Swatch label="Accent" color={brand.accent_color} />
                <div>
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Typography
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-slate-800">
                    {brand.font_family} · {brand.base_font_size_px}px
                  </p>
                </div>
              </div>

              <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
                Letterhead preview
              </p>

              {/* Mirrors renderBrandedEmail() so the preview matches what sends. */}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div
                  style={{ background: brand.primary_color }}
                  className="px-4 py-3 text-sm font-semibold text-white"
                >
                  {brand.logo_url ? (
                    <span>{org?.name}</span>
                  ) : (
                    (org?.name ?? "veriBills")
                  )}
                </div>
                <div
                  className="bg-white px-4 py-4"
                  style={{ fontFamily: brand.font_family, fontSize: brand.base_font_size_px }}
                >
                  <p className="font-semibold text-slate-900">
                    Statement of account
                  </p>
                  <p className="mt-1 text-slate-600">
                    Dear tenant, your statement for this month is attached.
                  </p>
                </div>
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
                  {brand.statement_footer ?? "No footer configured"}
                  {brand.postal_address && (
                    <span className="mt-0.5 block">{brand.postal_address}</span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {(brands?.length ?? 0) === 0 && (
          <Card>
            <EmptyState
              title="No branding configured"
              description="Each organisation gets a branding record when it is created."
            />
          </Card>
        )}
      </div>
    </>
  );
}

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-slate-500 uppercase">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className="h-6 w-6 rounded border border-slate-200"
          style={{ background: color }}
        />
        <code className="text-xs text-slate-600">{color}</code>
      </div>
    </div>
  );
}
