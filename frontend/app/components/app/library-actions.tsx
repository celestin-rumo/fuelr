"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, getPathname } from "@/i18n/navigation";
import { buttonClasses } from "@ui/button";
import { Menu } from "@ui/menu";
import { Icon } from "@ui/icons";

/**
 * What can be done to the library, in one row.
 *
 * There were three buttons here at `lg` — new, import, export — which is
 * 428px of controls on a screen that has 320, so on a phone they stacked into
 * a wall three deep above the recipes. They also read as three equals, which
 * they are not: creating is what somebody came to do, importing is
 * occasional, exporting is a twice-a-year errand.
 *
 * So one primary action, and the rest behind a press. That is the same answer
 * the recipe rows give: the frequent thing visible, everything else one press
 * away, in a fixed place.
 */
export function LibraryActions({ canExport }: { canExport: boolean }) {
  const t = useTranslations("app");
  const locale = useLocale();
  // A real href, so the item can be opened in a new tab like any other link.
  const importHref = getPathname({ href: "/app/recipes/import", locale });

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/app/recipes/new"
        className={buttonClasses({ size: "sm", className: "gap-1.5" })}
      >
        <Icon name="plus" size={17} />
        {t("newRecipe")}
      </Link>

      <Menu
        label={t("libraryMenu")}
        data-testid="library-menu"
        items={[
          {
            label: t("importRecipe"),
            icon: "book",
            testId: "menu-import",
            href: importHref,
          },
          {
            label: t("export"),
            icon: "arrowDown",
            testId: "menu-export",
            // A file, not a route: it leaves the app as a download, which is
            // the browser's navigation rather than the router's.
            href: "/api/recipes/export",
            download: true,
            // Nothing to export from an empty library. Disabled in place, so
            // the menu does not change shape between two accounts.
            disabled: !canExport,
          },
        ]}
      />
    </div>
  );
}
