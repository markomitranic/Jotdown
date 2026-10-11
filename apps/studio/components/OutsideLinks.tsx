"use client";

import { useEffect } from "react";

/**
 * Sends links to other sites out of the app's window, to the default browser.
 *
 * The window only ever shows the studio, so a click on a link to another
 * origin opens it as a new window, which the app hands to the default browser.
 * Rendered only inside the app; a browser tab follows links as usual.
 *
 * @example {env.JOTDOWN_APP && <OutsideLinks />}
 */
export function OutsideLinks() {
  useEffect(() => {
    function leave(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      const link = (event.target as Element | null)?.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;

      const url = new URL(link.href, location.href);
      const outside = url.protocol === "mailto:" || (/^https?:$/.test(url.protocol) && url.origin !== location.origin);
      if (!outside) return;

      event.preventDefault();
      window.open(url.href, "_blank", "noopener");
    }

    document.addEventListener("click", leave);
    return () => document.removeEventListener("click", leave);
  }, []);

  return null;
}
