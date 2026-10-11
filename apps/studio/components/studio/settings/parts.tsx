"use client";

import { createContext, use, type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";
import { RotateCcw } from "lucide-react";
import { Input } from "@jotdown/core/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { useDraft } from "./draft";
import { valueAt, withValue } from "@/lib/settings/config-draft";

/**
 * The pieces every settings section is built from: a titled group of rows, and a row with its label, its control and its state.
 *
 * A row knows the config paths it edits, so it marks itself changed, shows the
 * schema's complaint about them, offers to put them back, and drops out of a
 * search that does not name it. A group with no rows left hides itself.
 */

const SearchContext = createContext("");

/**
 * Narrows every row inside to those whose words contain the query.
 *
 * @example <SettingsSearch query="radius"><ThemeSection /></SettingsSearch>
 */
export function SettingsSearch({ query, children }: { query: string; children: ReactNode }) {
  return <SearchContext value={query.trim().toLowerCase()}>{children}</SearchContext>;
}

/** Whether a search is narrowing the rows. */
export function useSearching() {
  return use(SearchContext) !== "";
}

type GroupProps = { title: string; action?: ReactNode; className?: string; children: ReactNode };

/**
 * A titled card of rows, hidden when a search leaves none of them.
 *
 * @example <SettingsGroup title="Site"><SettingsRow … /></SettingsGroup>
 */
export function SettingsGroup({ title, action, className, children }: GroupProps) {
  return (
    <section className={cn("flex flex-col gap-2.5 [&:not(:has([data-settings-row]))]:hidden", className)}>
      <header className="flex min-h-7 items-end justify-between gap-3 px-1">
        <h3 className="font-medium text-muted-foreground text-sm">{title}</h3>
        {action && <div className="flex items-center gap-1.5">{action}</div>}
      </header>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}

type RowProps = {
  label: string;
  description?: ReactNode;
  /** The config paths the row edits, for its changed mark, its problems and its reset. */
  paths?: string[];
  /** More words a search should find the row by. */
  keywords?: string;
  /** Lays the control out under the label, the full width of the card. */
  stacked?: boolean;
  /** Something beside the label, a badge or a hint. */
  aside?: ReactNode;
  children?: ReactNode;
};

/**
 * One setting: its label and description on the left, its control on the right or underneath.
 *
 * @example <SettingsRow label="Title" paths={["title"]}><Input … /></SettingsRow>
 */
export function SettingsRow({ label, description, paths = [], keywords = "", stacked, aside, children }: RowProps) {
  const query = use(SearchContext);
  const draft = useDraft();
  const changed = paths.some((path) =>
    draft.changes.some((change) => change === path || change.startsWith(`${path}.`)),
  );
  const problem = paths
    .flatMap((path) =>
      [...draft.issues].filter(([at]) => at === path || at.startsWith(`${path}.`)).map(([, message]) => message),
    )
    .at(0);

  const words = `${label} ${typeof description === "string" ? description : ""} ${keywords} ${paths.join(" ")}`;
  if (query && !words.toLowerCase().includes(query)) return null;

  function reset() {
    draft.update((config) => paths.reduce((next, path) => withValue(next, path, valueAt(draft.saved, path)), config));
  }

  return (
    <div
      data-settings-row=""
      data-changed={changed || undefined}
      className={cn("flex gap-x-6 gap-y-3 px-4 py-3.5", stacked ? "flex-col" : "items-center justify-between")}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-h-5 items-center gap-1.5">
          <span className="font-medium text-sm">{label}</span>
          {aside}
          {changed && <ResetButton label={label} onReset={reset} />}
        </div>
        {problem ? (
          <p className="text-destructive text-xs">{problem}</p>
        ) : (
          description && <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
        )}
      </div>
      {children && (
        <div className={cn("flex min-w-0 items-center gap-2", stacked ? "w-full" : "shrink-0 justify-end")}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * A free-form block inside a group, a grid of cards say, found by a search for its words.
 *
 * @example <SettingsBlock keywords="palette preset"><Presets /></SettingsBlock>
 */
export function SettingsBlock({ keywords, children }: { keywords: string; children: ReactNode }) {
  const query = use(SearchContext);
  if (query && !keywords.toLowerCase().includes(query)) return null;
  return <div data-settings-row="">{children}</div>;
}

/** The small arrow beside a changed setting that puts it back the way it was saved. */
function ResetButton({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Undo the change to ${label}`}
          onClick={onReset}
          className="grid size-5 place-items-center rounded text-primary outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="size-3" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">Undo this change</TooltipContent>
    </Tooltip>
  );
}

/**
 * A segmented control: a few choices side by side, one of them on.
 *
 * @example <Segmented value={mode} options={[{ value: "light", label: "Light" }]} onChange={setMode} />
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-muted p-0.5">
      {options.map((option) => (
        // biome-ignore lint/a11y/useSemanticElements: a segmented control is a row of radio buttons drawn as one bar
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className="flex h-6 items-center gap-1.5 rounded-md px-2.5 font-medium text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type TextProps = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & { path: string };

/**
 * A text input bound to one config path, an empty field taking the key out.
 *
 * @example <TextSetting path="title" placeholder="Documentation" />
 */
export function TextSetting({ path, className, ...props }: TextProps) {
  const { config, update, issues } = useDraft();
  const value = valueAt(config, path);

  return (
    <Input
      {...props}
      value={typeof value === "string" ? value : ""}
      aria-invalid={issues.has(path) || undefined}
      onChange={(event) => update((current) => withValue(current, path, event.target.value || undefined))}
      className={cn("h-8", className)}
    />
  );
}
