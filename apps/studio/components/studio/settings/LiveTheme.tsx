"use client";

import { useEffect, useRef } from "react";
import { wearBrand } from "@jotdown/core/lib/wear-brand";
import { themeSchema, themeStylesheet, type Theme } from "@jotdown/core/lib/theme";
import { changedPaths } from "@/lib/settings/config-draft";
import { useDraft } from "./draft";

/**
 * The theme the settings draft is trying on, or null while it matches the theme it is compared with.
 *
 * A draft theme that does not read yet, half a hex code say, gives the last one
 * that did, so the page holds still while somebody types. Nothing is tried on
 * before the config has been read.
 *
 * @example const theme = useDraftTheme(project.theme); // { light: { primary: "#433a86" } }
 */
export function useDraftTheme(baseline: Theme | undefined): Theme | null {
  const draft = useDraft();
  const lastGood = useRef<Theme>({});

  const checked = themeSchema.safeParse(draft.config?.theme ?? {});
  if (checked.success) lastGood.current = checked.data;

  if (draft.status !== "ready") return null;
  return changedPaths(baseline ?? {}, lastGood.current).length === 0 ? null : lastGood.current;
}

/**
 * Paints the studio in the draft's theme while it differs from the theme the page was drawn with.
 *
 * Compared with the page rather than the saved config, so a theme just saved
 * stays on until the refreshed page arrives wearing it. Only for a project the
 * studio draws itself: the studio's chrome around a site's canvas keeps its own
 * look, and the canvas is sent the draft instead.
 *
 * @example <LiveTheme pageTheme={project.config.theme} />
 */
export function LiveTheme({ pageTheme }: { pageTheme: Theme | undefined }) {
  const { base } = useDraft();
  const theme = useDraftTheme(pageTheme);
  const css = theme && themeStylesheet(theme, base);

  useEffect(() => {
    if (css === null) return;
    return wearBrand(css || null);
  }, [css]);

  return null;
}
