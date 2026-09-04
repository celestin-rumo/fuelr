"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@app/components/theme-toggle";
import { Badge } from "@ui/badge";
import { Button, IconButton } from "@ui/button";
import { Card, CardBody, CardTitle } from "@ui/card";
import { Checkbox } from "@ui/checkbox";
import { Chip } from "@ui/chip";
import { Banner } from "@ui/banner";
import { Dialog } from "@ui/dialog";
import { EmptyState } from "@ui/empty-state";
import { Input } from "@ui/input";
import { Radio } from "@ui/radio";
import { RecipeCard } from "@ui/recipe-card";
import { Icon } from "@ui/icons";
import { Segmented, SegmentedCount } from "@ui/segmented";
import { Stepper } from "@ui/stepper";
import { SectionHead } from "@ui/section-head";
import {
  ListRow,
  ListRowActions,
  ListRowMeta,
  ListRowTitle,
} from "@ui/list-row";
import { Switch } from "@ui/switch";
import { Tab, TabList } from "@ui/tabs";
import type { ButtonVariant } from "@ui/button";

// This page is the living reference for the design system: everything below
// renders with the real tokens, never with a screenshot.

const RAMPS = [
  {
    name: "Lime",
    token: "--lime",
    note: "500 is the flat brand colour in both themes (CTA, active tab, progress ring). 900 is --lime-ink: lime text and borders in light mode (6.9:1).",
    steps: [
      "#FAFCE6", "#F2F8C4", "#E4F294", "#D2EB5D", "#C4F135",
      "#A6CB1B", "#85A414", "#65800F", "#4B5E12", "#2E3A08",
    ],
    baseIdx: 4,
    inkIdx: 8,
    flipIdx: 6,
  },
  {
    name: "Mint",
    token: "--mint",
    note: "500 is progress, links and the focus ring. 800 is --mint-ink (6.1:1). 100–200 are positive alert grounds.",
    steps: [
      "#E3FBF7", "#C4F5EC", "#97ECDD", "#5FE0CB", "#2DD4BF",
      "#1DB3A0", "#158F80", "#0E6B5F", "#0A4C43", "#062E28",
    ],
    baseIdx: 4,
    inkIdx: 7,
    flipIdx: 5,
  },
  {
    name: "Coral",
    token: "--coral",
    note: "500 is alerts, badges and notifications. 800 is --coral-ink (6.9:1). Never used for body text.",
    steps: [
      "#FFEDE7", "#FFD3C4", "#FFAD8C", "#FF8A66", "#FF6B4A",
      "#E8532F", "#C43F22", "#9C321B", "#742513", "#4D1A0D",
    ],
    baseIdx: 4,
    inkIdx: 7,
    flipIdx: 5,
  },
  {
    name: "Neutral",
    token: "--gray",
    note: "500 is secondary text, field borders and inactive states. Steps 700–1000 are dark-mode surfaces, 100–200 light-mode ones.",
    steps: [
      "#F3F4F6", "#E5E7EB", "#D1D5DB", "#9CA3AF", "#6B7280",
      "#4B5563", "#374151", "#1F2937", "#111827", "#030712",
    ],
    baseIdx: 4,
    inkIdx: -1,
    flipIdx: 4,
  },
];

const TOKENS: Array<[string, string, string, string]> = [
  ["--bg", "#121212", "#F7F5EF", "Page ground"],
  ["--bg-raised", "#191919", "#FFFFFF", "Cards, panels, nav bar"],
  ["--bg-raised-2", "#212121", "#ECE9DF", "Fields, inactive chips, tracks"],
  ["--text", "#F5F5F0", "#15150F", "Primary text"],
  ["--text-dim", "#B9B9B4", "#5B5A50", "Descriptions, metadata"],
  ["--gray", "#6B7280", "#64635A", "Labels, inactive icons, borders"],
  ["--line", "rgba(…,.08)", "rgba(…,.12)", "Separators and card outlines"],
  ["--lime", "#C4F135", "#C4F135", "Primary action (flat)"],
  ["--lime-ink", "#C4F135", "#4B5E12", "Lime as text or border"],
  ["--mint", "#2DD4BF", "#2DD4BF", "Progress, focus (flat)"],
  ["--mint-ink", "#2DD4BF", "#0E6B5F", "Mint as text or link"],
  ["--coral", "#FF6B4A", "#FF6B4A", "Alert, badge (flat)"],
  ["--coral-ink", "#FF6B4A", "#9C321B", "Coral as text or border"],
];

