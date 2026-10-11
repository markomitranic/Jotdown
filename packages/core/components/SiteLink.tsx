"use client";

import { useState, type ComponentProps } from "react";
import NextLink from "next/link";
import { startTrip } from "./OptimisticPathname";

/**
 * Every link the site draws: it fetches its page once the pointer or the keyboard reaches it, and reports the trip.
 *
 * Next prefetches each link that comes near the viewport, and the layout keeps a
 * closed sidebar mounted, so one page load asked the server for every page in
 * the open sidebar folders. Waiting for the pointer still buys the time between
 * hover and click, which is usually enough for the page or its loading screen.
 *
 * The trip is reported only when the router really opens the page, so the
 * sidebar can answer the click before the page arrives.
 *
 * @example <SiteLink href="/manual">Manual</SiteLink>
 */
export function SiteLink({
  href = "#",
  prefetch: _,
  onPointerEnter,
  onFocus,
  ...props
}: ComponentProps<"a"> & { prefetch?: boolean }) {
  const [wanted, setWanted] = useState(false);

  return (
    <NextLink
      href={href}
      prefetch={wanted ? null : false}
      onNavigate={() => startTrip(href)}
      onPointerEnter={(event) => {
        setWanted(true);
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        setWanted(true);
        onFocus?.(event);
      }}
      {...props}
    />
  );
}
