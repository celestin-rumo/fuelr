import { redirect } from "@/i18n/navigation";

/** The panel opens on the accounts: that is what somebody comes here with. */
export default async function AdminPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  redirect({ href: "/admin/accounts", locale });
}
