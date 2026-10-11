"use client";

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@jotdown/core/lib/query-client";
import { RootProvider } from "./docs/root";
import { ProjectSearch } from "./search/ProjectSearch";
import { NavigationTracker } from "./OptimisticPathname";
import { SiteLink } from "./SiteLink";
import { SHORTCUTS, pressed, useModifier } from "./shortcuts";

/**
 * The page's providers and its one query client, with the project's own search opened by either of its shortcuts.
 *
 * The search button prints the first of them, ⌘ K, as its key caps.
 *
 * Every link the layout draws is a `SiteLink`, which fetches its page on hover
 * and reports where it is heading, and the tracker fades the page meanwhile.
 *
 * @example <SiteRoot>{children}</SiteRoot>
 */
export function SiteRoot({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <RootProvider
        link={SiteLink}
        search={{
          dialog: ProjectSearch,
          shortcut: (event) => pressed(event, SHORTCUTS.search),
          keys: [<Modifier key="modifier" />, "K"],
        }}
      >
        <NavigationTracker />
        {children}
      </RootProvider>
    </QueryClientProvider>
  );
}

function Modifier() {
  return useModifier();
}
