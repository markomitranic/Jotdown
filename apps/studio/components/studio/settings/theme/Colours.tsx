"use client";

import { useState } from "react";
import { cn } from "cn";
import { MoonStar, Plus } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@jotdown/core/components/ui/dropdown-menu";
import { Input } from "@jotdown/core/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { COLOUR, CORE_TOKENS, DERIVED_TOKEN_NAMES, type ThemeToken } from "@jotdown/core/lib/theme";
import { DEFAULT_COLOURS, contrast, contrastLevel, deriveDark, hexOf } from "@/lib/settings/colour";
import { useDraft } from "../draft";
import { withValue } from "@/lib/settings/config-draft";
import { Segmented, SettingsGroup, SettingsRow } from "../parts";

export type ColourMode = "light" | "dark";

/** What each token is called in the panel, and what it paints. */
const TOKENS: Partial<Record<ThemeToken, { label: string; description: string }>> = {
  background: { label: "Background", description: "The page, behind everything." },
  foreground: { label: "Text", description: "Body text and headings." },
  primary: { label: "Primary", description: "Links, buttons, the current page and the stripe." },
  destructive: { label: "Destructive", description: "Errors, warnings and anything that deletes." },
  "chart-1": { label: "Chart 1", description: "The first series of a chart, and a section accent." },
  "chart-2": { label: "Chart 2", description: "The second series, and a section accent." },
  "chart-3": { label: "Chart 3", description: "The third series, and a section accent." },
  "chart-4": { label: "Chart 4", description: "The fourth series, and a section accent." },
  "chart-5": { label: "Chart 5", description: "The fifth series, and a section accent." },
  card: { label: "Card", description: "Cards, the sidebar and code blocks." },
  popover: { label: "Popover", description: "Menus, tooltips and dialogs." },
  ring: { label: "Focus ring", description: "The outline around whatever has the keyboard." },
  border: { label: "Border", description: "Hairlines between things." },
  muted: { label: "Muted", description: "Quiet fills, like inline code." },
  "muted-foreground": { label: "Muted text", description: "Descriptions and secondary text." },
  accent: { label: "Accent", description: "What a hovered row lights up with." },
  secondary: { label: "Secondary", description: "Secondary buttons and fills." },
  sidebar: { label: "Sidebar", description: "The sidebar's own ground." },
};

/** The tokens whose contrast against the background is worth measuring, as text on it. */
const MEASURED = new Set<ThemeToken>(["foreground", "primary", "destructive", "muted-foreground"]);

/**
 * Every colour of one mode, with the mode to edit picked at the top.
 *
 * The core colours are always listed. Any other token is worked out from them
 * until somebody pins it, which lists it too. Switching the mode here switches
 * the studio's, so what is edited is what is on screen.
 *
 * @example <Colours mode="light" onMode={setMode} />
 */
