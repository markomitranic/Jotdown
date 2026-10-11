"use client";

/**
 * The one thing standing between unsaved writing and a stray click.
 *
 * Shared by every editing surface on the page, because the browser gives you
 * exactly one chance to ask and two of these fighting would ask twice.
 */

import { useEffect } from "react";

let activeGuards = 0;

/** Reports whether any editor currently holds unsaved changes. */
export function hasUnsavedChanges() {
  return activeGuards > 0;
}

const LEAVE_PROMPT = "You have edits that were never saved. Leave this page and lose them?";

/**
 * Warns before a tab close or a click through the site while work is unsaved.
 *
 * `beforeunload` covers leaving the site altogether. The router never unloads
 * the page, so a link is caught by a capture-phase listener on `document`,
 * which runs before React's own and therefore before the router sees the
 * click. Both hang off an effect, so neither runs during the prerender.
 *
 * Back and forward are not covered: nothing in the app router can stop a
 * history entry from being popped, so the browser's own buttons will take the
 * unsaved text with them.
 *
 * @example useLeaveGuard(dirty);
 */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    activeGuards += 1;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const ask = (event: MouseEvent) => {
      if (!leadsAway(event) || window.confirm(LEAVE_PROMPT)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", ask, true);

    return () => {
      activeGuards -= 1;
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", ask, true);
    };
  }, [active]);
}

/**
 * Whether a click is about to replace the page the editor is open on.
 *
 * A modified click, a download and a new tab all leave this page where it is,
 * a bare fragment only moves the scroll position, and anything off our own
 * origin is a real navigation that `beforeunload` will catch on its own.
 *
 * @example leadsAway(event); // true for a sidebar link
 */
function leadsAway(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const clicked = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(clicked instanceof HTMLAnchorElement)) return false;
  if (clicked.target === "_blank" || clicked.hasAttribute("download")) return false;

  const to = new URL(clicked.href, window.location.href);
  if (to.origin !== window.location.origin) return false;

  return to.pathname !== window.location.pathname || to.search !== window.location.search;
}