const TYPE_SCALE: Array<[string, string, string, ReactNode]> = [
  ["Display", "44 / 40 · 800", "font-display text-[44px] font-extrabold tracking-[-0.02em] leading-[1.1]", "Fuelr."],
  ["H1", "32 / 28 · 800", "font-display text-[32px] font-extrabold tracking-[-0.02em] leading-[1.1]", "Planning de la semaine"],
  ["H2", "22 / 20 · 800", "font-display text-[22px] font-extrabold tracking-[-0.02em] leading-[1.2]", "Liste de courses"],
  ["H3", "16 · 700", "font-display text-base font-bold", "Poulet basquaise"],
  ["Body", "15 · 500 · 1.5", "text-[15px] font-medium leading-[1.5]", "Planifie tes repas, atteins tes objectifs."],
  ["Meta", "13 · 600", "text-[13px] font-semibold text-text-dim", "4 personnes · 25 min"],
  ["Label", "11 · 700 · .02em", "text-[11px] font-bold uppercase tracking-[0.02em] text-gray", "Petit-déjeuner"],
  ["Data", "13 · mono", "font-mono text-[13px] tnum text-text-dim", "420 kcal · 600 g"],
];

const SPACING: Array<[string, number, string]> = [
  ["--sp-1", 4, "icon micro-offset"],
  ["--sp-2", 8, "label ↔ field"],
  ["--sp-3", 12, "gap between chips"],
  ["--sp-4", 16, "card padding (mobile)"],
  ["--sp-5", 20, "mobile screen margin"],
  ["--sp-6", 24, "grid gutter"],
  ["--sp-8", 32, "panel padding"],
  ["--sp-10", 40, "desktop screen margin"],
  ["--sp-12", 48, "clickable row height"],
  ["--sp-16", 64, "gap between sections"],
  ["--sp-20", 80, "page top margin"],
  ["--sp-24", 96, "bottom safe area"],
];

const BUTTON_VARIANTS: Array<[ButtonVariant, string, string]> = [
  ["primary", "Ajouter à la liste", "one action per view · 46px"],
  ["secondary", "Plus tard", "1.5px gray border"],
  ["tertiary", "Dupliquer", "raised-2 ground, no border"],
  ["text", "Voir la recette", "no surface · underline on hover"],
  ["danger", "Supprimer", "coral outline → filled on hover"],
  ["soft", "Planifier", "accent 14% ground · dense lists"],
  ["dangerText", "Supprimer", "destructive, no surface · inside a row"],
  ["quiet", "Modifier", "neutral, no surface · a rail of icons"],
];

function Section({
  num,
  title,
  intro,
  children,
}: {
  num: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="mb-2 flex items-baseline gap-3">
        <span className="font-mono text-[13px] text-gray">{num}</span>
        <h2 className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-text">
          {title}
        </h2>
      </div>
      {intro && (
        <p className="mb-5 max-w-[68ch] text-[15px] leading-[1.6] font-medium text-text-dim">
          {intro}
        </p>
      )}
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
      {children}
    </div>
  );
}

