"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname } from "fumadocs-core/framework";

/** The page a click left from and the page it asked for, until the router catches up. */
type Trip = { from: string; to: string };

let trip: Trip | null = null;
const listeners = new Set<() => void>();

/**
 * The path the reader is on, or the one they just clicked toward while it is still on its way.
 *
 * The router only moves the pathname once the new page has arrived, which on a
 * slow server leaves a clicked link looking ignored. A trip is only believed
 * while the pathname is still the one it left from, so a page that arrives, a
 * redirect elsewhere or the back button all end it at once.
 *
 * @example const pathname = useOptimisticPathname(); // "/manual/sections" right after the click
 */
export function useOptimisticPathname() {
  const pathname = usePathname();
  const current = useSyncExternalStore(
    subscribe,
    () => trip,
    () => null,
  );

  return current && current.from === pathname ? current.to : pathname;
}

/**
 * Records a trip to a link's page, for a link to call as the router starts opening it.
 *
 * A link to the page already open, a hash on it for one, is no trip, and
 * cancels one still out, since the router drops that navigation for it.
 *
 * @example startTrip("/manual/sections");
 */
export function startTrip(href: string) {
  const from = trimmed(location.pathname);
  const to = trimmed(new URL(href, location.href).pathname);
  set(to === from ? null : { from, to });
}

/**
 * Marks the page as on its way while a trip is out, and drops a trip once the pathname moves.
 *
 * Drawn once near the root. The mark is `data-navigating` on `<html>`, for the
 * stylesheet to fade the article that is about to leave, lifted before the
 * arriving page paints so it never shows faded. Dropping the trip
 * means returning to where it started never revives it.
 *
 * @example <NavigationTracker />
 */
export function NavigationTracker() {
  const pathname = usePathname();
  const navigating = useOptimisticPathname() !== pathname;

  useEffect(() => {
    if (trip && trip.from !== pathname) set(null);
  }, [pathname]);

  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-navigating", navigating);
  }, [navigating]);

  return null;
}

/** One path as the router spells it, which never carries a trailing slash. */
function trimmed(path: string) {
  return path.length > 1 ? path.replace(/\/$/, "") : path;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(next: Trip | null) {
  trip = next;
  for (const listener of listeners) listener();
}
