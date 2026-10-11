"use client";

/** A lazy, searchable Lucide catalog for the page-title metadata field. */

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "cn";
import { CircleDashed, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import { DynamicIcon, dynamicIconImports, iconNames, type IconName } from "lucide-react/dynamic";
import { Popover } from "radix-ui";
import { Button } from "@jotdown/core/components/ui/button";
import { Input } from "@jotdown/core/components/ui/input";

const FEATURED_ICONS = [
  "book-open",
  "file-text",
  "scroll-text",
  "pencil-line",
  "lightbulb",
  "circle-help",
  "settings",
  "wrench",
  "shield",
  "code-2",
  "database",
  "server",
  "cloud",
  "globe-2",
  "users",
  "briefcase-business",
  "calendar-days",
  "bell",
  "search",
  "link",
  "bookmark",
  "folder",
  "folder-cog",
  "git-branch",
  "git-pull-request",
  "bug",
  "test-tube-2",
  "monitor",
  "square-terminal",
  "package",
  "plug",
  "network",
  "layers-3",
  "layout-dashboard",
  "chart-bar",
  "activity",
  "target",
  "compass",
  "mail",
  "message-circle",
  "image",
  "key-round",
  "badge-check",
  "alert-triangle",
  "bot",
  "brain",
  "sparkles",
  "refresh-cw",
  "workflow",
] satisfies IconName[];

const MAX_RESULTS = 64;

type Props = {
  value: string | null;
  readOnly: boolean;
  onChange(icon: string | null): void;
  /** What the trigger wears, so a picker can stand exactly where a read icon does. */
  className?: string;
  /**
   * The glyph to draw instead of looking one up.
   *
   * The page icon is rendered by the server from the page tree, and drawing it
   * again here would mean `DynamicIcon` fetching its module in the browser: the
   * icon already on screen would blink to a placeholder and back on a page
   * nobody has touched. Handed the element the server already drew, the picker
   * draws that and loads nothing until a different icon is chosen.
   */
  children?: ReactNode;
  /** What the picker is choosing an icon for, as its heading says it. */
  label?: string;
  /** Held by the caller when something other than the trigger opens it, a menu item say. */
  open?: boolean;
  onOpenChange?(open: boolean): void;
};

/**
 * Converts a Lucide file name into the name stored in frontmatter.
 *
 * @example metadataName("book-open"); // "BookOpen"
 */
function metadataName(name: IconName) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Converts frontmatter's component name into Lucide's dynamic import name.
 *
 * Exported because a sidebar link stores the same spelling and has to draw the
 * same icon, without a page of frontmatter to read it from.
 *
 * @example dynamicName("GitPullRequest"); // "git-pull-request"
 */
export function dynamicName(name: string | null): IconName | null {
  if (!name) return null;

  const candidate = name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .replace(/(\d)([A-Za-z])/g, "$1-$2")
    .replace(/-(\d)-x-(\d)/g, "-$1x$2")
    .toLowerCase() as IconName;

  return iconNames.includes(candidate) ? candidate : null;
}

/**
 * Turns Lucide's file spelling into a short human label.
 *
 * @example iconLabel("circle-help"); // "Circle Help"
 */
function iconLabel(name: IconName) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Finds a bounded set of icons for the current search.
 *
 * @example matchingIcons("git branch"); // ["git-branch", ...]
 */
function matchingIcons(query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return FEATURED_ICONS;

  return iconNames.filter((name) => words.every((word) => name.includes(word))).slice(0, MAX_RESULTS);
}

/** Stands where an icon is named that Lucide does not have, so the name is noticed and replaced. */
export function UnknownIcon() {
  return <TriangleAlert className="text-destructive" />;
}

/** Keeps an icon button occupied while its Lucide module loads. */
function IconFallback() {
  return <CircleDashed />;
}

/**
 * A searchable Lucide picker anchored where the page icon is rendered.
 *
 * @example <IconPicker value="BookOpen" readOnly={false} onChange={setIcon} />
 */
export default function IconPicker({
  value,
  readOnly,
  onChange,
  className,
  children,
  label = "Page icon",
  open: held,
  onOpenChange,
}: Props) {
  const [own, setOwn] = useState(false);
  const open = held ?? own;
  const setOpen = (next: boolean) => {
    setOwn(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState("");
  const selected = dynamicName(value);
  const unknown = Boolean(value) && !selected;
  const title = unknown
    ? `"${value}" is not a Lucide icon, pick another`
    : `${selected ? "Change" : "Add"} ${label.toLowerCase()}`;
  const matches = useMemo(() => matchingIcons(query), [query]);

  const choose = async (name: IconName) => {
    const loaded = await dynamicIconImports[name]();
    onChange(loaded.default.displayName ?? metadataName(name));
    setOpen(false);
    setQuery("");
  };

  const remove = () => {
    onChange(null);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className={cn(
            "mt-0.5 -ml-1 text-muted-foreground",
            selected ? "text-foreground [&_svg]:size-7" : "border border-border border-dashed [&_svg]:size-5",
            className,
          )}
          disabled={readOnly}
          aria-label={title}
          title={title}
        >
          {children ??
            (selected ? <DynamicIcon name={selected} fallback={IconFallback} /> : unknown ? <UnknownIcon /> : <Plus />)}
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none data-[state=closed]:animate-popover-out data-[state=open]:animate-popover-in"
        >
          <p className="mb-2 font-medium text-sm">{label}</p>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-8"
              placeholder="Search Lucide icons"
              aria-label={`Search ${label.toLowerCase()}s`}
              autoFocus
            />
          </div>

          {matches.length > 0 ? (
            <div className="mt-3 grid max-h-72 grid-cols-8 gap-1 overflow-y-auto pr-1">
              {matches.map((name) => {
                const label = iconLabel(name);

                return (
                  <button
                    key={name}
                    type="button"
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      selected === name && "bg-primary/10 text-primary ring-1 ring-primary/30",
                    )}
                    aria-label={`Use ${label}`}
                    aria-pressed={selected === name}
                    title={label}
                    onClick={() => void choose(name)}
                  >
                    <DynamicIcon name={name} fallback={IconFallback} className="size-4" />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="my-8 text-center text-muted-foreground text-sm">No matching icons</p>
          )}

          {value && (
            <div className="mt-2 border-border border-t pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={remove}>
                <Trash2 />
                Remove icon
              </Button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
