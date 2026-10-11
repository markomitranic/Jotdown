"use client";

import { useEffect } from "react";

/**
 * Paints the installed app's title bar, and a phone browser's toolbar, in the page's own background.
 *
 * The colour is read off the body rather than named, so it follows the colour
 * mode and the open project's theme as each one arrives.
 * A page painted to the window's edge names its own in `data-title-bar-colour`,
 * since the browser fills the corners beside the window's buttons with it.
 *
 * @example <TitleBarColour />
 */
export function TitleBarColour() {
  useEffect(() => {
    const meta = themeColorMeta();
    const paint = () => {
      const painted = document.querySelector<HTMLElement>("[data-title-bar-colour]");
      meta.content = painted?.dataset.titleBarColour ?? getComputedStyle(document.body).backgroundColor;
    };

    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    document.addEventListener("load", paint, true);
    paint();

    return () => {
      observer.disconnect();
      document.removeEventListener("load", paint, true);
    };
  }, []);

  return null;
}

/**
 * Returns the page's `theme-color` meta tag, adding one when the page has none.
 *
 * @example themeColorMeta().content = "#000000";
 */
function themeColorMeta() {
  const existing = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (existing) return existing;

  const meta = document.createElement("meta");
  meta.name = "theme-color";
  document.head.append(meta);
  return meta;
}
