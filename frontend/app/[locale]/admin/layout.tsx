import { use } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@app/lib/session";
import { Container } from "@app/components/site/section";
import { AdminNav } from "@app/components/admin/admin-nav";

/**
 * One door.
 *
 * The role is read here, from the session the server resolved against the
 * backend, before a single section renders — never from anything the browser
 * claimed. Every endpoint behind these pages checks it again, because a guard
 * in a layout protects a page and not an API.
 *
 * `notFound()` and not a redirect: a panel that exists only for the operator
 * has no reason to confirm to anybody else that it exists. That is the same
 * answer the endpoints give, so the two cannot disagree.
 *
 * Internal, like `/design-system`: the copy is English and deliberately not
 * translated. It is read by whoever runs Fuelr, not by whoever cooks with it.
 */
export default function AdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const session = use(getSession());
  if (session?.role !== "ADMIN") {
    notFound();
  }

  return (
    <Container className="flex flex-col gap-8 py-12">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          Operations
        </span>
        <h1 className="font-display text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text">
          Admin
        </h1>
        <p className="max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">
          Everything on these pages is somebody&apos;s personal data — their
          address, what they cooked, what they consumed. Signed in as{" "}
          <span className="font-mono text-[13px] text-text">{session.email}</span>.
        </p>
      </div>

      <AdminNav />

      {children}

      <p className="text-[12px] font-medium text-gray">
        Looking for the old <Link href="/total-costs" className="text-mint-ink hover:underline">/total-costs</Link>?
        It is the AI costs section now.
      </p>
    </Container>
  );
}
