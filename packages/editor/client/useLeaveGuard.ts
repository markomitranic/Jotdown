"use client";

/**
 * The one thing standing between unsaved writing and a stray click.
 *
 * Shared by every editing surface on the page, because the browser gives you
 * exactly one chance to ask and two of these fighting would ask twice.
 */

import { useEffect } from "react";
import { confirmInPage } from "@jotdown/core/components/confirm";

let activeGuards = 0;

/** Reports whether any editor currently holds unsaved changes. */
export function hasUnsavedChanges() {
  return activeGuards > 0;
}

const LEAVE_QUESTION = {
  title: "Leave without saving?",
  description: "Your edits on this page were never saved and will be lost.",
  confirm: "Leave",
};

/** Set while the click a reader agreed to is replayed, so every guard lets it through. */
let agreed = false;

/**
 * Whether the page may be left from code, asking first when an editor holds unsaved writing, as a link would.
 *
 * @example if (await mayLeave()) router.push(url);
 */
export async function mayLeave() {
  return !hasUnsavedChanges() || confirmInPage(LEAVE_QUESTION);
}

/**
 * Warns before a tab close or a click through the site while work is unsaved.
 *
 * `beforeunload` covers leaving the site altogether. The router never unloads
 * the page, so a link is caught by a capture-phase listener on `document`,
 * which runs before React's own and therefore before the router sees the
 * click. The click is stopped while the page asks, and replayed on the same
 * link once the reader agrees. Both hang off an effect, so neither runs during
 * the prerender.
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

    const ask = async (event: MouseEvent) => {
      const link = leadsAway(event);
      if (link === null || agreed) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (!(await confirmInPage(LEAVE_QUESTION))) return;
      agreed = true;
      link.click();
      agreed = false;
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
 * The link a click is following, when it is about to replace the page the editor is open on.
 *
 * A modified click, a download and a new tab all leave this page where it is,
 * a bare fragment only moves the scroll position, and anything off our own
 * origin is a real navigation that `beforeunload` will catch on its own.
 *
 * @example leadsAway(event); // the sidebar link, or null
 */
function leadsAway(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const clicked = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(clicked instanceof HTMLAnchorElement)) return null;
  if (clicked.target === "_blank" || clicked.hasAttribute("download")) return null;

  const to = new URL(clicked.href, window.location.href);
  if (to.origin !== window.location.origin) return null;

  const away = to.pathname !== window.location.pathname || to.search !== window.location.search;
  return away ? clicked : null;
}
