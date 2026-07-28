import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementForm } from "@/components/estate/announcement-form";
import { Badge, Card, EmptyState, PageHeader, humanise } from "@/components/ui";

export const metadata = { title: "Announcements" };

export default async function EstateAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [announcements, properties] = await Promise.all([
    supabase
      .from("announcements")
      .select(
        "id, title, body, category, severity, is_pinned, publish_at, expires_at, send_email, send_sms, properties(name)",
      )
      .eq("org_id", orgId)
      .order("publish_at", { ascending: false })
      .limit(30),
    supabase.from("properties").select("id, name").eq("org_id", orgId).eq("is_active", true),
  ]);

  return (
    <>
      <PageHeader title="Announcements" description="Notices published to tenant portals." />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Publish a notice">
          <AnnouncementForm orgId={orgId} properties={properties.data ?? []} />
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {announcements.data && announcements.data.length > 0 ? (
            announcements.data.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-center gap-2">
                  {item.is_pinned && <Badge tone="brand">Pinned</Badge>}
                  <Badge
                    tone={
                      item.severity === "critical"
                        ? "danger"
                        : item.severity === "warning"
                          ? "warning"
                          : "info"
                    }
                  >
                    {humanise(item.category)}
                  </Badge>
                  {item.send_email && <Badge>Emailed</Badge>}
                  {item.send_sms && <Badge>SMS</Badge>}
                  <span className="text-xs text-slate-400">
                    {new Date(item.publish_at).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {(item.properties as { name: string } | null)?.name
                      ? ` · ${(item.properties as { name: string }).name}`
                      : " · All properties"}
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                  {item.body}
                </p>
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState
                title="No announcements yet"
                description="Publish your first notice to reach every tenant portal."
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
