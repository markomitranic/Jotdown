"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Bot, EyeOff, Globe, History, Settings2, Share2, Trash2 } from "lucide-react";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { PageDrawer, usePageDrawer, type Drawer } from "@jotdown/core/components/PageDrawer";
import { CopyField, ShareLink } from "@jotdown/core/components/ShareLinks";
import { Button } from "@jotdown/core/components/ui/button";
import { TabsContent, TabsList, TabsTrigger } from "@jotdown/core/components/ui/tabs";
import { useDocTarget } from "@jotdown/editor/client/api";
import { usePublishing } from "@jotdown/editor/structure/publishing";

const HistoryPanel = dynamic(() => import("@jotdown/editor/history/HistoryPanel"), { ssr: false });

/** The studio drawer's tabs, in the order they sit in its header. */
export type StudioTab = "settings" | "share" | "history";

/**
 * The studio's page drawer, open or shut and on which tab.
 *
 * @example const drawer = useStudioDrawer(); drawer.show("share");
 */
export function useStudioDrawer() {
  return usePageDrawer<StudioTab>("settings");
}

/**
 * The studio's page drawer: the page's settings, the addresses to share it by, and its history.
 *
 * Each tab mounts when it is chosen, so the history is only asked for once
 * somebody looks at it.
 *
 * @example <StudioDrawer drawer={drawer} onDelete={deletion.ask} />
 */
export function StudioDrawer({ drawer, onDelete }: { drawer: Drawer<StudioTab>; onDelete?: () => void }) {
  const { title } = useDocTarget();

  return (
    <PageDrawer drawer={drawer} title={title}>
      <TabsList>
        <TabsTrigger value="settings">
          <Settings2 />
          Page settings
        </TabsTrigger>
        <TabsTrigger value="share">
          <Share2 />
          Share
        </TabsTrigger>
        <TabsTrigger value="history">
          <History />
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="settings" className="overflow-auto">
        <PageSettings
          onDelete={
            onDelete &&
            (() => {
              drawer.setOpen(false);
              onDelete();
            })
          }
        />
      </TabsContent>

      <TabsContent value="share" className="overflow-auto">
        <ShareLinks />
      </TabsContent>

      <TabsContent value="history">
        <HistoryPanel onLoaded={() => drawer.setOpen(false)} />
      </TabsContent>
    </PageDrawer>
  );
}

/** Whether the page is on the site, which file it is, the ways to open its source, and deleting it. */
function PageSettings({ onDelete }: { onDelete?: () => void }) {
  const { path, markdownUrl, githubUrl } = useDocTarget();
  const publishing = usePublishing(path);

  return (
    <dl className="divide-y divide-border">
      {publishing && (
        <Setting label="Site">
          <span className="flex min-w-0 items-center gap-2 truncate text-xs">
            <SiteGlyph unlisted={publishing.unlisted} />
            {publishing.unlisted ? "Unlisted, only the studio shows it" : "Published"}
          </span>
          <Button
            variant={publishing.unlisted ? "default" : "outline"}
            size="sm"
            disabled={publishing.held !== null}
            title={publishing.held ?? undefined}
            onClick={publishing.toggle}
          >
            {publishing.unlisted ? "Publish" : "Unpublish"}
          </Button>
        </Setting>
      )}

      <Setting label="File">
        <code className="min-w-0 truncate font-mono text-xs">{path}</code>
        {githubUrl && (
          <Button variant="ghost" size="icon-sm" aria-label="Open in GitHub" title="Open in GitHub" asChild>
            <a href={githubUrl} target="_blank" rel="noreferrer noopener">
              <GitHubMark />
            </a>
          </Button>
        )}
      </Setting>

      <Setting label="Markdown">
        <a
          href={markdownUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="min-w-0 truncate font-mono text-xs underline underline-offset-2"
        >
          {markdownUrl}
        </a>
      </Setting>

      {onDelete && (
        <div className="px-4 py-4">
          <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>
            <Trash2 />
            Delete this page…
          </Button>
        </div>
      )}
    </dl>
  );
}

/**
 * The page's published address and its file in a clone, each with who can open it and a field that copies it.
 */
function ShareLinks() {
  const { localPath, publicUrl, unlisted } = useDocTarget();

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      <ShareLink icon={<Globe />} label="Published" audience={unlisted ? "Nobody yet" : "Anyone"}>
        {unlisted ? (
          <Placeholder>Unlisted, so the site does not show this page.</Placeholder>
        ) : publicUrl ? (
          <CopyField label="Copy published link" value={publicUrl} />
        ) : (
          <MissingPublicUrl />
        )}
      </ShareLink>

      <ShareLink icon={<Bot />} label="Local file" audience="Your agent, from the repository root">
        <CopyField label="Copy local path" value={localPath} />
      </ShareLink>
    </div>
  );
}

/** Stands in the published field's place until the project says where it is published. */
function MissingPublicUrl() {
  return (
    <Placeholder>
      Add <code className="font-mono text-foreground">url</code> to{" "}
      <code className="font-mono text-foreground">.jotdown/config.json</code>
    </Placeholder>
  );
}

/** A dashed field the size of a copy field, saying why there is nothing to copy. */
function Placeholder({ children }: { children: ReactNode }) {
  return (
    <p className="flex h-10 items-center rounded-lg border border-border border-dashed px-3 text-muted-foreground text-xs">
      <span className="truncate">{children}</span>
    </p>
  );
}

/** The globe of a published page, or the closed eye of an unlisted one. */
function SiteGlyph({ unlisted }: { unlisted: boolean }) {
  const Glyph = unlisted ? EyeOff : Globe;
  return <Glyph className="size-3.5 shrink-0 text-muted-foreground" />;
}

/** One row of the settings list: a label on the left, the value and its action on the right. */
function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-4 px-4 py-2">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center justify-between gap-2">{children}</dd>
    </div>
  );
}
