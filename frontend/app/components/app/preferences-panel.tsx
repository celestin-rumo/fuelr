"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Banner } from "@ui/banner";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Chip } from "@ui/chip";
import { Input } from "@ui/input";
import { SectionHead } from "@ui/section-head";
import { Segmented } from "@ui/segmented";
import { ALLERGENS, DIETS } from "@app/lib/preferences";
import type { Allergen, Diet } from "@app/lib/preferences";
import type { DietaryPreferences } from "@app/lib/api";
import { savePreferences } from "@app/[locale]/(app)/app/account/actions";

/**
 * What somebody does not eat, said once.
 *
 * Since the planner started inventing its dishes, an allergy repeated at
 * every ask is an allergy forgotten once — and the once it is forgotten, the
 * dish is on the plan. Two closed lists and a free line, handled two ways:
 * the diet and the allergens are told to the model *and* checked by the
 * code on the lines that come back; the free line reaches a model quoted, as
 * something a person said, and nothing acts on it. The card says so, because
 * a person typing "no peanuts" in the free line needs to know that the chip
 * is the one that protects them.
 */
export function PreferencesPanel({ preferences }: { preferences: DietaryPreferences }) {
  const t = useTranslations("preferences");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [diet, setDiet] = useState<Diet>(preferences.diet);
  const [allergens, setAllergens] = useState<Allergen[]>(preferences.allergens);
  const [dislikes, setDislikes] = useState(preferences.dislikes ?? "");
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<"saved" | "failed" | null>(null);

  function toggle(allergen: Allergen) {
    setAllergens((current) =>
      current.includes(allergen) ? current.filter((one) => one !== allergen) : [...current, allergen],
    );
    setDirty(true);
  }

  function save() {
    startTransition(async () => {
      const result = await savePreferences({ diet, allergens, dislikes: dislikes.trim() || null });
      setNotice(result.ok ? "saved" : "failed");
      if (result.ok) {
        setDirty(false);
        router.refresh();
      }
    });
  }

  return (
    <section className="flex flex-col gap-4" data-testid="preferences-panel">
      <SectionHead as="h2" hint={t("hint")}>
        {t("title")}
      </SectionHead>
      <Card as="panel" className="flex flex-col gap-6">
        {notice && (
          <Banner
            tone={notice === "saved" ? "success" : "error"}
            data-testid="preferences-notice"
            onDismiss={() => setNotice(null)}
          >
            {t(notice)}
          </Banner>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-text-dim">{t("diet.label")}</p>
          <Segmented
            label={t("diet.label")}
            value={diet}
            onChange={(next) => {
              setDiet(next);
              setDirty(true);
            }}
            options={DIETS.map((value) => ({ value, label: t(`diet.options.${value}`) }))}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-semibold text-text-dim">{t("allergens.label")}</legend>
          <p className="text-[13px] font-medium text-gray">{t("allergens.hint")}</p>
          <div className="flex flex-wrap gap-2" data-testid="allergen-chips">
            {ALLERGENS.map((allergen) => (
              <Chip
                key={allergen}
                active={allergens.includes(allergen)}
                onClick={() => toggle(allergen)}
              >
                {t(`allergens.names.${allergen}`)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <Input
          label={t("dislikes.label")}
          hint={t("dislikes.hint")}
          value={dislikes}
          maxLength={200}
          data-testid="dislikes"
          onChange={(event) => {
            setDislikes(event.target.value);
            setDirty(true);
          }}
        />

        <div>
          <Button onClick={save} loading={pending} disabled={!dirty} data-testid="preferences-submit">
            {t("submit")}
          </Button>
        </div>
      </Card>
    </section>
  );
}