export default function DesignSystemPage() {
  const [chips, setChips] = useState<Record<string, boolean>>({
    Végétarien: true,
  });
  const [checked, setChecked] = useState<Record<string, boolean>>({
    "Avocats mûrs": true,
  });
  const [tab, setTab] = useState("Semaine");
  const [favorite, setFavorite] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [scope, setScope] = useState<"all" | "favorites">("all");
  const [goal, setGoal] = useState<"lose" | "maintain" | "gain">("maintain");
  const [servings, setServings] = useState(4);

  return (
    <div className="min-h-full bg-bg">
      <div className="mx-auto max-w-[1240px] px-5 pt-7 pb-24 md:px-10">
        <header className="sticky top-0 z-20 mb-8 flex flex-wrap items-center gap-4 border-b border-line bg-bg py-3.5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent">
              <svg viewBox="0 0 24 24" fill="var(--on-accent)" className="size-[18px]">
                <path d="M13 2 3 14h7l-1 8 11-13h-7l1-7z" />
              </svg>
            </div>
            <div>
              <div className="font-display text-xl font-extrabold tracking-[-0.02em] text-text">
                Fuelr — Design System
              </div>
              <div className="mt-0.5 text-xs font-medium text-text-dim">
                Foundations for the responsive web app · v0.2
              </div>
            </div>
            <span className="mt-1 size-[7px] self-start rounded-full bg-coral" />
          </div>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        <div className="mb-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <Label>What this document does</Label>
            <p className="text-[15px] leading-[1.6] font-medium text-text-dim">
              It fixes the decisions that are no longer up for debate: colour,
              type, space, grid, shape, motion, accessibility. Every value
              exists in dark and light — flip the theme and everything you see
              re-renders from the real tokens.
            </p>
          </Card>
          <Card>
            <Label>Three principles</Label>
            <div className="flex flex-col gap-2.5 text-[13.5px] leading-[1.5] font-semibold">
              <p>
                <b className="text-lime-ink">Dark by default.</b>{" "}
                <span className="text-text-dim">
                  The near-black ground lets the lime carry the action; light is
                  a mirror, not a second system.
                </span>
              </p>
              <p>
                <b className="text-mint-ink">Food first.</b>{" "}
                <span className="text-text-dim">
                  The UI stays neutral so the dish photos are the only
                  uncontrolled colour.
                </span>
              </p>
              <p>
                <b className="text-coral-ink">One accent per view.</b>{" "}
                <span className="text-text-dim">
                  Lime = action, mint = progress, coral = alert. Never two roles
                  for one colour.
                </span>
              </p>
            </div>
          </Card>
          <Card>
            <Label>What changes for the web</Label>
            <p className="mb-3 text-[15px] leading-[1.6] font-medium text-text-dim">
              The original system is mobile. The web adds a 4/8/12-column grid
              with a 1240px container, two extra type steps for large screens,
              hover and keyboard focus states, and an elevation scale.
            </p>
            <p className="font-mono text-[11px] text-coral-ink">
              Nothing is removed from the existing mobile system.
            </p>
          </Card>
        </div>

        <Section
          num="01"
          title="Colour ramps — 100 to 1000"
          intro="Step 500 is the flat brand colour, identical in both themes. The dark steps carry text on light grounds (the *-ink tokens); the light steps are used as grounds."
        >
          <div className="flex flex-col gap-6">
            {RAMPS.map((ramp) => (
              <div key={ramp.name}>
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="font-display text-base font-bold text-text">
                    {ramp.name}
                  </span>
                  <span className="font-mono text-[11px] text-gray">
                    {ramp.token}
                  </span>
                </div>
                <div className="grid grid-cols-5 overflow-hidden rounded-md md:grid-cols-10">
                  {ramp.steps.map((hex, i) => (
                    <div
                      key={hex}
                      className="flex aspect-[4/3] flex-col justify-between p-2"
                      style={{
                        background: hex,
                        color: i >= ramp.flipIdx ? "#F5F5F0" : "#121212",
                      }}
                    >
                      <span className="font-mono text-[10px] opacity-85">
                        {(i + 1) * 100}
                      </span>
                      <span className="font-mono text-[9px] opacity-85">
                        {i === ramp.baseIdx
                          ? "base"
                          : i === ramp.inkIdx
                            ? "ink · light"
                            : hex}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 max-w-[68ch] text-[13px] font-medium text-text-dim">
                  {ramp.note}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          num="02"
          title="Semantic tokens"
          intro="A component never hardcodes a hex — it uses the token. That is what lets the light theme exist without duplicating a single component."
        >
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-bg-raised">
                  {["Token", "Dark", "Light", "Usage"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[11px] font-bold tracking-[0.02em] text-gray uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOKENS.map(([name, dark, light, use]) => (
                  <tr key={name} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-mono text-[12px] text-accent-ink">
                      {name}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-text-dim">
                      {dark}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-text-dim">
                      {light}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-text-dim">
                      {use}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          num="03"
          title="Typography"
          intro="Poppins ExtraBold for the brand voice and headings, Manrope for everything else, JetBrains Mono for quantities and units — tabular figures stop the text jumping when a value changes."
        >
          <Card as="panel" className="flex flex-col gap-5">
            {TYPE_SCALE.map(([name, spec, cls, sample]) => (
              <div
                key={name}
                className="flex flex-col gap-1 border-b border-line pb-5 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <div className="w-28 shrink-0">
                  <div className="text-[13px] font-semibold text-text">
                    {name}
                  </div>
                  <div className="font-mono text-[11px] text-gray">{spec}</div>
                </div>
                <div className={cls}>{sample}</div>
              </div>
            ))}
          </Card>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card>
              <Label>Rules</Label>
              <ul className="flex flex-col gap-1.5 text-[13px] font-medium text-text-dim">
                <li>Max body line length — 68ch</li>
                <li>Heading leading — 1.1 to 1.2</li>
                <li>Smallest on-screen size — 11px (labels)</li>
                <li>Poppins allowed from — 14px</li>
                <li>Uppercase — labels only</li>
              </ul>
            </Card>
            <Card>
              <Label>Avoid</Label>
              <p className="text-[13px] font-medium text-text-dim">
                Manrope in a heading with Poppins in the body: the hierarchy
                flattens. Titles in Poppins, descriptions in Manrope, quantities
                in mono.
              </p>
            </Card>
          </div>
        </Section>

        <Section
          num="04"
          title="Spacing — 4px base"
          intro="No value off the scale. If a spacing 'doesn't quite land', it's the composition to revisit, not the scale."
        >
          <Card as="panel" className="flex flex-col gap-2.5">
            {SPACING.map(([token, px, use]) => (
              <div key={token} className="flex items-center gap-4">
                <span className="w-20 shrink-0 font-mono text-[12px] text-accent-ink">
                  {token}
                </span>
                <span
                  className="h-4 shrink-0 rounded-[3px] bg-accent"
                  style={{ width: px }}
                />
                <span className="tnum font-mono text-[12px] text-gray">
                  {px}px
                </span>
                <span className="text-[13px] font-medium text-text-dim">
                  {use}
                </span>
              </div>
            ))}
          </Card>
        </Section>

        <Section num="05" title="Shape, elevation, motion">
          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <Label>Radii</Label>
              <div className="flex flex-col gap-3">
                {[
                  ["--r-sm", "12px", "fields, tags", "rounded-sm"],
                  ["--r-md", "20px", "cards, rows", "rounded-md"],
                  ["--r-lg", "24px", "panels, dialogs", "rounded-lg"],
                  ["--r-full", "999px", "buttons, chips", "rounded-full"],
                ].map(([token, value, use, cls]) => (
                  <div key={token} className="flex items-center gap-3">
                    <span
                      className={`size-9 shrink-0 border border-line bg-bg-raised-2 ${cls}`}
                    />
                    <div>
                      <div className="font-mono text-[12px] text-accent-ink">
                        {token} <span className="text-gray">{value}</span>
                      </div>
                      <div className="text-[12px] font-medium text-text-dim">
                        {use}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] font-medium text-gray">
                A card never mixes two surface radii.
              </p>
            </Card>

            <Card>
              <Label>Elevation</Label>
              <div className="flex flex-col gap-3">
                {[
                  ["e0", "border only · in-flow cards", ""],
                  ["e1", "card hover", "shadow-e1"],
                  ["e2", "menus, toasts", "shadow-e2"],
                  ["e3", "modals, sheets", "shadow-e3"],
                ].map(([name, use, cls]) => (
                  <div
                    key={name}
                    className={`rounded-md border border-line bg-bg-raised px-4 py-3 ${cls}`}
                  >
                    <div className="font-mono text-[12px] text-accent-ink">
                      {name}
                    </div>
                    <div className="text-[12px] font-medium text-text-dim">
                      {use}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] font-medium text-gray">
                In dark, elevation reads through the surface; in light, through
                the shadow.
              </p>
            </Card>

            <Card>
              <Label>Motion</Label>
              <ul className="flex flex-col gap-2 text-[13px] font-medium text-text-dim">
                <li>Hover, colour, theme — 120–180ms</li>
                <li>Check, chip, switch — 160ms</li>
                <li>Sheet, modal — 240ms</li>
                <li className="font-mono text-[11px] text-gray">
                  cubic-bezier(.2,.8,.2,1)
                </li>
                <li>Reduced motion — honoured, everything becomes 0ms</li>
              </ul>
              <p className="mt-4 text-[12px] font-medium text-gray">
                Nothing lasts longer than 240ms: a cooking app gets read with
                dirty hands.
              </p>
            </Card>
          </div>
        </Section>

        <Section
          num="06"
          title="Buttons"
          intro="Six variants, one role each. Only one primary per view. Hover, focus, pressed, loading and disabled are shown for every variant."
        >
          <Card as="panel" className="flex flex-col gap-6">
            {BUTTON_VARIANTS.map(([variant, label, note]) => (
              <div
                key={variant}
                className="flex flex-col gap-3 border-b border-line pb-6 last:border-0 last:pb-0"
              >
                <div>
                  <div className="text-[13px] font-semibold text-text capitalize">
                    {variant}
                  </div>
                  <div className="font-mono text-[11px] text-gray">{note}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant={variant}>{label}</Button>
                  <Button variant={variant} loading>
                    {label}
                  </Button>
                  <Button variant={variant} disabled>
                    {label}
                  </Button>
                  <Button variant={variant} size="sm">
                    Small
                  </Button>
                  <Button variant={variant} size="lg">
                    Large
                  </Button>
                  {/* 56px: cooking mode, and anything else operated with
                      dirty hands. */}
                  <Button variant={variant} size="xl">
                    Touch
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-3">
              <Label>Icon buttons &amp; full width</Label>
              <div className="flex flex-wrap items-center gap-3">
                <IconButton aria-label="Favourite">♡</IconButton>
                <IconButton aria-label="Favourite" selected>
                  ♥
                </IconButton>
                <IconButton aria-label="Share" variant="secondary">
                  ⇪
                </IconButton>
                <IconButton aria-label="Favourite" disabled>
                  ♡
                </IconButton>
                <IconButton aria-label="Favourite" size="xl">
                  ♡
                </IconButton>
              </div>
              <Button fullWidth>Ajouter au planning</Button>
            </div>
          </Card>
        </Section>

        <Section
          num="07"
          title="Fields"
          intro="Seven states. The focus ring is mint and appears instantly; error and success carry both a border and a hint, never colour alone."
        >
          <Card as="panel" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Objectif calorique" defaultValue="2 000 kcal" />
            <Input
              label="Nombre de personnes"
              placeholder="4 personnes"
              hint="Empty state uses the placeholder in gray"
            />
            <Input
              label="Email"
              defaultValue="camille@"
              status="error"
              hint="Adresse incomplète"
            />
            <Input
              label="Code foyer"
              defaultValue="FUELR-4821"
              status="success"
              hint="Foyer rejoint"
            />
            <Input
              label="Plan foyer"
              defaultValue="Partagé"
              disabled
              hint="Géré par l'admin du foyer"
            />
          </Card>
        </Section>

        <Section num="08" title="Selection controls">
          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <Label>Checkbox</Label>
              <div className="flex flex-col gap-3">
                {["Avocats mûrs", "Épinards frais", "Citrons"].map((item) => (
                  <Checkbox
                    key={item}
                    label={item}
                    checked={!!checked[item]}
                    onChange={() =>
                      setChecked((s) => ({ ...s, [item]: !s[item] }))
                    }
                  />
                ))}
                <Checkbox label="Partiel" indeterminate readOnly checked={false} />
                <Checkbox label="Erreur" error readOnly checked={false} />
                <Checkbox label="Désactivé" disabled readOnly checked={false} />
              </div>
            </Card>

            <Card>
              <Label>Radio</Label>
              <div className="flex flex-col gap-3">
                {["Petit-déjeuner", "Déjeuner", "Dîner"].map((meal) => (
                  <Radio key={meal} name="meal" label={meal} defaultChecked={meal === "Déjeuner"} />
                ))}
                <Radio name="meal-off" label="Désactivé" disabled />
              </div>
            </Card>

            <Card>
              <Label>Switch</Label>
              <div className="flex flex-col gap-3">
                <Switch label="Partager le foyer" defaultChecked />
                <Switch label="Notifications" />
                <Switch label="Désactivé" disabled />
                <Switch label="Activé · désactivé" disabled defaultChecked />
              </div>
            </Card>
          </div>
        </Section>

        <Section num="09" title="Chips, tabs & badges">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <Label>Filter chips</Label>
              <div className="flex flex-wrap gap-3">
                {["Végétarien", "Sans gluten", "Riche en protéines", "Batch cooking"].map(
                  (label) => (
                    <Chip
                      key={label}
                      active={!!chips[label]}
                      onClick={() =>
                        setChips((s) => ({ ...s, [label]: !s[label] }))
                      }
                    >
                      {label}
                    </Chip>
                  ),
                )}
                <Chip active count={3}>
                  Protéines
                </Chip>
                {!removed && (
                  <Chip active onRemove={() => setRemoved(true)}>
                    Moins de 20 min
                  </Chip>
                )}
                <Chip disabled>Sans lactose</Chip>
              </div>
            </Card>

            <Card>
              <Label>Tabs</Label>
              <TabList>
                {["Semaine", "Courses", "Macros"].map((t) => (
                  <Tab key={t} active={tab === t} onClick={() => setTab(t)}>
                    {t}
                  </Tab>
                ))}
                <Tab disabled>Bientôt</Tab>
              </TabList>

              <div className="mt-6">
                <Label>Badges</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="solid">Populaire</Badge>
                  <Badge tone="accent">Nouveau</Badge>
                  <Badge tone="mint">Planifié</Badge>
                  <Badge tone="coral">Périmé</Badge>
                  <Badge>Gratuit</Badge>
                </div>
              </div>
            </Card>
          </div>
        </Section>

        <Section
          num="10"
          title="Cards"
          intro="Recipe cards lift 3px and zoom the photo 1.04 on hover. Selected carries an accent border and a check; unavailable drops to 55% and stops responding."
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <RecipeCard
              title="Bowl quinoa & légumes rôtis"
              meta="4 personnes · 25 min"
              data="520 kcal · 600 g"
              tag="Végé"
              favorite={favorite}
              onToggleFavorite={() => setFavorite((f) => !f)}
            />
            <RecipeCard
              title="Saumon grillé, riz citronné"
              meta="2 personnes · 30 min"
              data="640 kcal · 450 g"
              selected
            />
            <RecipeCard
              title="Curry de lentilles corail"
              meta="6 personnes · 40 min"
              data="480 kcal · 900 g"
            />
            <RecipeCard
              title="Wrap poulet & avocat"
              meta="1 personne · 10 min"
              data="510 kcal · 320 g"
              unavailable
            />
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Card interactive>
              <CardTitle>Interactive card</CardTitle>
              <CardBody>
                The generic card takes the same hover elevation when it is
                clickable. It uses the medium radius; panels use the large one.
              </CardBody>
            </Card>
            <Card as="panel">
              <CardTitle>Panel</CardTitle>
              <CardBody>
                Panels carry more padding and the 20px radius. They group cards
                and controls rather than content of their own.
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section
          num="11"
          title="Icons"
          intro="One 24-unit grid, one 1.7 stroke, currentColor. They were typographic characters before this — `⧉` for duplicate, which nobody reads as duplicate, and no glyph at all for edit, which is why that action had no button. Every icon is aria-hidden: the control around it carries the name."
        >
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {(
              [
                "arrowUp",
                "arrowDown",
                "pencil",
                "copy",
                "trash",
                "close",
                "star",
                "check",
                "plus",
                "minus",
                "search",
                "chevronRight",
                "chevronDown",
                "book",
                "calendar",
                "cart",
                "journal",
              ] as const
            ).map((name) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2 rounded-md border border-line bg-bg-raised px-2 py-4 text-text-dim"
              >
                <Icon name={name} size={22} />
                <span className="font-mono text-[10px] text-gray">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          num="12"
          title="List rows"
          intro="A line in a list, written once — the shopping list, the journal, the household and the library all drew their own before this. The line is the surface, not the rule between two of them: a row separated by a hairline has no visible target to aim at. Below 480px the row wraps and the action rail drops to its own line."
        >
          <ul className="flex flex-col gap-2">
            <ListRow
              as="li"
              interactive
              selected
              leading={
                <span className="grid size-11 shrink-0 place-items-center rounded-full text-accent-ink">
                  <Icon name="star" size={20} filled />
                </span>
              }
              trailing={
                <ListRowActions>
                  <IconButton aria-label="Monter" variant="quiet" disabled>
                    <Icon name="arrowUp" />
                  </IconButton>
                  <IconButton aria-label="Modifier" variant="quiet">
                    <Icon name="pencil" />
                  </IconButton>
                  <IconButton aria-label="Dupliquer" variant="quiet">
                    <Icon name="copy" />
                  </IconButton>
                  <IconButton aria-label="Supprimer" variant="dangerText">
                    <Icon name="trash" />
                  </IconButton>
                </ListRowActions>
              }
            >
              <ListRowTitle>Curry de lentilles corail</ListRowTitle>
              <ListRowMeta>
                4 personnes · 40 min ·{" "}
                <span className="tnum font-mono text-gray">
                  480 kcal · 22 P · 58 G · 14 L
                </span>
              </ListRowMeta>
            </ListRow>

            <ListRow
              as="li"
              interactive
              leading={
                <span className="grid size-11 shrink-0 place-items-center rounded-full text-gray">
                  <Icon name="star" size={20} />
                </span>
              }
              trailing={
                <ListRowActions>
                  {/* Not applicable here, and disabled in place rather than
                      removed: a control that comes and goes moves the ones
                      after it, and the one you land on when you miss is the
                      one that cannot be undone. */}
                  <IconButton aria-label="Monter" variant="quiet" disabled>
                    <Icon name="arrowUp" />
                  </IconButton>
                  <IconButton aria-label="Modifier" variant="quiet">
                    <Icon name="pencil" />
                  </IconButton>
                  <IconButton aria-label="Dupliquer" variant="quiet">
                    <Icon name="copy" />
                  </IconButton>
                  <IconButton aria-label="Supprimer" variant="dangerText">
                    <Icon name="trash" />
                  </IconButton>
                </ListRowActions>
              }
            >
              <ListRowTitle>Soupe de courge rôtie</ListRowTitle>
              <ListRowMeta>
                6 personnes · 45 min ·{" "}
                <span className="tnum font-mono text-gray">
                  414 kcal · 9 P · 52 G · 18 L
                </span>
              </ListRowMeta>
            </ListRow>

            <ListRow
              as="li"
              leading={
                <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-bg-raised-2 font-display text-[13px] font-extrabold text-text-dim">
                  LC
                </span>
              }
              trailing={
                <span className="tnum font-mono text-[13px] font-bold text-text">
                  400 g
                </span>
              }
            >
              <ListRowTitle>Lentilles corail</ListRowTitle>
              <ListRowMeta>Épicerie · 2 recettes</ListRowMeta>
            </ListRow>
          </ul>
        </Section>

        <Section
          num="13"
          title="Segmented control"
          intro="One among few, chosen once. There were four of these — the pricing cycle, the three ways into the editor, the onboarding answers, the library's all/favourites — and each drew &quot;chosen&quot; differently. A track with a filled cursor, because a 14% tint reads as &quot;on&quot; only on a screen you are looking straight at. It is not a tab list and does not claim to be: role=group with aria-pressed says what it is."
        >
          <div className="flex flex-col gap-5">
            <Segmented
              label="Cycle"
              value={cycle}
              onChange={setCycle}
              options={[
                { value: "monthly", label: "Mensuel" },
                { value: "yearly", label: "Annuel" },
              ]}
            />
            <Segmented
              label="Filtrer les recettes"
              value={scope}
              onChange={setScope}
              options={[
                { value: "all", label: "Toutes" },
                {
                  value: "favorites",
                  label: "Favoris",
                  affix: (
                    <SegmentedCount count={3} on={scope === "favorites"} />
                  ),
                },
              ]}
            />
            <div className="max-w-xs">
              <Segmented
                label="Objectif"
                orientation="vertical"
                value={goal}
                onChange={setGoal}
                options={[
                  { value: "lose", label: "Perdre du poids" },
                  { value: "maintain", label: "Maintenir mon poids" },
                  { value: "gain", label: "Prendre de la masse" },
                ]}
              />
              <p className="mt-2 text-[12px] font-medium text-gray">
                Vertical for options too long to sit side by side. Still one
                among few: what changes is the room, not the question.
              </p>
            </div>
          </div>
        </Section>

        <Section
          num="14"
          title="Stepper"
          intro="Fewer, more. Four copies existed — cooking mode, the editor, the meal sheet, the household size — differing in the button variant, the size of the figure, and whether the bounds were enforced on the click or only on the label. In one, the minus was an en dash and in another a minus sign, which is the kind of difference that survives for years because nobody can see it. The bounds live here now."
        >
          <div className="flex flex-wrap items-end gap-8">
            <div className="flex flex-col gap-2">
              <Label>md · 44px</Label>
              <Stepper
                value={servings}
                onChange={setServings}
                max={12}
                decreaseLabel="Moins de personnes"
                increaseLabel="Plus de personnes"
              >
                {servings} personnes
              </Stepper>
            </div>
            <div className="flex flex-col gap-2">
              <Label>xl · 56px · cooking mode</Label>
              <Stepper
                value={servings}
                onChange={setServings}
                max={12}
                decreaseLabel="Moins de personnes"
                increaseLabel="Plus de personnes"
                size="xl"
              >
                {servings} personnes
              </Stepper>
            </div>
          </div>
        </Section>

        <Section
          num="15"
          title="Section head"
          intro="A block's title, and the action that belongs to it. Title left, action right, everywhere — guidance in Bastien and Scapin's sense: what a block can do belongs beside the block, so nothing has to be looked for. On a narrow screen it wraps rather than shrinking the title."
        >
          <div className="flex flex-col gap-6">
            <div>
              <SectionHead
                action={
                  <a
                    href="#"
                    className="text-[12.5px] font-bold text-mint-ink hover:underline"
                  >
                    Tout l&apos;historique →
                  </a>
                }
              >
                Repas notés
              </SectionHead>
              <p className="mt-2 text-[13px] font-medium text-text-dim">
                The block this titles goes here.
              </p>
            </div>
            <SectionHead hint="Sur les sept derniers jours, hors jours non notés.">
              Énergie
            </SectionHead>
          </div>
        </Section>

        <Section
          num="16"
          title="Banners"
          intro="Three tones, because the system gives one meaning per colour. Errors take role=alert and interrupt; the rest wait their turn. `position=&quot;fixed&quot;` pins one to the bottom of the viewport for something wrong with the page as a whole."
        >
          <div className="flex flex-col gap-3">
            <Banner tone="error" title="Cette page ne répond pas">
              Elle s&apos;est affichée, mais son code ne s&apos;est pas chargé :
              les boutons ne feront rien.
            </Banner>
            <Banner tone="success">Mot de passe modifié.</Banner>
            <Banner tone="info" onDismiss={() => {}} dismissLabel="Fermer">
              Confirme ton adresse pour que Fuelr puisse te joindre.
            </Banner>
          </div>
        </Section>

        <Section
          num="17"
          title="Dialogs"
          intro="One modal for the whole app. The overlay scrolls and the card is capped at the visible height, so the bottom of a long sheet is reachable on a 360×480 screen; the head stays put while the body scrolls. Escape closes it and focus opens on the close button."
        >
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Ouvrir un dialogue
            </Button>
          </div>
          {dialogOpen && (
            <Dialog
              title="Retirer du planning ?"
              closeLabel="Fermer"
              onClose={() => setDialogOpen(false)}
            >
              <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
                Le repas de mardi soir. La recette reste dans la bibliothèque.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="danger" onClick={() => setDialogOpen(false)}>
                  Retirer
                </Button>
                <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
              </div>
            </Dialog>
          )}
        </Section>

        <Section num="18" title="Data & system states">
          <div className="grid gap-5 md:grid-cols-2">
            <EmptyState
              icon="◷"
              title="Ta liste de courses est vide"
              body="Ajoute des recettes au planning et les ingrédients arriveront ici automatiquement."
              action={<Button>Ouvrir le planning</Button>}
            />
            <EmptyState
              tone="error"
              icon="!"
              title="Chargement impossible"
              body="La connexion a été interrompue. Tes recettes enregistrées restent disponibles hors ligne."
              action={<Button variant="secondary">Réessayer</Button>}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
