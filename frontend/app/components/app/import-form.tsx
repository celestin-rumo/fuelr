"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Banner } from "@ui/banner";
import { Button } from "@ui/button";
import { Input } from "@ui/input";

export function ImportForm() {
  const t = useTranslations("import");
  const locale = useLocale();
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const looksLikeUrl = /^https?:\/\/\S+\.\S+/i.test(url.trim());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!looksLikeUrl) {
      setError("not_a_url");
      return;
    }

    setBusy(true);
    setError(null);
    const response = await fetch("/api/recipes/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });

    if (response.ok) {
      const recipe = await response.json();
      // Straight into the editor: an import is a starting point to correct,
      // never a recipe quietly added to the library.
      router.replace(`/${locale}/app/recettes/${recipe.id}`);
      router.refresh();
      return;
    }

    setBusy(false);
    const body = await response.json().catch(() => ({}));
    setError(body.error ?? "unreachable");
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Input
        label={t("url")}
        type="url"
        inputMode="url"
        placeholder="https://…"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError(null);
        }}
        status={error ? "error" : "default"}
        hint={t("urlHint")}
      />

      {error && (
        <Banner tone="error" data-testid="import-error" title={t(`errors.${error}.title`)}>
          {t(`errors.${error}.body`)}
        </Banner>
      )}

      <Button type="submit" size="lg" loading={busy}>
        {t("submit")}
      </Button>

      {/* Always offered, not only after a failure: some pages will never be
          readable, and the way forward should not depend on trying first. */}
      <p className="text-center text-[13px] font-medium text-text-dim">
        {t("orManual")}{" "}
        {/* The internal path: next-intl resolves the locale slug itself. */}
        <Link href="/app/recipes/new" className="font-semibold text-accent-ink underline">
          {t("manualLink")}
        </Link>
      </p>
    </form>
  );
}
