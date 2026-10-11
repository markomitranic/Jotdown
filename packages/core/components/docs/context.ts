"use client";

import { createContext, use, type ComponentProps, type FC, type ReactNode } from "react";

/** What the layout hands its sidebar and phone header: the logo link, where it leads, and what sits beside it. */
export type DocsLayoutContext = {
  navTitle: FC<ComponentProps<"a">>;
  nav: { title: ReactNode; url: string };
  navChildren?: ReactNode;
};

export const LayoutContext = createContext<DocsLayoutContext | null>(null);

/**
 * The layout's logo and header extras, for the sidebar and the phone header.
 *
 * @example const { navTitle: Title } = useDocsLayout();
 */
export function useDocsLayout() {
  const layout = use(LayoutContext);
  if (!layout) throw new Error("useDocsLayout needs a DocsLayout above it.");
  return layout;
}
