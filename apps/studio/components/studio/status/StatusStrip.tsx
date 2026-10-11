"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, CodeXml, HardDrive, RotateCw, Settings } from "lucide-react";
import { cn } from "cn";
import { postJson } from "@jotdown/core/lib/fetch-json";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { SHORTCUTS, ShortcutHint } from "@jotdown/core/components/shortcuts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import type { Update } from "@/server/updates";
import { UpdateNotice } from "../account/UpdateNotice";
import { RendererMenu } from "../canvas/RendererMenu";
import { useWorkspace } from "../Workspace";
import { BranchMenu } from "./BranchMenu";
import { ITEM, note, useNote } from "./note";

/**
 * The studio's own chrome, a strip along the foot of the window: the project and its branch on the left, the studio's tools on the right.
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
      <Said />
      <UpdateNotice className={cn(ITEM, "h-5.5 px-1.5 font-medium text-primary")} />
      <RefreshButton />
      {folder && <EditorButton />}
      <RendererMenu className={ITEM} />
      <Unbuilt label="Project settings">
        <Settings className="size-3.5" />
      </Unbuilt>
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

/** A tool's name, shown above it while the pointer rests on it. */
function Tool({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A tool that is not built yet, which answers a click with a tooltip saying so.
 *
 * @example <Unbuilt label="Project settings"><Settings /></Unbuilt>
 */
function Unbuilt({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  function tell(event: MouseEvent) {
    event.preventDefault();
    setOpen(true);
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-disabled="true"
          className={cn(ITEM, "cursor-default opacity-50 hover:bg-transparent hover:text-muted-foreground")}
          onClick={tell}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end">
        {label} · Coming soon
      </TooltipContent>
    </Tooltip>
  );
}
