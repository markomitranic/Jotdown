"use client";

import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "cn";
import { ChevronsUpDown } from "lucide-react";
import { SHORTCUTS, ShortcutHint, useShortcut } from "@jotdown/core/components/shortcuts";
import { optimizable } from "@jotdown/core/lib/images";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { hasUnsavedChanges } from "@jotdown/editor/client/useLeaveGuard";
import { OpeningProject } from "./OpeningProject";
import { ProjectPalette } from "./ProjectPalette";
import { SetupDialog } from "./setup/SetupDialog";
import { useBookmarks, useOpenProject } from "./projects";
import { useStudioPulse } from "./pulse";

type Workspace = {
  editor: { login: string; name: string };
  project: { id: string; key: string; title: string };
  logo?: { alt: string; src: string; srcDark?: string };
  /** How the project is drawn, and the addresses the renderer menu offers. */
  drawing?: {
    mode: "site" | "custom" | "dev" | "skinny";
    siteUrl: string | null;
    customUrl: string | null;
    folder: boolean;
  };
};

type WorkspaceState = Workspace & {
  switch: () => void;
  switching: boolean;
};

const WorkspaceContext = createContext<WorkspaceState | null>(null);

/**
 * The studio's workspace: the project switcher, the setup wizard, the opening screen, and the signed-in editor and open project.
 *
 * The switcher lives here once, rather than in each place that draws the
 * project's name, so its shortcut opens one palette and the projects are asked
 * for once. It also watches the open project's branch, and refreshes the page
 * when the branch moves, unless there is unsaved writing on it.
 *
 * @example <WorkspaceProvider workspace={{ editor, project }}>{shell}</WorkspaceProvider>
 */
export function WorkspaceProvider({ workspace, children }: { workspace: Workspace; children: ReactNode }) {
  const { bookmarks, error, save, forget } = useBookmarks();
  const { opening, open, dismiss } = useOpenProject();
  const [switching, setSwitching] = useState(false);
  useShortcut(SHORTCUTS.switcher, () => setSwitching((shown) => !shown));

  function start(key: string, title: string | null, bookmark: boolean) {
    setSwitching(false);
    open(key, title, bookmark);
  }

  return (
    <WorkspaceContext value={{ ...workspace, switch: () => setSwitching(true), switching }}>
      {children}
      <BranchWatch />
      <ProjectPalette
        open={switching}
        onOpenChange={setSwitching}
        editor={workspace.editor}
        current={workspace.project}
        bookmarks={bookmarks}
        bookmarkError={error}
        onChoose={start}
        onForget={forget}
        onSave={save}
      />
      <SetupDialog onOpenProject={start} />
      {opening && <OpeningProject opening={opening} onDismiss={dismiss} />}
    </WorkspaceContext>
  );
}

/**
 * The signed-in studio's workspace, or null in a local preview or a publication.
 *
 * @example const workspace = useWorkspace();
 */
export function useWorkspace() {
  return use(WorkspaceContext);
}

/**
 * The project's name at the top of the sidebar, which opens the project switcher.
 *
 * @example <DocsLayout slots={{ navTitle: WorkspaceMenu }} />
 */
export function WorkspaceMenu() {
  const workspace = useWorkspace();
  if (!workspace) return null;
  const { project, logo } = workspace;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={workspace.switching}
          onClick={workspace.switch}
          className="-ms-1.5 me-1 flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-start outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-accent"
        >
          {logo ? <ProjectLogo logo={logo} /> : <ProjectMark title={project.title} current />}
          <span className={cn("truncate font-medium text-[0.9375rem]", logo && "max-md:hidden")}>{project.title}</span>
          <ChevronsUpDown className="ms-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        <ShortcutHint label={`${project.title} · Switch project`} chords={SHORTCUTS.switcher} />
      </TooltipContent>
    </Tooltip>
  );
}

/** A square with the project's initial, filled in the accent for the project that is open. */
function ProjectMark({ title, current }: { title: string; current: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded font-semibold text-[0.6875rem] uppercase",
        current ? "bg-primary text-primary-foreground" : "border border-border bg-secondary text-muted-foreground",
      )}
    >
      {title.trim().charAt(0) || "?"}
    </span>
  );
}

/** The project's own logo, in the colour mode's variant when it names one. */
function ProjectLogo({ logo }: { logo: NonNullable<Workspace["logo"]> }) {
  return (
    <>
      <Image
        src={logo.src}
        alt={logo.alt}
        width={160}
        height={40}
        unoptimized={!optimizable(logo.src)}
        className="h-5 w-auto shrink-0 dark:hidden"
      />
      <Image
        src={logo.srcDark ?? logo.src}
        alt={logo.alt}
        width={160}
        height={40}
        unoptimized={!optimizable(logo.srcDark ?? logo.src)}
        className="hidden h-5 w-auto shrink-0 dark:block"
      />
    </>
  );
}

/**
 * Refreshes the page when the open project's branch moves and nothing on screen is unsaved.
 *
 * @example <BranchWatch />
 */
function BranchWatch() {
  const router = useRouter();
  const seen = useRef("");
  const pulse = useStudioPulse();

  // biome-ignore lint/correctness/useExhaustiveDependencies: looks again after every poll, so a refresh held back by unsaved changes happens once they are saved
  useEffect(() => {
    const version = pulse.data?.version;
    if (!version) return;

    if (seen.current && version !== seen.current && !hasUnsavedChanges()) router.refresh();
    if (!hasUnsavedChanges()) seen.current = version;
  }, [pulse.dataUpdatedAt]);

  return null;
}
