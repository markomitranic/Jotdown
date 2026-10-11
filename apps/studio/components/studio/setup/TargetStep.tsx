"use client";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { cn } from "cn";
import { BookOpen, Check, CircleAlert, CornerLeftUp, Folder, GitBranch, Hourglass, Search } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@jotdown/core/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@jotdown/core/components/ui/item";
import { QuestionnaireItem } from "@jotdown/core/components/ui/questionnaire";
import { Tabs, TabsList, TabsTrigger } from "@jotdown/core/components/ui/tabs";
import { formatProjectKey, parseProjectKey, withoutGitHub } from "@/lib/project-key";
import type { Inspection, SetupTarget } from "@/lib/setup";
import { addFolder, browseFolder } from "../folders";
import type { SetupApi } from "./api";
import { Question } from "./Choices";

type Props = {
  api: SetupApi;
  target: SetupTarget | null;
  inspection: UseQueryResult<Inspection>;
  /** The tab on screen's own answer, or null while that tab has none. */
  onTarget: (target: SetupTarget | null) => void;
  onOpenProject: (key: string, title: string, bookmark: boolean) => void;
};

/**
 * The first question: which repository or folder, and what the studio found there.
 *
 * Each tab is its own answer: a repository picked on one and a folder on the
 * other are both remembered, and only the tab on screen is the answer, so
 * switching to a tab with nothing picked leaves the step unanswered. The find
 * is checked as soon as it is picked: whether the studio can see it, whether
 * the editor can commit to it, and whether it has docs already, which offers
 * to open them instead.
 *
 * @example <TargetStep api={setupApi} target={null} inspection={useQuery(inspectQuery)} onTarget={pick} />
 */
export function TargetStep({ api, target, inspection, onTarget, onOpenProject }: Props) {
  const [kind, setKind] = useState<SetupTarget["kind"]>(target?.kind ?? "github");
  const [picked, setPicked] = useState<Partial<Record<SetupTarget["kind"], SetupTarget>>>(
    target ? { [target.kind]: target } : {},
  );

  function pick(next: SetupTarget) {
    setPicked((current) => ({ ...current, [next.kind]: next }));
    onTarget(next);
  }

  function switchTo(next: SetupTarget["kind"]) {
    setKind(next);
    onTarget(picked[next] ?? null);
  }

  return (
    <QuestionnaireItem name="target" multiple>
      <Question
        title="Where should the docs live?"
        description="The root of a repository, on GitHub or on this computer. The docs live beside its code."
      />
      <Tabs value={kind} onValueChange={(value) => switchTo(value as SetupTarget["kind"])}>
        <TabsList className="px-0">
          <TabsTrigger value="github">GitHub repository</TabsTrigger>
          <TabsTrigger value="folder">Folder on this computer</TabsTrigger>
        </TabsList>
      </Tabs>

      <div hidden={kind !== "github"}>
        <RepositoryList
          api={api}
          chosen={picked.github?.kind === "github" ? picked.github.key : null}
          onChoose={(key) => pick({ kind: "github", key })}
        />
      </div>
      <div hidden={kind !== "folder"}>
        <FolderPicker
          chosen={picked.folder?.kind === "folder" ? picked.folder.path : null}
          onChoose={(path) => pick({ kind: "folder", path })}
        />
      </div>

      {target && target.kind === kind && <Findings inspection={inspection} onOpenProject={onOpenProject} />}
    </QuestionnaireItem>
  );
}

/**
 * Every repository the editor can reach, searched as they type, and any `owner/repo` or GitHub address pasted in.
 *
 * Arrow keys move through the list and Enter picks, so the step can be done without the mouse.
 */
