import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

/**
 * Route the caller to whichever portal fits them. Tenancy wins over staff
 * membership, since someone can be both (an estate manager who also rents).
 */
export default async function Home() {
  const session = await getSession();

  if (!session) redirect("/login");
  if (session.units.length > 0) redirect("/tenant");
  if (session.memberships.length > 0) redirect("/estate");
  if (session.isSystemAdmin) redirect("/admin");

  redirect("/no-access");
}
