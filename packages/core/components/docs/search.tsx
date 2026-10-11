"use client";

import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";
import { cn } from "cn";
import { chromeButton } from "./button";

/**
 * The search dialog every page shares: whether it is open, the shortcut that opens it, and the buttons that do.
 *
 * Adapted from Fumadocs UI, MIT.
 */

/** What a search dialog is handed: whether it is open, and how to close it. */
export type SearchDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

type SearchState = {
  enabled: boolean;
  open: boolean;
  setOpenSearch: (open: boolean) => void;
  /** The shortcut's keys, as the search button prints them. */
  keys: ReactNode[];
};

const SearchContext = createContext<SearchState>({ enabled: false, open: false, setOpenSearch: () => {}, keys: [] });

type ProviderProps = {
  dialog: ComponentType<SearchDialogProps>;
  /** Whether a key press is the shortcut that opens and closes the dialog. */
  shortcut: (event: KeyboardEvent) => boolean;
  keys: ReactNode[];
  children: ReactNode;
};

/**
 * Mounts the dialog and answers its shortcut anywhere on the page.
 *
 * @example <SearchProvider dialog={ProjectSearch} shortcut={(event) => event.metaKey && event.key === "k"} keys={["⌘", "K"]}>{page}</SearchProvider>
 */
export function SearchProvider({ dialog: Dialog, shortcut, keys, children }: ProviderProps) {
  const [open, setOpen] = useState(false);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!shortcut(event)) return;
    event.preventDefault();
    setOpen((shown) => !shown);
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const search = useMemo(() => ({ enabled: true, open, setOpenSearch: setOpen, keys }), [open, keys]);

  return (
    <SearchContext value={search}>
      <Dialog open={open} onOpenChange={setOpen} />
      {children}
    </SearchContext>
  );
}

/**
 * The page's search, disabled when no provider is above.
 *
 * @example const { enabled, setOpenSearch } = useSearchContext();
 */
export function useSearchContext() {
  return use(SearchContext);
}

/**
 * The full-width search field at the top of the sidebar, with the shortcut's keys.
 *
 * @example <FullSearchTrigger />
 */
export function FullSearchTrigger({ className, ...props }: ComponentProps<"button">) {
  const { enabled, keys, setOpenSearch } = useSearchContext();
  if (!enabled) return null;

  return (
    <button
      type="button"
      data-search-full=""
      {...props}
      onClick={() => setOpenSearch(true)}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border bg-secondary/50 p-1.5 ps-2 text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <Search className="size-4" />
      Search
      <div className="ms-auto inline-flex gap-0.5">
        {keys.map((key, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the keys of one shortcut never reorder
          <kbd key={index} className="rounded-md border bg-background px-1.5">
            {key}
          </kbd>
        ))}
      </div>
    </button>
  );
}

/**
 * The magnifier button that opens search where there is no room for the field.
 *
 * @example <SearchTrigger className="p-2" />
 */
export function SearchTrigger({ className }: { className?: string }) {
  const { enabled, setOpenSearch } = useSearchContext();
  if (!enabled) return null;

  return (
    <button
      type="button"
      data-search=""
      aria-label="Open search"
      className={cn(chromeButton({ variant: "ghost", size: "icon-sm" }), className)}
      onClick={() => setOpenSearch(true)}
    >
      <Search />
    </button>
  );
}