export function Colours({ mode, onMode }: { mode: ColourMode; onMode: (mode: ColourMode) => void }) {
  const { config, update } = useDraft();
  const set = config?.theme?.[mode] ?? {};
  const pinned = DERIVED_TOKEN_NAMES.filter((token) => set[token] !== undefined);
  const unpinned = DERIVED_TOKEN_NAMES.filter((token) => set[token] === undefined);
  const background = set.background ?? DEFAULT_COLOURS[mode].background;

  function deriveFromLight() {
    update((current) => withValue(current, "theme.dark", deriveDark(current.theme?.light ?? {})));
  }

  function pin(token: ThemeToken) {
    const shown = computedColour(token);
    update((current) => withValue(current, `theme.${mode}.${token}`, shown ?? DEFAULT_COLOURS[mode].foreground));
  }

  return (
    <SettingsGroup
      title="Colours"
      action={
        <>
          {mode === "dark" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="xs" onClick={deriveFromLight}>
                  <MoonStar aria-hidden="true" />
                  Derive from light
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Replaces the dark colours with ones worked out from the light mode
              </TooltipContent>
            </Tooltip>
          )}
          <Segmented
            label="Mode to edit"
            value={mode}
            onChange={onMode}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </>
      }
    >
      {[...CORE_TOKENS, ...pinned].map((token) => (
        <ColourRow key={token} mode={mode} token={token} background={background} />
      ))}
      <SettingsRow label="More colours" keywords="pin token override border ring card popover sidebar muted accent">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={unpinned.length === 0}>
              <Plus aria-hidden="true" />
              Pin a colour
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80">
            {unpinned.map((token) => (
              <DropdownMenuItem key={token} onSelect={() => pin(token)}>
                {TOKENS[token]?.label ?? token}
                <span className="ms-auto ps-4 font-mono text-muted-foreground text-xs">{token}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SettingsRow>
    </SettingsGroup>
  );
}

type RowProps = { mode: ColourMode; token: ThemeToken; background: string };

function ColourRow({ mode, token, background }: RowProps) {
  const { config, update } = useDraft();
  const path = `theme.${mode}.${token}`;
  const value = config?.theme?.[mode]?.[token];
  const fallback = DEFAULT_COLOURS[mode][token as keyof (typeof DEFAULT_COLOURS)["light"]];
  const named = TOKENS[token] ?? { label: token, description: "Pinned, rather than worked out from the core colours." };
  const ratio = MEASURED.has(token) ? contrast(value ?? fallback ?? "", background) : null;

  return (
    <SettingsRow
      label={named.label}
      description={named.description}
      paths={[path]}
      keywords={`${token} colour color ${mode}`}
      aside={ratio !== null && <ContrastBadge ratio={ratio} />}
    >
      <ColourInput
        label={named.label}
        value={value}
        fallback={fallback}
        onChange={(next) => update((current) => withValue(current, path, next))}
      />
    </SettingsRow>
  );
}

/**
 * A colour well beside the colour as text, which takes any colour the theme can hold.
 *
 * Text is only written to the draft once it reads as a colour, and an empty
 * field takes the colour out, so the token falls back.
 *
 * @example <ColourInput label="Primary" value="#433a86" onChange={setPrimary} />
 */
export function ColourInput({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback?: string;
  onChange: (value: string | undefined) => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const swatch = value ?? fallback;

  function type(text: string) {
    setTyped(text);
    const colour = text.trim();
    if (colour === "") onChange(undefined);
    else if (COLOUR.test(colour)) onChange(colour);
  }

  return (
    <div className="flex items-center gap-1.5">
      <label
        className={cn(
          "relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md transition-shadow focus-within:ring-2 focus-within:ring-ring",
          !value && "bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-size-[8px_8px]",
        )}
      >
        <span className="absolute inset-0" style={{ background: swatch }} />
        <span
          className={cn(
            "pointer-events-none absolute inset-0 rounded-md border border-foreground/15",
            !value && "border-foreground/30 border-dashed",
          )}
        />
        <input
          type="color"
          aria-label={`${label}, pick a colour`}
          value={hexOf(swatch ?? "") ?? "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <Input
        aria-label={`${label}, as text`}
        value={typed ?? value ?? ""}
        placeholder={fallback ? `${fallback} default` : "Worked out"}
        spellCheck={false}
        onChange={(event) => type(event.target.value)}
        onBlur={() => setTyped(null)}
        aria-invalid={typed !== null && typed.trim() !== "" && !COLOUR.test(typed.trim())}
        className="h-7 w-44 font-mono text-xs"
      />
    </div>
  );
}

/** A contrast ratio against the background, flagged when body text in it would be hard to read. */
function ContrastBadge({ ratio }: { ratio: number }) {
  const level = contrastLevel(ratio);
  const low = level === "Low" || level === "Large text";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "rounded px-1 py-px font-mono text-[0.625rem] tabular-nums leading-4",
            low ? "bg-destructive/12 text-destructive" : "bg-muted text-muted-foreground",
          )}
        >
          {ratio.toFixed(1)} {level === "Large text" ? "AA large" : level}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {low
          ? "Under 4.5:1 against the background, hard to read as body text"
          : `${ratio.toFixed(1)}:1 against the background, readable as body text`}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A token's colour as the page paints it now, for pinning a worked-out token at the colour it already has.
 *
 * @example computedColour("card"); // "#f7f6fc"
 */
function computedColour(token: ThemeToken) {
  const probe = document.createElement("span");
  probe.style.color = `var(--${token})`;
  document.body.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return hexOf(colour);
}
