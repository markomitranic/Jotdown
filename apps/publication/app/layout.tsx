import "./site.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ProjectStyles } from "@jotdown/core/components/ProjectLook";
import { SiteRoot } from "@jotdown/core/components/SiteRoot";
import { publication } from "@/server/project";

/** The project's title in the tab, its description, and its `favicon` when it names one. */
export function generateMetadata(): Metadata {
  const { title, description, favicon } = publication().config;
  return {
    title: { default: title, template: `%s | ${title}` },
    description,
    robots: { index: false, follow: false },
    icons: favicon ? { icon: favicon } : undefined,
  };
}

/**
 * The page's frame: the project's colours and the providers every page sits in, the reader's pages and the editing canvas alike.
 *
 * @example <Layout><Page /></Layout>
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SiteRoot>
          <ProjectStyles project={publication()} />
          {children}
        </SiteRoot>
      </body>
    </html>
  );
}

export const dynamic = "error";
