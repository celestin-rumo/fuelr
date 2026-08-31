import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Card } from "@ui/card";
import { ContactForm } from "@app/components/site/contact-form";
import { Section, SectionHead } from "@app/components/site/section";

type ContactLink = { label: string; value: string };

export default function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("site.contact");
  const links = t.raw("links") as ContactLink[];

  return (
    <Section>
      <SectionHead label={t("label")} title={t("title")} text={t("text")} />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-4">
          {links.map((link) => (
            <Card key={link.label}>
              <div className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                {link.label}
              </div>
              <div className="mt-2 text-[15px] font-semibold text-text">
                {link.value}
              </div>
            </Card>
          ))}
        </div>

        <Card as="panel">
          <ContactForm />
        </Card>
      </div>
    </Section>
  );
}
