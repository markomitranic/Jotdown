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
import { SettingsDraft } from "./settings/draft";
import { LiveTheme } from "./settings/LiveTheme";
import { SettingsPanel } from "./settings/SettingsPanel";
import { closeSettings, openSettings, useSettings } from "./settings/store";
import { useBookmarks, useOpenProject } from "./projects";
import { useStudioPulse } from "./pulse";

type Workspace = {
  editor: { login: string; name: string };
  project: { id: string; key: string; title: string; base: string };
  /** The top-level folders of the project's pages, which the theme can give accents. */
  folders?: string[];
  /** The project's square icon, its favicon or else its logo. */
  icon?: { alt: string; src: string; srcDark?: string };
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
 * The studio's workspace: the project switcher, the settings, the setup wizard, the opening screen, and the signed-in editor and open project.
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
  const settings = useSettings();
  useShortcut(SHORTCUTS.switcher, () => setSwitching((shown) => !shown));
  useShortcut(SHORTCUTS.settings, () => (settings.open ? closeSettings() : openSettings()));

  function start(key: string, title: string | null, bookmark: boolean) {
    setSwitching(false);
    open(key, title, bookmark);
  }

  return (
    <WorkspaceContext value={{ ...workspace, switch: () => setSwitching(true), switching }}>
      <SettingsDraft key={workspace.project.id} projectId={workspace.project.id} base={workspace.project.base}>
        {children}
        {(workspace.drawing?.mode ?? "skinny") === "skinny" && <LiveTheme />}
        <SettingsPanel folders={workspace.folders ?? []} />
      </SettingsDraft>
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
  const { project, icon } = workspace;

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
          {icon ? <ProjectIcon icon={icon} /> : <ProjectMark title={project.title} current />}
          <span className={cn("truncate font-medium text-[0.9375rem]", icon && "max-md:hidden")}>{project.title}</span>
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

/** The project's icon fitted into a square, in the colour mode's variant when it names one. */
function ProjectIcon({ icon }: { icon: NonNullable<Workspace["icon"]> }) {
  return (
    <>
      <Image
        src={icon.src}
        alt={icon.alt}
        width={40}
        height={40}
        unoptimized={!optimizable(icon.src)}
        className="size-5 shrink-0 object-contain dark:hidden"
      />
      <Image
        src={icon.srcDark ?? icon.src}
        alt={icon.alt}
        width={40}
        height={40}
        unoptimized={!optimizable(icon.srcDark ?? icon.src)}
        className="hidden size-5 shrink-0 object-contain dark:block"
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
