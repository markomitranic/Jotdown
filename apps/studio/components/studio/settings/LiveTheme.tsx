"use client";

import { useEffect, useRef } from "react";
import { wearDraftTheme } from "@jotdown/core/lib/draft-theme";
import { themeSchema, themeStylesheet, type Theme } from "@jotdown/core/lib/theme";
import { useDraft } from "./draft";

/**
 * The theme the settings draft is trying on, or null while the draft leaves the theme as saved.
 *
 * A draft theme that does not read yet, half a hex code say, gives the last one
 * that did, so the page holds still while somebody types.
 *
 * @example const theme = useDraftTheme(); // { light: { primary: "#433a86" } }
 */
export function useDraftTheme(): Theme | null {
  const draft = useDraft();
  const touched = draft.changes.some((path) => path === "theme" || path.startsWith("theme."));
  const lastGood = useRef<Theme>({});

  const checked = themeSchema.safeParse(draft.config?.theme ?? {});
  if (checked.success) lastGood.current = checked.data;
  return touched ? lastGood.current : null;
}

/**
 * Paints the studio in the draft's theme while it differs from the saved one, and the saved one again after.
 *
 * Only for a project the studio draws itself: the studio's chrome around a
 * site's canvas keeps its own look, and the canvas is sent the draft instead.
 *
 * @example <LiveTheme />
 */
export function LiveTheme() {
  const { base } = useDraft();
  const theme = useDraftTheme();
  const css = theme && themeStylesheet(theme, base);

  useEffect(() => {
    if (css === null) return;
    wearDraftTheme(css);
    return () => wearDraftTheme(null);
  }, [css]);

  return null;
}
