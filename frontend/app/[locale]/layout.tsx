import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Poppins, Manrope, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@app/components/theme-provider";
import { SkipLink } from "@app/components/skip-link";
import { HydrationBanner } from "@app/components/app/hydration-banner";
import { ServiceWorker } from "@app/components/app/service-worker";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Poppins ExtraBold carries the brand voice and headings, Manrope everything
// else, JetBrains Mono the quantities and units.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Fuelr",
    description: "Save your recipes and plan your meals for the week.",
    // One manifest per locale: the install prompt is the app introducing
    // itself, and it should not do that in a language nobody chose.
    manifest: `/manifest/${locale}`,
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${poppins.variable} ${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Dark by default: the near-black ground is what lets the lime carry
            the action. Light is a mirror, not a second system. */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <NextIntlClientProvider>
            {/* First in the DOM, so it is the first thing Tab reaches. */}
            <SkipLink />
            {children}
            <ServiceWorker />
            {/* Last, so it sits above the page it is complaining about. */}
            <HydrationBanner />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
