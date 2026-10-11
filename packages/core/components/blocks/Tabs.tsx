"use client";

import {
  createContext,
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "cn";
import { Tabs as Primitive } from "radix-ui";

/**
 * Tabs in a page: a row of titles over panels, the first open.
 *
 * Tabs that share a `groupId` switch together, remembered for the tab, or for
 * good with `persist`. A panel whose `id`, or something inside it, is in the
 * address opens on load. Adapted from Fumadocs UI, MIT.
 */

const groups = new Map<string, Set<(value: string) => void>>();

type Collection = { items?: string[]; order: string[]; panels: Map<string, HTMLElement>; ids: Map<string, string> };

const TabsContext = createContext<Collection | null>(null);

function useCollection() {
  const collection = use(TabsContext);
  if (!collection) throw new Error("A Tab needs Tabs around it.");
  return collection;
}

/**
 * A tab's title made into its value.
 *
 * @example escapeValue("Bun Install"); // "bun-install"
 */
function escapeValue(value: string) {
  return value.toLowerCase().replace(/\s/, "-");
}

type TabsProps = Omit<ComponentProps<typeof Primitive.Root>, "defaultValue"> & {
  items?: string[];
  label?: ReactNode;
  defaultIndex?: number;
  defaultValue?: string;
  groupId?: string;
  persist?: boolean;
};

/**
 * The tabs and their row of titles, drawn from `items` when given.
 *
 * @example <Tabs items={["bun", "npm"]}><Tab>bun add x</Tab><Tab>npm i x</Tab></Tabs>
 */
export function Tabs({
  className,
  items,
  label,
  defaultIndex = 0,
  defaultValue = items?.[defaultIndex] ? escapeValue(items[defaultIndex]) : undefined,
  groupId,
  persist = false,
  children,
  ...props
}: TabsProps) {
  const root = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue);
  const collection = useMemo<Collection>(() => ({ items, order: [], panels: new Map(), ids: new Map() }), [items]);

  useLayoutEffect(() => {
    if (!groupId) return;
    const remembered = sessionStorage.getItem(groupId) ?? (persist ? localStorage.getItem(groupId) : null);
    if (remembered) setValue(remembered);
    const listeners = groups.get(groupId) ?? new Set();
    listeners.add(setValue);
    groups.set(groupId, listeners);
    return () => {
      listeners.delete(setValue);
    };
  }, [groupId, persist]);

  useLayoutEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      for (const [panel, id] of collection.ids)
        if (id === hash) {
          setValue(panel);
          root.current?.scrollIntoView();
          return;
        }
      const target = document.getElementById(hash);
      if (!target) return;
      for (const [panel, element] of collection.panels)
        if (element.contains(target)) {
          setValue(panel);
          requestAnimationFrame(() => target.scrollIntoView());
          return;
        }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [collection]);

  function choose(next: string) {
    if (items && !items.some((item) => escapeValue(item) === next)) return;
    if (!groupId) return setValue(next);
    for (const listener of groups.get(groupId) ?? []) listener(next);
    sessionStorage.setItem(groupId, next);
    if (persist) localStorage.setItem(groupId, next);
  }

  return (
    <Primitive.Root
      ref={root}
      value={value}
      onValueChange={choose}
      {...props}
      className={cn("my-4 flex flex-col overflow-hidden rounded-xl border bg-secondary", className)}
    >
      {items && (
        <TabsList>
          {label && <span className="my-auto me-auto font-medium text-sm">{label}</span>}
          {items.map((item) => (
            <TabsTrigger key={item} value={escapeValue(item)}>
              {item}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      <TabsContext value={collection}>{children}</TabsContext>
    </Primitive.Root>
  );
}

/** The row of titles. */
export function TabsList({ className, ...props }: ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      {...props}
      className={cn("not-prose flex gap-3.5 overflow-x-auto px-4 text-secondary-foreground", className)}
    />
  );
}

/** One title of the row. */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      {...props}
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap border-transparent border-b py-2 font-medium text-muted-foreground text-sm transition-colors hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-primary [&_svg]:size-4",
        className,
      )}
    />
  );
}

/**
 * One panel, matched to its title by `value`, or by its place among the panels when the tabs list `items`.
 *
 * @example <Tab value="npm">npm i x</Tab>
 */
export function Tab({ value, ...props }: Omit<ComponentProps<typeof Primitive.Content>, "value"> & { value?: string }) {
  const { items } = useCollection();
  const place = useCollectionIndex();
  const resolved = value ?? items?.at(place);
  if (!resolved) throw new Error("A Tab needs a value when its Tabs list no items.");
  return <TabsContent value={escapeValue(resolved)} {...props} />;
}

/** A panel by value, registered so an address can open it. */
export function TabsContent({ value, className, id, ...props }: ComponentProps<typeof Primitive.Content>) {
  const { ids, panels } = useCollection();
  if (id) ids.set(value, id);

  return (
    <Primitive.Content
      ref={(element) => {
        if (element) panels.set(value, element);
        else panels.delete(value);
      }}
      value={value}
      id={id}
      {...props}
      className={cn(
        "prose-no-margin rounded-xl bg-background p-4 text-[0.9375rem] outline-none data-[state=inactive]:hidden [&>figure:only-child]:-m-4 [&>figure:only-child]:border-none",
        className,
      )}
    />
  );
}

/**
 * The place of this panel among its siblings, in the order they first rendered.
 *
 * @example useCollectionIndex(); // 1 for the second Tab
 */
function useCollectionIndex() {
  const key = useId();
  const { order } = useCollection();

  useEffect(
    () => () => {
      const at = order.indexOf(key);
      if (at !== -1) order.splice(at, 1);
    },
    [key, order],
  );

  if (!order.includes(key)) order.push(key);
  return order.indexOf(key);
}
