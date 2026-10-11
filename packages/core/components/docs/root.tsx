"use client";

import { useEffect, useEffectEvent, type ComponentProps, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { NextProvider } from "fumadocs-core/framework/next";
import { SearchProvider } from "./search";

type RootProviderProps = {
  /** The link every layout link is drawn with. */
  link?: ComponentProps<typeof NextProvider>["Link"];
  /** The page's search, or none. */
  search?: Omit<ComponentProps<typeof SearchProvider>, "children">;
  /** Overrides for the colour mode; `hotKey: false` turns off the D key that flips it. */
  theme?: ComponentProps<typeof ThemeProvider> & { hotKey?: false };
  children: ReactNode;
};

/**
 * What every page sits in: the link component, the colour mode with its D key, and search.
 *
 * The colour mode is the `.dark` class on `<html>`, following the system until
 * the reader picks one. Adapted from Fumadocs UI, MIT.
 *
 * @example <RootProvider link={SiteLink} search={{ dialog: ProjectSearch, shortcut, keys }}>{page}</RootProvider>
 */
export function RootProvider({ link, search, theme = {}, children }: RootProviderProps) {
  const { hotKey, ...themeProps } = theme;
  const body = search ? <SearchProvider {...search}>{children}</SearchProvider> : children;

  return (
    <NextProvider Link={link}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...themeProps}>
        {hotKey !== false && <ThemeHotKey />}
        {body}
      </ThemeProvider>
    </NextProvider>
  );
}

/**
 * Flips between light and dark on the D key, unless the reader is typing or in a dialog.
 *
 * @example <ThemeHotKey />
 */
function ThemeHotKey() {
  const { setTheme, resolvedTheme } = useTheme();

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() !== "d" || isTyping(event.target)) return;
    event.preventDefault();
    const next = resolvedTheme === "dark" ? "light" : "dark";
    if (document.startViewTransition) document.startViewTransition(() => flushSync(() => setTheme(next)));
    else setTheme(next);
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}

/**
 * Whether a key press lands in something the reader types into, or inside an open dialog.
 *
 * @example isTyping(document.querySelector("input")); // true
 */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;
  return target.closest('[role="dialog"]') !== null;
}
