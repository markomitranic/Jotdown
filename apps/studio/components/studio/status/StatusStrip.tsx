"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, CodeXml, Eye, HardDrive, RotateCw, Settings } from "lucide-react";
import { cn } from "cn";
import { postJson } from "@jotdown/core/lib/fetch-json";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { SHORTCUTS, ShortcutHint, useShortcut } from "@jotdown/core/components/shortcuts";
import { setReading, useReading } from "@jotdown/editor/client/reading";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import type { Update } from "@/server/updates";
import { UpdateNotice } from "../account/UpdateNotice";
import { RendererMenu } from "../canvas/RendererMenu";
import { useWorkspace } from "../Workspace";
import { useDraft } from "../settings/draft";
import { toggleSettings, useSettings } from "../settings/store";
import { BranchMenu } from "./BranchMenu";
import { PagePicker } from "./PagePicker";
import { ITEM, note, useNote } from "./note";

/**
 * The studio's own chrome, a strip along the foot of the window: the project, its branch and the page on the left, the studio's tools on the right.
 *
 * Everything above it is the project, drawn by the studio or by its site, so
 * nothing about the studio sits in the site's look. The colour stripe runs
 * along its top edge. In the app, the strip drags the window from anywhere
 * that is not a button. Outside the signed-in studio it draws nothing.
 *
 * @example <StatusStrip />
 */
export function StatusStrip() {
  const workspace = useWorkspace();
  if (!workspace) return null;
  const folder = workspace.project.key.startsWith("local/");

  return (
    <footer
      data-status-strip=""
      className="fixed inset-x-0 bottom-0 z-30 flex h-(--jd-status-height) items-center gap-0.5 bg-card px-1.5 text-muted-foreground text-xs [-webkit-app-region:drag]"
    >
      <ProjectItem folder={folder} />
      <BranchMenu projectId={workspace.project.id} folder={folder} />
      <PagePicker projectId={workspace.project.id} />
      <Said />
      <UpdateNotice className={cn(ITEM, "h-5.5 px-1.5 font-medium text-primary")} />
      <RefreshButton />
      {folder && <EditorButton />}
      <ReadingButton />
      <RendererMenu className={ITEM} />
      <SettingsButton />
    </footer>
  );
}

/** The open project, where it lives and its name, which opens the project switcher. */
function ProjectItem({ folder }: { folder: boolean }) {
  const workspace = useWorkspace();
  if (!workspace) return null;
  const Where = folder ? HardDrive : GitHubMark;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={workspace.switching}
          onClick={workspace.switch}
          className={cn(ITEM, "min-w-0 font-medium text-foreground aria-expanded:bg-accent")}
        >
          <Where className="size-3.5 shrink-0" />
          <span className="max-w-48 truncate">{workspace.project.title}</span>
          <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start">
        <ShortcutHint label="Switch project" chords={SHORTCUTS.switcher} />
      </TooltipContent>
    </Tooltip>
  );
}

/** What a tool just did, or why it could not, in the free middle of the strip until it fades. */
function Said() {
  const said = useNote();

  return (
    <p aria-live="polite" className="min-w-0 flex-1 truncate px-2">
      {said && (
        <span
          key={said.at}
          className={cn("animate-fade-in", said.tone === "failed" ? "text-destructive" : "text-muted-foreground")}
        >
          {said.text}
        </span>
      )}
    </p>
  );
}

/**
 * Reads the project again from where it lives, and asks for a newer Jotdown while it is at it.
 *
 * What the studio settled about the project is forgotten and every page and
 * list is asked for again, so a config or branch that moved elsewhere shows at
 * once. In the app, a newer release found here downloads before this answers.
 */
function RefreshButton() {
  const workspace = useWorkspace();
  const router = useRouter();
  const queries = useQueryClient();
  const refresh = useMutation({
    mutationFn: () =>
      postJson<{ checked: boolean; update: Update | null }>(`/api/projects/${workspace?.project.id}/refresh`, {}),
    onSuccess: async ({ checked, update }) => {
      router.refresh();
      await queries.invalidateQueries();
      if (update) note(`Reloaded · Jotdown ${update.version} is ready to install`);
      else note(checked ? "Reloaded · Jotdown is up to date" : "Reloaded");
    },
    onError: (error) => note(error.message, "failed"),
  });

  return (
    <Tool label="Reload the project and check for updates">
      <button
        type="button"
        aria-label="Reload the project and check for updates"
        disabled={refresh.isPending}
        onClick={() => refresh.mutate()}
        className={ITEM}
      >
        <RotateCw className={cn("size-3.5", refresh.isPending && "animate-spin")} aria-hidden="true" />
      </button>
    </Tool>
  );
}

/** Opens the folder in VS Code, at the page on screen. */
function EditorButton() {
  const workspace = useWorkspace();
  const pathname = usePathname();
  const base = `/${workspace?.project.key}`;
  const slug = pathname.startsWith(base) ? pathname.slice(base.length).split("/").filter(Boolean) : [];
  const open = useMutation({
    mutationFn: () =>
      postJson(`/api/projects/${workspace?.project.id}/open-in-editor`, { slug: slug.map(decodeURIComponent) }),
    onSuccess: () => note("Opened in VS Code"),
    onError: (error) => note(error.message, "failed"),
  });

  return (
    <Tool label="Open this page in VS Code">
      <button
        type="button"
        aria-label="Open this page in VS Code"
        disabled={open.isPending}
        onClick={() => open.mutate()}
        className={ITEM}
      >
        <CodeXml className="size-3.5" aria-hidden="true" />
      </button>
    </Tool>
  );
}

/** Switches between editing the page and seeing it as its readers do, and says so while reading. */
function ReadingButton() {
  const reading = useReading();
  const label = reading ? "Back to editing" : "View as a reader";
  useShortcut(SHORTCUTS.reading, () => setReading(!reading));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={reading}
          onClick={() => setReading(!reading)}
          className={cn(ITEM, "aria-pressed:bg-accent aria-pressed:font-medium aria-pressed:text-accent-foreground")}
        >
          <Eye className="size-3.5" aria-hidden="true" />
          {reading && <span className="animate-fade-in">Reading</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <ShortcutHint label={label} chords={SHORTCUTS.reading} />
      </TooltipContent>
    </Tooltip>
  );
}

/** A tool's name, shown above it while the pointer rests on it. */
function Tool({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Opens the project's settings, marked while a draft of them is unsaved. */
function SettingsButton() {
  const { open } = useSettings();
  const { dirty } = useDraft();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Project settings"
          aria-pressed={open}
          onClick={toggleSettings}
          className={cn(ITEM, "relative aria-pressed:bg-accent aria-pressed:text-accent-foreground")}
        >
          <Settings className="size-3.5" aria-hidden="true" />
          {dirty && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary ring-2 ring-card" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end">
        <ShortcutHint
          label={dirty ? "Project settings · unsaved changes" : "Project settings"}
          chords={SHORTCUTS.settings}
        />
      </TooltipContent>
    </Tooltip>
  );
}