function RepositoryList({
  api,
  chosen,
  onChoose,
}: {
  api: SetupApi;
  chosen: string | null;
  onChoose: (key: string) => void;
}) {
  const repositories = useQuery({ queryKey: ["setup", "repositories"], queryFn: () => api.listRepositories() });
  const [query, setQuery] = useState(chosen ?? "");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const needle = withoutGitHub(query).toLowerCase();
  const listed = repositories.data ?? [];
  const shown = listed.filter((key) => key.toLowerCase().includes(needle));
  const typed = parseProjectKey(query);
  const typedKey = typed && formatProjectKey(typed);
  const rows =
    typedKey && !shown.some((key) => key.toLowerCase() === typedKey.toLowerCase()) ? [typedKey, ...shown] : shown;
  const at = Math.min(active, Math.max(rows.length - 1, 0));

  useEffect(() => {
    list.current?.querySelector(`[data-row="${at}"]`)?.scrollIntoView({ block: "nearest" });
  }, [at]);

  function steer(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((at + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % Math.max(rows.length, 1));
    }
    if (event.key === "Enter" && rows[at] && rows[at] !== chosen) {
      event.preventDefault();
      event.stopPropagation();
      onChoose(rows[at]);
    }
  }

  return (
    <div>
      <InputGroup className="h-10">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={steer}
          placeholder="Search your repositories, or paste owner/repo"
          aria-label="Repository"
          spellCheck={false}
        />
      </InputGroup>

      <div
        ref={list}
        role="listbox"
        aria-label="Repositories"
        className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-border p-1"
      >
        {repositories.isPending && rows.length === 0 && <Quiet>Asking GitHub which repositories you can reach…</Quiet>}
        {repositories.isError && (
          <Quiet alert>
            GitHub would not list your repositories: {repositories.error.message} Paste owner/repo instead.
          </Quiet>
        )}
        {repositories.isSuccess && rows.length === 0 && (
          <Quiet>
            {needle ? "Nothing you can reach matches. Paste its owner/repo." : "GitHub lists no repositories for you."}
          </Quiet>
        )}

        {rows.map((key, index) => {
          const picked = key === chosen;
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: an option of the listbox the focused search field steers by arrow keys and Enter
            <div
              key={key}
              role="option"
              aria-label={key}
              aria-selected={picked}
              data-row={index}
              onMouseMove={() => setActive(index)}
              onClick={() => !picked && onChoose(key)}
              className={cn(
                "flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-sm",
                index === at && "bg-foreground/6",
                picked && "bg-primary/10",
              )}
            >
              <GitBranch className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{key.split("/")[1]}</span>
                <span className="ms-2 text-muted-foreground text-xs">{key.split("/")[0]}</span>
              </span>
              <span className="grid size-5 shrink-0 place-items-center">
                {picked && <Check className="size-4 text-primary" aria-label="Picked" />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The folders of this machine, walked by clicking or typing a path, with the folder the field names picked by its button.
 *
 * A path typed or pasted in is opened first and picked once it is found, so the list, the field and the pick never disagree.
 */
function FolderPicker({ chosen, onChoose }: { chosen: string | null; onChoose: (path: string) => void }) {
  const [path, setPath] = useState(chosen ?? "~");
  const [typed, setTyped] = useState(chosen ?? "~");
  const listing = useQuery({ queryKey: ["folders", path], queryFn: () => browseFolder(path) });
  const pickOnArrival = useRef(false);
  const shown = listing.data ?? null;
  const parent = shown?.parent;
  const choose = useEffectEvent(onChoose);

  useEffect(() => {
    if (!listing.data && !listing.error) return;
    if (listing.data) setTyped(listing.data.display);
    if (listing.data && pickOnArrival.current) choose(listing.data.path);
    pickOnArrival.current = false;
  }, [listing.data, listing.error]);

  const onScreen = shown !== null && (typed === shown.display || typed === shown.path);

  /** Picks the folder the field names: the one listed, or a typed path once it has been opened and found. */
  function pickTyped() {
    if (onScreen) return onChoose(shown.path);
    if (typed === path) return;
    pickOnArrival.current = true;
    setPath(typed);
  }

  return (
    <div>
      <div className="flex gap-2">
        <InputGroup className="h-10">
          <InputGroupAddon>
            <Folder />
          </InputGroupAddon>
          <InputGroupInput
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || typed === shown?.display) return;
              event.preventDefault();
              event.stopPropagation();
              setPath(typed);
            }}
            aria-label="Folder"
            spellCheck={false}
            className="font-mono text-[0.8125rem]"
          />
        </InputGroup>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-10"
          disabled={listing.isPending || (onScreen && shown.path === chosen)}
          onClick={pickTyped}
        >
          {onScreen && shown.path === chosen ? "Picked" : "Use this folder"}
        </Button>
      </div>

      <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-border p-1">
        {listing.isPending && <Quiet>Reading {path}…</Quiet>}
        {listing.isError && <Quiet alert>{listing.error.message}</Quiet>}
        <ul aria-label="Folders">
          {parent && (
            <FolderRow onOpen={() => setPath(parent)} icon={<CornerLeftUp className="size-4 text-muted-foreground" />}>
              ..
            </FolderRow>
          )}
          {shown?.entries.map((entry) => (
            <FolderRow
              key={entry.path}
              onOpen={() => setPath(entry.path)}
              icon={
                entry.title ? (
                  <BookOpen className="size-4 text-primary" />
                ) : (
                  <Folder className="size-4 text-muted-foreground" />
                )
              }
              note={entry.title ? "Has docs" : undefined}
            >
              {entry.name}
            </FolderRow>
          ))}
        </ul>
        {shown && shown.entries.length === 0 && <Quiet>No folders inside.</Quiet>}
      </div>
    </div>
  );
}

function FolderRow({
  icon,
  note,
  onOpen,
  children,
}: {
  icon: ReactNode;
  note?: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-start text-sm outline-none hover:bg-foreground/6 focus-visible:bg-foreground/6"
      >
        <span aria-hidden="true">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {note && <span className="shrink-0 text-muted-foreground text-xs">{note}</span>}
      </button>
    </li>
  );
}

/**
 * What the studio found at the target, in one box: where it is and that it can be set up, or what stops it and how to fix that.

 */
function Findings({ inspection, onOpenProject }: Pick<Props, "inspection" | "onOpenProject">) {
  const found = inspection.data;
  if (!found && !inspection.error) {
    return (
      <ItemGroup aria-live="polite">
        <Finding
          state="waiting"
          title="Checking…"
          description="Whether the studio can see it, and whether you can commit to it."
        />
      </ItemGroup>
    );
  }
  if (!found) {
    return (
      <ItemGroup aria-live="polite">
        <Finding state="problem" title="It could not be checked" description={inspection.error?.message} />
      </ItemGroup>
    );
  }

  const { problem } = found;
  const fine =
    found.target.kind === "folder"
      ? found.repository
        ? `Repository root, ${found.repository.replace(/^https:\/\//, "")}${found.branch ? `, on ${found.branch}` : ""}.`
        : "Not on GitHub yet, so it opens here until it is pushed."
      : `Default branch ${found.branch}. Setup lands on it as one commit, as you.`;

  return (
    <ItemGroup aria-live="polite">
      <Finding
        state={problem ? "problem" : found.target.kind === "folder" && !found.repository ? "muted" : "fine"}
        title={<span className="font-mono text-[0.8125rem]">{found.name}</span>}
        description={problem ? problem.message : fine}
        action={problem?.kind === "configured" && <OpenExisting found={found} onOpenProject={onOpenProject} />}
      />
    </ItemGroup>
  );
}

/** Opens a target that has docs already: a repository by its key, a folder once it is bookmarked. */
function OpenExisting({ found, onOpenProject }: { found: Inspection } & Pick<Props, "onOpenProject">) {
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState("");

  async function go() {
    if (found.target.kind === "github") return onOpenProject(found.target.key, found.title, true);
    setAdding(true);
    try {
      const added = await addFolder(found.target.path);
      onOpenProject(added.key, added.title ?? found.title, false);
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "The folder could not be opened.");
      setAdding(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={adding} onClick={() => void go()}>
        {adding ? "Opening…" : "Open it"}
      </Button>
      {problem && <span className="text-destructive text-xs">{problem}</span>}
    </>
  );
}

type FindingProps = {
  state: "fine" | "muted" | "problem" | "waiting";
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

/** The check's answer: a tick, a warning or a wait, what was checked, and what to do about it. */
function Finding({ state, title, description, action }: FindingProps) {
  return (
    <Item size="sm" variant="muted" className={cn("bg-foreground/4", state === "problem" && "bg-destructive/8")}>
      <ItemMedia variant="icon">
        {state === "problem" && <CircleAlert className="text-destructive" aria-label="Problem" />}
        {state === "fine" && <Check className="text-primary" aria-label="Fine" />}
        {state === "muted" && <Check className="text-muted-foreground" aria-label="Fine" />}
        {state === "waiting" && <Hourglass className="text-muted-foreground" aria-hidden="true" />}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="line-clamp-2">{title}</ItemTitle>
        {description && (
          <ItemDescription className={cn("line-clamp-3", state === "problem" && "text-destructive")}>
            {description}
          </ItemDescription>
        )}
      </ItemContent>
      {action && <ItemActions>{action}</ItemActions>}
    </Item>
  );
}

function Quiet({ alert, children }: { alert?: boolean; children: ReactNode }) {
  return (
    <p
      role={alert ? "alert" : undefined}
      className={cn("px-2.5 py-2 text-sm", alert ? "text-destructive" : "text-muted-foreground")}
    >
      {children}
    </p>
  );
}
