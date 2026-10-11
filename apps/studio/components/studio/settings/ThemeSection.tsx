"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { cn } from "cn";
import type { ThemeToken } from "@jotdown/core/lib/theme";
import { useDraft } from "./draft";
import { withValue } from "@/lib/settings/config-draft";
import { SettingsBlock, SettingsGroup, SettingsRow } from "./parts";
import { Colours, type ColourMode } from "./theme/Colours";
import { Fonts } from "./theme/Fonts";
import { PasteTheme } from "./theme/PasteTheme";
import { Presets } from "./theme/Presets";

/**
 * The project's look: a palette to start from, every colour of both modes, the radius, the typefaces and the section accents.
 *
 * Every change repaints the studio straight away, the panel included, so the
 * panel is its own preview. Editing the other mode's colours switches the
 * studio to that mode, and leaving the section puts the editor's own back.
 *
 * @example <ThemeSection folders={["guides", "reference"]} />
 */
export function ThemeSection({ folders }: { folders: string[] }) {
  const { forcedTheme, resolvedTheme, theme, setTheme } = useTheme();
  const mode: ColourMode = (forcedTheme ?? resolvedTheme) === "dark" ? "dark" : "light";
  const preference = useRef<string | undefined>(undefined);
  const restore = useRef(setTheme);
  restore.current = setTheme;

  function showMode(next: ColourMode) {
    preference.current ??= theme;
    setTheme(next);
  }

  useEffect(
    () => () => {
      if (preference.current) restore.current(preference.current);
    },
    [],
  );

  return (
    <>
      <SettingsGroup title="Palette" action={<PasteTheme />}>
        <SettingsBlock keywords="palette preset theme scheme colours">
          <Presets />
        </SettingsBlock>
      </SettingsGroup>
      <Colours mode={mode} onMode={showMode} />
      <Shape />
      <Fonts />
      <Accents folders={folders} />
    </>
  );
}

const RADII = ["0rem", "0.25rem", "0.375rem", "0.5rem", "0.625rem", "0.75rem", "1rem", "1.25rem"];

/** The corner radius every card, button and input takes, with a few of them drawn at it. */
function Shape() {
  const { config, update } = useDraft();
  const radius = config?.theme?.radius;
  const at = Math.max(0, RADII.indexOf(radius ?? "0.625rem"));

  return (
    <SettingsGroup title="Shape">
      <SettingsRow
        label="Corner radius"
        description="Cards, buttons, inputs and code blocks."
        paths={["theme.radius"]}
        keywords="rounded corners border-radius"
      >
        <span className="w-16 rounded-md bg-muted px-1.5 py-0.5 text-center font-mono text-xs tabular-nums">
          {radius ?? "default"}
        </span>
        <input
          type="range"
          aria-label="Corner radius"
          min={0}
          max={RADII.length - 1}
          step={1}
          value={at}
          onChange={(event) =>
            update((current) => withValue(current, "theme.radius", RADII[Number(event.target.value)]))
          }
          className="w-40 accent-primary"
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

const ACCENTS: { token: ThemeToken | undefined; label: string }[] = [
  { token: undefined, label: "None" },
  { token: "primary", label: "Primary" },
  { token: "chart-1", label: "Chart 1" },
  { token: "chart-2", label: "Chart 2" },
  { token: "chart-3", label: "Chart 3" },
  { token: "chart-4", label: "Chart 4" },
  { token: "chart-5", label: "Chart 5" },
];

/**
 * A colour for each top-level folder, which its section's pages wear on their icons and headings.
 *
 * The folders come from the pages; a folder the config names that has no pages
 * yet is listed as well, so its accent can still be taken off.
 */
function Accents({ folders }: { folders: string[] }) {
  const { config, update } = useDraft();
  const sections = config?.theme?.sections ?? {};
  const listed = [...new Set([...folders, ...Object.keys(sections)])].sort();
  if (listed.length === 0) return null;

  return (
    <SettingsGroup title="Section accents">
      {listed.map((folder) => {
        const path = `theme.sections.${folder}`;
        const chosen = sections[folder];

        return (
          <SettingsRow key={folder} label={folder} paths={[path]} keywords="accent section folder colour">
            <div role="radiogroup" aria-label={`Accent for ${folder}`} className="flex items-center gap-1.5">
              {ACCENTS.map(({ token, label }) => (
                // biome-ignore lint/a11y/useSemanticElements: a swatch that is one choice of several
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={chosen === token}
                  aria-label={label}
                  title={label}
                  onClick={() => update((current) => withValue(current, path, token))}
                  className={cn(
                    "grid size-6 place-items-center rounded-full outline-none ring-offset-2 ring-offset-card transition-shadow focus-visible:ring-2 focus-visible:ring-ring aria-checked:ring-2 aria-checked:ring-foreground/70",
                    !token && "border border-border border-dashed",
                  )}
                >
                  {token && <span className="size-4.5 rounded-full" style={{ background: `var(--${token})` }} />}
                </button>
              ))}
            </div>
          </SettingsRow>
        );
      })}
    </SettingsGroup>
  );
}
