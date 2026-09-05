import { notFound } from "next/navigation";
import { adminAccounts } from "@app/lib/api";
import { AdminAccounts } from "@app/components/admin/admin-accounts";

export const dynamic = "force-dynamic";

/**
 * The accounts, and the two things that can be done to one.
 *
 * The search is on the address because that is what an operator arrives with:
 * somebody wrote in, and their email is in the other window.
 */
export default async function AdminAccountsPage({
  searchParams,
}: PageProps<"/[locale]/admin/accounts">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";

  const accounts = await adminAccounts(query);
  if (!accounts) notFound();

  return <AdminAccounts accounts={accounts} query={query} />;
}
