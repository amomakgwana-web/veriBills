import { resolveUnit } from "@/lib/tenant-context";
import { MaintenanceForm } from "@/components/tenant/maintenance-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Log a maintenance request" };

export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit } = await resolveUnit(searchParams);

  return (
    <>
      <PageHeader
        title="Log a maintenance request"
        description={`Unit ${unit.unitNumber} · ${unit.propertyName}`}
      />
      <div className="max-w-2xl">
        <Card>
          <MaintenanceForm unitId={unit.unitId} />
        </Card>
      </div>
    </>
  );
}
