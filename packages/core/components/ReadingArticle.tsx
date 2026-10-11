"use client";

import type { ReactNode } from "react";
import { Globe, PenLine, Share2 } from "lucide-react";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { PageActions } from "@jotdown/core/components/PageActions";
import { Button } from "@jotdown/core/components/ui/button";
import { PageDrawer, usePageDrawer } from "@jotdown/core/components/PageDrawer";
import { CopyField, ShareLink } from "@jotdown/core/components/ShareLinks";
import { TabsContent, TabsList, TabsTrigger } from "@jotdown/core/components/ui/tabs";

type Props = {
  /** The page's title, at the top of its drawer. */
  title: string;
  /** Where this page is served as its own markdown source. */
  markdownUrl: string;
  /** The page's file on GitHub, or empty when the project names no repository. */
  githubUrl: string;
  /** The page in the Jotdown app, a `jotdown://` link, or empty when the project is not on GitHub. */
  editUrl?: string;
  /** The whole readable page: the title, the description and the body. */
  children: ReactNode;
};

/**
 * A page as a reader gets it: Edit in Jotdown, the page menu and the page drawer in its top right corner.
 *
 * The drawer holds the addresses to share the page by, and Share in the page
 * menu opens it on those. Edit in Jotdown opens the same page in the app.
 *
 * @example <ReadingArticle title="Setup" markdownUrl="/markdown/setup.md" githubUrl="" editUrl="jotdown://open/you/notes/setup"><PageContent … /></ReadingArticle>
 */
export function ReadingArticle({ title, markdownUrl, githubUrl, editUrl, children }: Props) {
  const drawer = usePageDrawer("share");

  return (
    <>
      <div className="absolute top-0 right-0 z-2 flex items-center gap-2">
        {editUrl && (
          <Button variant="ghost" size="sm" className="not-prose text-muted-foreground" asChild>
            <a href={editUrl}>
              <PenLine />
              Edit in Jotdown
            </a>
          </Button>
        )}
        <PageActions markdownUrl={markdownUrl} githubUrl={githubUrl} onShare={() => drawer.show("share")} />
        <PageDrawer drawer={drawer} title={title}>
          <TabsList>
            <TabsTrigger value="share">
              <Share2 />
              Share
            </TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="overflow-auto">
            <ShareLinks githubUrl={githubUrl} />
          </TabsContent>
        </PageDrawer>
      </div>
      {children}
    </>
  );
}

/**
 * The page's own address for anyone, and its file on GitHub for those who can see the repository.
 *
 * The drawer only renders in the browser, so the address reads the window directly.
 */
function ShareLinks({ githubUrl }: { githubUrl: string }) {
  const { origin, pathname } = window.location;

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      <ShareLink icon={<Globe />} label="This page" audience="Anyone">
        <CopyField label="Copy link to this page" value={origin + pathname} />
      </ShareLink>

      {githubUrl && (
        <ShareLink icon={<GitHubMark />} label="GitHub" audience="Repository members">
          <CopyField label="Copy GitHub link" value={githubUrl} />
        </ShareLink>
      )}
    </div>
  );
}
