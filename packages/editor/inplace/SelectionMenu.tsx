"use client";

/**
 * The menu that opens beside a text selection: turn the block into another
 * kind, or format the words.
 *
 * Every block is its own editor, so there is no one selection for this to
 * read. It reads whichever editor currently has one from `SelectionTracker`
 * and asks that editor directly, rather than through `@tiptap/react`'s own
 * `BubbleMenu`, which draws through `editor.contentComponent` and is empty
 * wherever there is no `<EditorContent>` to set it.
 *
 * It opens below and to the right of where the selection ends, clear of the
 * pointer that just made it, and only once the pointer is let go, so it never
 * chases a drag across the page. Where the window has no room it moves left or
 * above instead. It shows only while the browser still shows the words
 * selected, and only the parts that apply: a title has no marks to offer.
 *
 * Opening the link field is its own small trap: the field is a plain
 * `<input>`, so giving it focus takes the browser's selection away from the
 * editor. While the field is open the menu stays where it stood and keeps the
 * editor it was opened for, until a genuine click outside it closes it, or
 * Escape hands focus back to the editor and with it the words selected.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import type { Editor } from "@tiptap/core";
import { ChevronRight, Code, Link2, RemoveFormatting, Strikethrough } from "lucide-react";
import { ShortcutHint, type Chord } from "@jotdown/core/components/shortcuts";
import { Button, buttonVariants } from "@jotdown/core/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@jotdown/core/components/ui/dropdown-menu";
import { Input } from "@jotdown/core/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { useInplace, useTrackedSelection, type Inplace } from "./context";
import { blockAt, type BlockOps } from "./handles";
import type { TurnKind } from "./turn";
import type { Selected } from "./selection";
import { TURN_ICONS, TurnIntoItems, turnTitle } from "./TurnInto";

const LABEL = "font-label text-[0.7rem] font-medium tracking-[0.07em] uppercase";
const ROW =
  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent data-[state=open]:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

/** How far from the end of the selection the menu opens, clear of the pointer. */
const OFFSET = 24;
const EDGE = 8;

/** Where the selection is drawn: its first line's top, and its last line's bottom right corner. */
type Corner = { top: number; right: number; bottom: number };

/**
 * Whether the primary button is held down in an editor, which is a selection still being made.
 *
 * @example const dragging = usePressing(); // true while the reader drags across words
 */
function usePressing() {
  const [pressing, setPressing] = useState(false);

  useEffect(() => {
    const down = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.button === 0 && target?.closest('[contenteditable="true"]')) setPressing(true);
    };
    const up = () => setPressing(false);

    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, []);

  return pressing;
}

