"use client";

import { useState } from "react";
import { cn } from "cn";
import {
  FolderInput,
  FolderOpen,
  Link2,
  MoreHorizontal,
  PencilLine,
  Plus,
  SeparatorHorizontal,
  Smile,
  SquarePen,
  Trash2,
  Unlink,
  FilePlus2,
  Route,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@jotdown/core/components/ui/dropdown-menu";
import { DOCS_ROOT, dirOf, stemOf } from "@jotdown/core/lib/paths";
import { useLiveEditConfig } from "../client/api";
import { containsGenerated, holdsGenerated, isGeneratedPage } from "./generated";
import Prompt from "./Prompt";
import {
  destinations,
  holdsPages,
  isRoot,
  moveOp,
  moveSectionOp,
  type NewThing,
  type Row,
  type TreeNode,
} from "./queue";
import { useStructure } from "./useStructure";
import { ACTION, ACTIONS } from "./style";

type Props = {
  row: Row;
  /** Moves the toolbar, so it clears whatever the row draws at its end. */
  className?: string;
  label: string;
  /** The staged tree, so a section made a moment ago is already a destination. */
  tree: readonly TreeNode[];
  onRename(): void;
  /** Opens an empty row inside this one, waiting to be given a name. */
  onDraft(kind: NewThing): void;
  /** Opens the link form, on a new link inside this row or on this link itself. */
  onDraftLink(): void;
  onPickIcon(): void;
  onRemoveEntry(): void;
};

type Asking = "url" | "move" | null;

/**
 * The toolbar that floats over the end of a sidebar row while the pointer is on it.
 *
 * Every page gets a `+`, which puts a page, a separator or a link inside it, and
 * everything gets a `⋯` holding the rest. A page holding nothing yet becomes a
 * folder the moment the first thing is named into it, so there is no section to
 * make: there are only pages, and some of them have pages inside. Deleting a page is deliberately not
 * here: it lives on the page itself, behind a confirmation, because it is the
 * one change that staging would make worse by putting distance between the
 * decision and the consequence. A link and a separator can go from here,
 * because neither holds any words to lose.
 *
 * `Change URL` looks like a rename and is not: it re-slugs the file, rewrites
 * every link that pointed at it and leaves a redirect behind. A separator has
 * no address, so it is placed by dragging alone.
 */
export default function RowControls({
  row,
  className,
  label,
  tree,
  onRename,
  onDraft,
  onDraftLink,
  onPickIcon,
  onRemoveEntry,
}: Props) {
  const structure = useStructure();
  const { docs } = useLiveEditConfig();
  const [asking, setAsking] = useState<Asking>(null);

  if (!structure) return null;

  const { kind } = row;
  const path = row.path ?? "";
  const link = kind === "link";
  const separator = kind === "separator";
  const folder = kind === "section";
  const generated = !link && !separator && isGeneratedPage(docs, path);
  const pinned = row.token === null;
  const immovable = isRoot(path) || containsGenerated(docs, path) || pinned;
  const addable = holdsPages(row) && !generated;
  const relocate = (destination: string, slug?: string) =>
    folder ? moveSectionOp(path, destination, slug) : moveOp(path, destination, slug);

  const queue = structure.queue;
  const done = () => setAsking(null);

  return (
    <span className={cn(ACTIONS, className)} onPointerDown={(event) => event.stopPropagation()}>
      {addable && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" className={ACTION} aria-label={`Add inside ${label}`} title="Add inside">
              <Plus />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="right"
            sideOffset={6}
            className="w-44"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DropdownMenuItem onSelect={() => onDraft("page")}>
              <FilePlus2 /> Page
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDraft("separator")}>
              <SeparatorHorizontal /> Separator
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDraftLink}>
              <Link2 /> Link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className={ACTION} aria-label={`Change ${label}`} title="More">
            <MoreHorizontal />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="right"
          sideOffset={6}
          className="w-52"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {link ? (
            <DropdownMenuItem onSelect={onDraftLink}>
              <SquarePen /> Edit link…
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={generated || pinned} onSelect={onRename}>
              <PencilLine /> Rename
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={generated} onSelect={onPickIcon}>
            <Smile /> Change icon…
          </DropdownMenuItem>
          {kind === "section" && (
            <DropdownMenuCheckboxItem
              checked={row.node.type === "folder" && row.node.defaultOpen === true}
              disabled={holdsGenerated(docs, path)}
              onCheckedChange={(open) => queue({ kind: "defaultOpen", path, open })}
            >
              <FolderOpen /> Open by default
            </DropdownMenuCheckboxItem>
          )}

          {!link && !separator && (
            <>
              <DropdownMenuItem disabled={immovable} onSelect={() => setAsking("url")}>
                <Route /> Change URL…
              </DropdownMenuItem>
              <DropdownMenuItem disabled={immovable} onSelect={() => setAsking("move")}>
                <FolderInput /> Move to…
              </DropdownMenuItem>
            </>
          )}

          {(link || separator) && <DropdownMenuSeparator />}
          {link && (
            <DropdownMenuItem variant="destructive" onSelect={onRemoveEntry}>
              <Unlink /> Remove link
            </DropdownMenuItem>
          )}
          {separator && (
            <DropdownMenuItem variant="destructive" onSelect={onRemoveEntry}>
              <Trash2 /> Remove separator
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {asking === "url" && (
        <Prompt
          heading={`New address for ${label}`}
          name={stemOf(path)}
          nameLabel="URL"
          namePlaceholder="lowercase-and-hyphenated"
          confirmLabel="Change"
          onCancel={done}
          onConfirm={({ name }) => {
            const op = relocate(dirOf(path), name);
            if (op) queue(op);
            done();
          }}
        />
      )}

      {asking === "move" && (
        <Prompt
          heading={`Move ${label}`}
          destinations={destinations(tree, docs, folder ? path : null, structure.drawn)}
          destination={dirOf(path) === "" ? DOCS_ROOT : dirOf(path)}
          confirmLabel="Move"
          onCancel={done}
          onConfirm={({ destination }) => {
            const op = relocate(destination);
            if (op) queue(op);
            done();
          }}
        />
      )}
    </span>
  );
}
