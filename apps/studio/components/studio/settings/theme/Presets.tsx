"use client";

import type { CSSProperties } from "react";
import { cn } from "cn";
import { Moon, Sun } from "lucide-react";
import type { Theme } from "@jotdown/core/lib/theme";
import { PALETTES, type Palette } from "@/lib/setup";
import { DEFAULT_COLOURS } from "@/lib/settings/colour";
import { useDraft } from "../draft";
import { withValue } from "@/lib/settings/config-draft";

type Mode = NonNullable<Theme["light"]>;

/**
 * The starting palettes as cards of two orbs, light and dark, and the project's own when it matches none.
 *
 * Choosing one replaces both modes' colours, charts and pinned tokens included,
 * and leaves the radius, fonts and section accents alone. Neutral is the
 * framework's own palette, so it takes the colours out rather than writing them.
 *
 * @example <Presets />
 */
export function Presets() {
  const { config, update } = useDraft();
  const theme = config?.theme;
  const chosen = PALETTES.find((palette) => matches(palette, theme));
  const custom = !chosen && (theme?.light || theme?.dark);

  function choose(palette: Palette) {
    const neutral = palette.id === "neutral";
    update((current) =>
      withValue(
        withValue(current, "theme.light", neutral ? undefined : { ...palette.light }),
        "theme.dark",
        neutral ? undefined : { ...palette.dark },
      ),
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-4" role="radiogroup" aria-label="Palette">
      {PALETTES.map((palette) => (
        <PresetCard
          key={palette.id}
          name={palette.name}
          light={palette.light}
          dark={palette.dark}
          checked={palette === chosen}
          onChoose={() => choose(palette)}
        />
      ))}
      {custom && <PresetCard name="This project" light={theme?.light ?? {}} dark={theme?.dark ?? {}} checked />}
    </div>
  );
}

type CardProps = { name: string; light: Mode; dark: Mode; checked: boolean; onChoose?: () => void };

function PresetCard({ name, light, dark, checked, onChoose }: CardProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a card that is one choice of several
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onChoose}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border border-border bg-background p-3 text-start outline-none transition-[border-color,box-shadow] hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring",
        checked && "border-primary/60 ring-1 ring-primary/60 hover:border-primary/60",
      )}
    >
      <span className="flex items-center justify-center gap-2.5 py-1.5">
        <Orb mode={{ ...DEFAULT_COLOURS.light, ...light }} checked={checked} icon="light" />
        <Orb mode={{ ...DEFAULT_COLOURS.dark, ...dark }} checked={checked} icon="dark" />
      </span>
      <span className="font-medium text-sm">{name}</span>
    </button>
  );
}

/** A sphere in one mode's colours: its ground catching the light, its primary in the body, its ink in the shade. */
function Orb({ mode, checked, icon }: { mode: Mode; checked: boolean; icon: "light" | "dark" }) {
  const Icon = icon === "light" ? Sun : Moon;
  const style = {
    background: `radial-gradient(120% 120% at 30% 22%, color-mix(in oklab, ${mode.primary} 22%, ${mode.background}) 0%, ${mode.primary} 52%, color-mix(in oklab, ${mode.primary} 55%, ${mode.foreground}) 100%)`,
  } satisfies CSSProperties;

  return (
    <span
      className={cn(
        "relative size-11 rounded-full shadow-[inset_0_-6px_12px_rgb(0_0_0/0.18),inset_0_4px_8px_rgb(255_255_255/0.25)] ring-1 ring-foreground/10",
        checked && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      style={style}
    >
      {checked && (
        <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-background text-foreground ring-1 ring-border">
          <Icon className="size-2.5" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

/** Whether a theme's colours are exactly a palette's, which for Neutral means none at all. */
function matches(palette: Palette, theme: Theme | undefined) {
  if (palette.id === "neutral") return !theme?.light && !theme?.dark;
  return sameMode(palette.light, theme?.light) && sameMode(palette.dark, theme?.dark);
}

function sameMode(palette: Mode, mode: Mode | undefined) {
  if (!mode) return false;
  const keys = Object.keys(mode);
  return (
    keys.length === Object.keys(palette).length &&
    keys.every((key) => mode[key as keyof Mode] === palette[key as keyof Mode])
  );
}
