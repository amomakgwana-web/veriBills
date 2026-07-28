import { requireTenant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader, humanise } from "@/components/ui";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  await requireTenant();
  const supabase = await createClient();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, category, severity, publish_at, expires_at, is_pinned, attachment_urls")
    .lte("publish_at", new Date().toISOString())
    .order("is_pinned", { ascending: false })
    .order("publish_at", { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader title="Announcements" description="Notices from your estate management." />

      {announcements && announcements.length > 0 ? (
        <div className="space-y-4">
          {announcements.map((item) => (
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
                <span className="text-xs text-slate-400">
                  {new Date(item.publish_at).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>

              <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                {item.title}
              </h2>
              <p className="mt-1.5 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                {item.body}
              </p>

              {item.attachment_urls && item.attachment_urls.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {item.attachment_urls.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        className="text-brand-700 dark:text-brand-400 text-xs font-medium underline"
                      >
                        Attachment
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No announcements"
          description="When your estate posts a notice, it will appear here."
        />
      )}
    </>
  );
}
