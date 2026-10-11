import type { ReactNode } from "react";
import type { KitPage, KitSite } from "./context";

/**
 * What a layout is handed: the page, its site, and the page's own content to place.
 *
 * @example export default function Landing({ page, children }: LayoutProps) { return <main>{children}</main>; }
 */
export type LayoutProps = { page: KitPage; site: KitSite; children: ReactNode };
