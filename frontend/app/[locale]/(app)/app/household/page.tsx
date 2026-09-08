import { redirect } from "@/i18n/navigation";

/**
 * The household lives on the account page now, as a tab. This address stays
 * because invitation mails point at it — `EmailLinks.householdInvitation`
 * builds it on the backend — and a link in somebody's inbox is not something
 * a redesign may break. The token rides along.
 */
export default async function HouseholdPage({
  params,
  searchParams,
}: PageProps<"/[locale]/app/household">) {
  const { locale } = await params;
  const { token } = await searchParams;
  redirect({
    href: {
      pathname: "/app/account",
      query: typeof token === "string" ? { tab: "household", token } : { tab: "household" },
    },
    locale,
  });
}