/** @example <InplaceSelectionMenu /> */
export function InplaceSelectionMenu() {
  const page = useInplace();
  const where = useTrackedSelection();
  const tracked = where?.text ? where : null;
  const pressing = usePressing();
  const [corner, setCorner] = useState<Corner | null>(null);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pinnedEditor = useRef<Editor | null>(null);
  const lastRange = useRef<Selected | null>(null);
  const linking = useRef(false);
  linking.current = linkDraft !== null;

  useEffect(() => {
    if (tracked) {
      pinnedEditor.current = tracked.editor;

      const isNew =
        lastRange.current === null ||
        lastRange.current.editor !== tracked.editor ||
        lastRange.current.from !== tracked.from ||
        lastRange.current.to !== tracked.to;
      lastRange.current = tracked;
      if (isNew) setLinkDraft(null);
    }

    if (linkDraft !== null) return;
    if (!tracked) {
      setCorner(null);
      return;
    }

    const measure = () => {
      if (!linking.current) setCorner(cornerOfSelection(tracked.editor));
    };

    measure();
    document.addEventListener("selectionchange", measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("selectionchange", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [tracked, linkDraft]);

  useEffect(() => {
    if (linkDraft === null) return;

    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || root.current?.contains(event.target)) return;
      setLinkDraft(null);
    };

    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [linkDraft]);

  useLayoutEffect(() => {
    const element = root.current;
    if (element === null || corner === null) return;

    const { offsetWidth: width, offsetHeight: height } = element;
    const below = corner.bottom + OFFSET;
    const top = below + height <= window.innerHeight - EDGE ? below : corner.top - OFFSET - height;
    const left = Math.min(corner.right + OFFSET, window.innerWidth - EDGE - width);

    element.style.left = `${Math.max(left, EDGE)}px`;
    element.style.top = `${Math.max(top, EDGE)}px`;
  });

  const editor = tracked?.editor ?? (linkDraft !== null ? pinnedEditor.current : null);
  if (!page || !editor || editor.isDestroyed || !corner || (pressing && linkDraft === null)) return null;

  const block = tracked ? blockOf(page, tracked) : null;
  const kind = block?.kind?.() ?? null;
  const turn = kind === null ? undefined : block?.turnInto;
  const formattable = editor.schema.marks.bold !== undefined;
  if (linkDraft === null && !turn && !formattable) return null;

  const href = editor.getAttributes("link").href;

  const applyLink = () => {
    const value = (linkDraft ?? "").trim();
    const chain = editor.chain().focus().extendMarkRange("link");

    if (value) chain.setLink({ href: value }).run();
    else chain.unsetLink().run();

    setLinkDraft(null);
  };

  return (
    <div
      ref={root}
      className="not-prose fixed z-50 w-58 animate-popover-in rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100"
    >
      {linkDraft === null ? (
        <>
          {turn && kind !== null && <TurnIntoRow kind={kind} editor={editor} onTurn={turn} />}

          {formattable && (
            <>
              {turn && <Divider />}
              <div className="flex items-center justify-between">
                <MarkButton
                  label="Bold"
                  chords={[{ code: "KeyB" }]}
                  active={editor.isActive("bold")}
                  onPress={() => editor.chain().focus().toggleBold().run()}
                >
                  <strong className="text-[0.95rem]">B</strong>
                </MarkButton>
                <MarkButton
                  label="Italic"
                  chords={[{ code: "KeyI" }]}
                  active={editor.isActive("italic")}
                  onPress={() => editor.chain().focus().toggleItalic().run()}
                >
                  <em className="font-serif text-base">I</em>
                </MarkButton>
                <MarkButton
                  label="Strikethrough"
                  chords={[{ code: "KeyS", shift: true }]}
                  active={editor.isActive("strike")}
                  onPress={() => editor.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough />
                </MarkButton>
                <MarkButton
                  label="Inline code"
                  chords={[{ code: "KeyE" }]}
                  active={editor.isActive("code")}
                  onPress={() => editor.chain().focus().toggleCode().run()}
                >
                  <Code />
                </MarkButton>
                <MarkButton
                  label="Link"
                  active={editor.isActive("link")}
                  onPress={() => setLinkDraft(typeof href === "string" ? href : "")}
                >
                  <Link2 />
                </MarkButton>
                <MarkButton label="Clear formatting" onPress={() => editor.chain().focus().unsetAllMarks().run()}>
                  <RemoveFormatting />
                </MarkButton>
              </div>
            </>
          )}
        </>
      ) : (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <Input
            className="min-w-0 flex-1 border-0 focus-visible:ring-0"
            value={linkDraft}
            autoFocus
            placeholder="Paste a link"
            aria-label="Link address"
            onChange={(event) => setLinkDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              editor.commands.focus();
              setLinkDraft(null);
            }}
          />
          <Button type="submit" variant="ghost" size="sm" className={LABEL}>
            {linkDraft.trim() === "" && typeof href === "string" ? "remove" : "apply"}
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * The row naming the block's kind, which opens every kind it can become beside the menu.
 *
 * The choices take focus while open, so the arrow keys walk them, and hand it
 * back to the editor on close, so typing carries on where the selection is.
 */
function TurnIntoRow({ kind, editor, onTurn }: { kind: TurnKind; editor: Editor; onTurn(kind: TurnKind): void }) {
  const Icon = TURN_ICONS[kind];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={ROW}
          aria-label={`Turn into, now ${turnTitle(kind)}`}
          onMouseDown={(event) => event.preventDefault()}
        >
          <Icon />
          {turnTitle(kind)}
          <ChevronRight className="ml-auto" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={8}
        alignOffset={-5}
        collisionPadding={12}
        className="w-52"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!editor.isDestroyed) editor.commands.focus();
        }}
      >
        <TurnIntoItems current={kind} onTurn={onTurn} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Divider() {
  return <div className="-mx-1 my-1 h-px bg-border" />;
}

type MarkButtonProps = {
  label: string;
  /** The chords that do the same from the keyboard, shown in the tooltip. */
  chords?: Chord[];
  active?: boolean;
  onPress(): void;
  children: ReactNode;
};

/**
 * One formatting control, its name and shortcut in a tooltip.
 *
 * Mousedown is suppressed because the menu lives outside the contenteditable
 * whose selection it acts on, and a plain click would blur that editor and
 * collapse the very selection the command is about to act on.
 */
function MarkButton({ label, chords = [], active, onPress, children }: MarkButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "[&_svg]:size-4",
            active && "bg-accent text-primary",
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onPress}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <ShortcutHint label={label} chords={chords} />
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Where an editor's selection is on screen, or null once the browser no longer shows words selected in it.
 *
 * The browser's own selection is the judge rather than the editor's state,
 * which keeps its last range after a click elsewhere: a menu acting on words
 * nobody can see selected any more would change the wrong text.
 *
 * @example cornerOfSelection(editor); // { top: 120, right: 480, bottom: 168 }
 */
function cornerOfSelection(editor: Editor): Corner | null {
  const selection = window.getSelection();
  const range = selection?.rangeCount && !selection.isCollapsed ? selection.getRangeAt(0) : null;
  if (range === null || !editor.view.dom.contains(range.commonAncestorContainer)) return null;

  const lines = [...range.getClientRects()].filter((line) => line.width > 0 || line.height > 0);
  const first = lines[0];
  const last = lines.at(-1);

  return first && last ? { top: first.top, right: last.right, bottom: last.bottom } : null;
}

/**
 * The block a selection lies in, or null when it runs across more than one.
 *
 * Asked from both ends of the selection, so a paragraph inside a callout
 * answers as itself rather than as the callout.
 */
function blockOf(page: Inplace, { editor, from, to }: Selected): BlockOps | null {
  const at = (position: number) => {
    const { node } = editor.view.domAtPos(position);
    const element = node instanceof Element ? node : node.parentElement;
    return element === null ? null : blockAt(page.handles, document.body, element);
  };

  const start = at(from);
  return start !== null && start === at(Math.max(from, to - 1)) ? start : null;
}
