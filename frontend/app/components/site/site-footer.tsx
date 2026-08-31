import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "./section";
import type { Pathnames } from "./links";

type FooterColumn = {
  title: string;
  links: { label: string; href: Pathnames }[];
};

export function SiteFooter() {
  const t = useTranslations("site.footer");
  const columns = t.raw("columns") as FooterColumn[];

  return (
    <footer className="border-t border-line bg-bg-raised py-14">
      <Container className="flex flex-col gap-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-accent">
                <svg viewBox="0 0 24 24" fill="var(--on-accent)" className="size-4">
                  <path d="M13 2 3 14h7l-1 8 11-13h-7l1-7z" />
                </svg>
              </span>
              <span className="font-display text-lg font-extrabold tracking-[-0.02em] text-text">
                Fuelr
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-[1.6] font-medium text-text-dim">
              {t("tagline")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <div className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                  {column.title}
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {column.links.map((link, i) => (
                    <li key={`${link.href}-${i}`}>
                      <Link
                        href={link.href}
                        className="text-[13px] font-medium text-text-dim hover:text-text"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-6 text-[12px] font-medium text-gray sm:flex-row sm:justify-between">
          <span>{t("copyright")}</span>
          <span>{t("legal")}</span>
        </div>
      </Container>
    </footer>
  );
}
