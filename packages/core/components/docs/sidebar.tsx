"use client";

import {
  Fragment,
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type FC,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import { cn } from "cn";
import { cva } from "class-variance-authority";
import { ChevronDown, ExternalLink, SidebarIcon } from "lucide-react";
import { Collapsible, ScrollArea } from "radix-ui";
import Link from "fumadocs-core/link";
import type * as PageTree from "fumadocs-core/page-tree";
import { usePathname } from "fumadocs-core/framework";
import { useMediaQuery } from "fumadocs-core/utils/use-media-query";
import { useOnChange } from "fumadocs-core/utils/use-on-change";
import { chromeButton } from "./button";
import { CollapsibleContent } from "./collapsible";
import { useDocsLayout } from "./context";
import { FullSearchTrigger, SearchTrigger } from "./search";
import { isActive, useTreeContext, useTreePath } from "./tree";

/**
 * The docs sidebar: the page tree in an aside on a desktop, folded away on demand, and a drawer on a phone.
 *
 * Folded, the aside slides out of the grid and comes back while the pointer is
 * near the window's edge. A row's indent and its active rail follow its depth
 * in the tree. Adapted from Fumadocs UI, MIT.
 */

type SidebarState = {
  open: boolean;
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean | ((collapsed: boolean) => boolean)) => void;
  /** Whether the next navigation closes the phone drawer; one choice can ask it to stay open. */
  closeOnRedirect: RefObject<boolean>;
  mode: "drawer" | "full";
};

type Folder = { open: boolean; setOpen: (open: boolean) => void; depth: number; collapsible: boolean };

const SidebarContext = createContext<SidebarState | null>(null);
const FolderContext = createContext<Folder | null>(null);

/**
 * Holds whether the sidebar is folded, whether the phone drawer is open, and which of the two is drawn.
 *
 * @example <SidebarProvider>{layout}</SidebarProvider>
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const closeOnRedirect = useRef(true);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const mode = useMediaQuery("(width < 768px)") ? "drawer" : "full";

  useOnChange(usePathname(), () => {
    if (closeOnRedirect.current) setOpen(false);
    closeOnRedirect.current = true;
  });

  const state = useMemo(
    () => ({ open, setOpen, collapsed, setCollapsed, closeOnRedirect, mode }) as const,
    [open, collapsed, mode],
  );

  return <SidebarContext value={state}>{children}</SidebarContext>;
}

/**
 * The sidebar's state, from anywhere inside the layout.
 *
 * @example const { collapsed, setCollapsed } = useSidebar();
 */
export function useSidebar() {
  const sidebar = use(SidebarContext);
  if (!sidebar) throw new Error("useSidebar needs a DocsLayout above it.");
  return sidebar;
}

/**
 * How many folders deep the row being drawn sits, zero at the top.
 *
 * @example useFolderDepth(); // 1 inside a top-level folder
 */
export function useFolderDepth() {
  return use(FolderContext)?.depth ?? 0;
}

/** Rows a sidebar draws in place of the default ones, one component per kind of node. */
export type SidebarComponents = {
  Item?: FC<{ item: PageTree.Item }>;
  Folder?: FC<{ item: PageTree.Folder; children: ReactNode }>;
  Separator?: FC<{ item: PageTree.Separator }>;
};

export type SidebarProps = {
  components?: SidebarComponents;
  /** What sits under the logo, above the tree. */
  banner?: ReactNode;
  /** What sits under the tree. */
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * The aside on a desktop and the drawer on a phone, each holding the logo, search, the banner, the tree and the footer.
 *
 * @example <Sidebar banner={<SectionSwitcher sections={tabs} />} footer={<SidebarFooter />} />
 */
export function Sidebar({ components, banner, footer, className, style }: SidebarProps) {
  const { navTitle: NavTitle, navChildren } = useDocsLayout();
  const viewport = (
    <SidebarViewport>
      <SidebarPageTree {...components} />
    </SidebarViewport>
  );

  return (
    <>
      <SidebarAside className={className} style={style}>
        <div className="flex flex-col gap-3 p-4 pb-2">
          <div className="flex">
            <NavTitle className="me-auto inline-flex items-center gap-2.5 font-medium text-[0.9375rem]" />
            {navChildren}
          </div>
          <FullSearchTrigger />
          {banner}
        </div>
        {viewport}
        <div className="flex flex-col p-4 pt-2">{footer}</div>
      </SidebarAside>

      <SidebarDrawer className={className} style={style}>
        <div className="flex flex-col gap-3 p-4 pb-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <div className="flex flex-1" />
            <SidebarTrigger className={chromeButton({ variant: "ghost", size: "icon-sm", className: "p-2" })}>
              <SidebarIcon />
            </SidebarTrigger>
          </div>
          {banner}
        </div>
        {viewport}
        <div className="flex flex-col border-t p-4 pt-2 empty:hidden">{footer}</div>
      </SidebarDrawer>
    </>
  );
}

/**
 * The desktop aside, which slides away when folded and comes back while the pointer is at the window's edge.
 *
 * A placeholder holds its column in the grid; the folded state shows a small
 * floating panel with the unfold and search buttons.
 */
function SidebarAside({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { collapsed, mode } = useSidebar();
  const [hovered, setHovered] = useState(false);
  const aside = useRef<HTMLElement>(null);
  const timer = useRef(0);
  const wasCollapsed = useRef(collapsed);

  useOnChange(collapsed, () => {
    if (collapsed) setHovered(false);
  });

  useEffect(() => {
    wasCollapsed.current = collapsed;
  });

  if (mode !== "full") return null;

  const ignored = (event: PointerEvent) =>
    !collapsed || event.pointerType === "touch" || (aside.current?.getAnimations().length ?? 0) > 0;

  const hover = {
    onPointerEnter(event: PointerEvent) {
      if (ignored(event)) return;
      window.clearTimeout(timer.current);
      setHovered(true);
    },
    onPointerLeave(event: PointerEvent) {
      if (ignored(event)) return;
      window.clearTimeout(timer.current);
      const nearEdge = Math.min(event.clientX, document.body.clientWidth - event.clientX) <= 100;
      timer.current = window.setTimeout(() => setHovered(false), nearEdge ? 500 : 0);
    },
  };

  return (
    <>
      <div
        data-sidebar-placeholder=""
        className="pointer-events-none sticky top-(--jd-docs-row-1) z-20 h-[calc(var(--jd-docs-height)-var(--jd-docs-row-1))] [grid-area:sidebar] *:pointer-events-auto max-md:hidden md:layout:[--jd-sidebar-width:268px]"
      >
        {collapsed && <div className="absolute inset-s-0 inset-y-0 w-4" {...hover} />}
        <aside
          id="jd-sidebar"
          ref={aside}
          data-collapsed={collapsed}
          data-hovered={collapsed && hovered}
          inert={collapsed && !hovered}
          {...hover}
          style={style}
          className={cn(
            "absolute inset-s-0 inset-y-0 flex w-full flex-col items-end border-e bg-card text-sm duration-250 *:w-(--jd-sidebar-width)",
            collapsed && [
              "inset-y-2 w-(--jd-sidebar-width) rounded-xl border transition-transform",
              hovered
                ? "translate-x-2 shadow-lg rtl:-translate-x-2"
                : "-translate-x-(--jd-sidebar-width) rtl:translate-x-full",
            ],
            wasCollapsed.current !== collapsed && "transition-[width,inset-block,translate,background-color]",
            className,
          )}
        >
          {children}
        </aside>
      </div>

      <div
        data-sidebar-panel=""
        inert={!collapsed || hovered}
        className={cn(
          "fixed inset-s-4 top-[calc(--spacing(4)+var(--jd-docs-row-3))] z-10 flex rounded-xl border bg-muted p-0.5 text-muted-foreground shadow-lg transition-opacity",
          (!collapsed || hovered) && "pointer-events-none opacity-0",
        )}
      >
        <SidebarCollapseTrigger
          className={chromeButton({ variant: "ghost", size: "icon-sm", className: "rounded-lg" })}
        >
          <SidebarIcon />
        </SidebarCollapseTrigger>
        <SearchTrigger className="rounded-lg" />
      </div>
    </>
  );
}

/**
 * The phone's drawer and the shade behind it, which closes it.
 *
 * Kept mounted until its closing animation ends, then dropped.
 */
function SidebarDrawer({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { open, setOpen, mode } = useSidebar();
  const shown = usePresence(open);
  if (mode !== "drawer") return null;

  const state = open ? "open" : "closed";

  return (
    <>
      {shown.present && (
        // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: the shade is a pointer's way out; Escape and the close button are the keyboard's
        <div
          data-state={state}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 backdrop-blur-xs data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        />
      )}
      {shown.present && (
        <aside
          id="jd-sidebar-mobile"
          ref={shown.ref}
          data-state={state}
          style={style}
          className={cn(
            "fixed inset-e-0 inset-y-0 z-40 flex w-[85%] max-w-[380px] flex-col border-s bg-background text-[0.9375rem] shadow-lg data-[state=closed]:animate-sidebar-out data-[state=open]:animate-sidebar-in",
            className,
          )}
        >
          {children}
        </aside>
      )}
    </>
  );
}

/**
 * Keeps an element mounted after it closes, until its closing animation has run.
 *
 * @example const { present, ref } = usePresence(open);
 */
function usePresence(open: boolean) {
  const [present, setPresent] = useState(open);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) return setPresent(true);
    const element = ref.current;
    if (!element || element.getAnimations().length === 0) return setPresent(false);
    const done = () => setPresent(false);
    element.addEventListener("animationend", done, { once: true });
    return () => element.removeEventListener("animationend", done);
  }, [open]);

  return { present: open || present, ref };
}

/**
 * The scrolling area that holds the tree, fading at its top and bottom edges.
 *
 * @example <SidebarViewport><SidebarPageTree /></SidebarViewport>
 */
export function SidebarViewport({ children }: { children: ReactNode }) {
  return (
    <ScrollArea.Root type="scroll" className="min-h-0 flex-1 overflow-hidden">
      <ScrollArea.Viewport className="mask-[linear-gradient(to_bottom,transparent,white_12px,white_calc(100%-12px),transparent)] *:flex! size-full overscroll-contain rounded-[inherit] p-4 *:flex-col! *:gap-0.5!">
        {children}
      </ScrollArea.Viewport>
      <ScrollArea.Corner />
      <ScrollArea.Scrollbar className="flex h-full w-1.5 select-none data-[state=hidden]:animate-fade-out">
        <ScrollArea.Thumb className="relative flex-1 rounded-full bg-border" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}

/**
 * The button that opens and closes the phone drawer.
 *
 * @example <SidebarTrigger><SidebarIcon /></SidebarTrigger>
 */
export function SidebarTrigger({ children, ...props }: ComponentProps<"button">) {
  const { open, setOpen } = useSidebar();

  return (
    <button
      type="button"
      aria-label={open ? "Close sidebar" : "Open sidebar"}
      aria-expanded={open}
      aria-controls="jd-sidebar-mobile"
      onClick={() => setOpen((shown) => !shown)}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * The button that folds the desktop aside away and back.
 *
 * Focus moves to the other copy of the button when this one is about to be hidden.
 */
function SidebarCollapseTrigger({ children, ...props }: ComponentProps<"button">) {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <button
      type="button"
      aria-label="Collapse sidebar"
      aria-controls="jd-sidebar"
      aria-expanded={!collapsed}
      data-collapsed={collapsed}
      onClick={(event) => {
        const button = event.currentTarget;
        flushSync(() => setCollapsed((folded) => !folded));
        if (button.matches("[inert] *"))
          document.querySelector<HTMLElement>('[aria-controls="jd-sidebar"]:not([inert] *)')?.focus();
      }}
      {...props}
    >
      {children}
    </button>
  );
}

const row = cva(
  "wrap-anywhere relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        link: "transition-colors hover:bg-accent/50 hover:text-accent-foreground/80 hover:transition-none data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:hover:transition-colors",
        button: "transition-colors hover:bg-accent/50 hover:text-accent-foreground/80 hover:transition-none",
      },
      highlight: {
        true: "data-[active=true]:before:absolute data-[active=true]:before:inset-s-2.5 data-[active=true]:before:inset-y-2.5 data-[active=true]:before:w-px data-[active=true]:before:bg-primary data-[active=true]:before:content-['']",
      },
    },
  },
);

/**
 * How far a row at a depth is indented.
 *
 * @example indent(1); // "calc(5 * var(--spacing))"
 */
export function indent(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

type ItemProps = ComponentProps<typeof Link> & { icon?: ReactNode; active?: boolean; external?: boolean };

/**
 * One page row of the tree, scrolled into view when it is the open page.
 *
 * @example <SidebarItem href="/guides" active icon={<Book />}>Guides</SidebarItem>
 */
export function SidebarItem({ icon, active = false, className, style, children, ...props }: ItemProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const depth = useFolderDepth();
  useAutoScroll(active, ref);

  return (
    <Link
      ref={ref}
      data-active={active}
      {...props}
      className={cn(row({ variant: "link", highlight: depth >= 1 }), className)}
      style={{ paddingInlineStart: indent(depth), ...style }}
    >
      {icon ?? (props.external ? <ExternalLink /> : null)}
      {children}
    </Link>
  );
}

/**
 * A folder of the tree, open when it holds the open page, and always open when it cannot fold.
 *
 * @example <SidebarFolder active collapsible>{rows}</SidebarFolder>
 */
function SidebarFolder({
  defaultOpen: asked,
  collapsible = true,
  active = false,
  children,
}: {
  defaultOpen?: boolean;
  collapsible?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  const depth = useFolderDepth() + 1;
  const defaultOpen = !collapsible || active || (asked ?? false);
  const [open, setOpen] = useState(defaultOpen);

  useOnChange(defaultOpen, (now) => {
    if (now) setOpen(now);
  });

  const folder = useMemo(() => ({ open, setOpen, depth, collapsible }), [collapsible, depth, open]);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} disabled={!collapsible}>
      <FolderContext value={folder}>{children}</FolderContext>
    </Collapsible.Root>
  );
}

function Chevron({ open }: { open: boolean }) {
  return <ChevronDown data-icon className={cn("ms-auto transition-transform", !open && "-rotate-90 rtl:rotate-90")} />;
}

/** A folder's row when the folder has no page of its own: it only opens and closes. */
function SidebarFolderTrigger({ children }: { children: ReactNode }) {
  const folder = use(FolderContext);
  if (!folder) return null;
  const className = cn(row({ variant: folder.collapsible ? "button" : null }), "w-full");
  const style = { paddingInlineStart: indent(folder.depth - 1) };

  if (!folder.collapsible)
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );

  return (
    <Collapsible.Trigger className={className} style={style}>
      {children}
      <Chevron open={folder.open} />
    </Collapsible.Trigger>
  );
}

/** A folder's row when the folder is a page too: the label goes there, the chevron folds it. */
function SidebarFolderLink({
  href,
  active = false,
  external,
  children,
}: {
  href: string;
  active?: boolean;
  external?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const folder = use(FolderContext);
  useAutoScroll(active, ref);
  if (!folder) return null;

  return (
    <Link
      ref={ref}
      href={href}
      external={external}
      data-active={active}
      onClick={(event) => {
        if (!folder.collapsible) return;
        if (event.target instanceof Element && event.target.matches("[data-icon], [data-icon] *")) {
          folder.setOpen(!folder.open);
          event.preventDefault();
        } else folder.setOpen(active ? !folder.open : true);
      }}
      className={cn(row({ variant: "link", highlight: folder.depth > 1 }), "w-full")}
      style={{ paddingInlineStart: indent(folder.depth - 1) }}
    >
      {children}
      {folder.collapsible && <Chevron open={folder.open} />}
    </Link>
  );
}

/** The rows inside a folder, with a rail down their left edge at the first level. */
function SidebarFolderContent({ children }: { children: ReactNode }) {
  const depth = useFolderDepth();

  return (
    <CollapsibleContent
      className={cn(
        "relative",
        depth === 1 &&
          "before:absolute before:inset-s-2.5 before:inset-y-1 before:w-px before:bg-border before:content-['']",
      )}
    >
      <div className="flex flex-col gap-0.5 pt-0.5">{children}</div>
    </CollapsibleContent>
  );
}

/** A label over a group of rows. */
function SidebarSeparator({ children }: { children: ReactNode }) {
  const depth = useFolderDepth();

  return (
    <p
      className={cn(
        "mt-6 mb-1 inline-flex items-center gap-2 px-2 empty:mb-0 [&_svg]:size-4 [&_svg]:shrink-0",
        depth === 0 && "first:mt-0",
      )}
      style={{ paddingInlineStart: indent(depth) }}
    >
      {children}
    </p>
  );
}

/**
 * Every node of the open section's tree as rows, each kind drawn by the given component when there is one.
 *
 * @example <SidebarPageTree Item={SidebarPage} />
 */
export function SidebarPageTree({ Item, Folder, Separator }: SidebarComponents) {
  const { root } = useTreeContext();
  const pathname = usePathname();
  const path = useTreePath();

  function draw(nodes: PageTree.Node[]): ReactNode[] {
    return nodes.map((node, index) => {
      const key = node.$id ?? index;

      if (node.type === "separator")
        return Separator ? (
          <Separator key={key} item={node} />
        ) : (
          <SidebarSeparator key={key}>
            {node.icon}
            {node.name}
          </SidebarSeparator>
        );

      if (node.type === "folder") {
        if (Folder)
          return (
            <Folder key={key} item={node}>
              {draw(node.children)}
            </Folder>
          );
        return (
          <SidebarFolder
            key={key}
            collapsible={node.collapsible}
            active={path.includes(node)}
            defaultOpen={node.defaultOpen}
          >
            {node.index ? (
              <SidebarFolderLink
                href={node.index.url}
                active={isActive(node.index.url, pathname)}
                external={node.index.external}
              >
                {node.icon}
                {node.name}
              </SidebarFolderLink>
            ) : (
              <SidebarFolderTrigger>
                {node.icon}
                {node.name}
              </SidebarFolderTrigger>
            )}
            <SidebarFolderContent>{draw(node.children)}</SidebarFolderContent>
          </SidebarFolder>
        );
      }

      if (Item) return <Item key={key} item={node} />;
      return (
        <SidebarItem
          key={key}
          href={node.url}
          external={node.external}
          active={isActive(node.url, pathname)}
          icon={node.icon}
        >
          {node.name}
        </SidebarItem>
      );
    });
  }

  return <Fragment key={root.$id}>{draw(root.children)}</Fragment>;
}

/**
 * Scrolls the sidebar, and only the sidebar, until the open page's row is in view.
 *
 * @example useAutoScroll(active, ref);
 */
function useAutoScroll(active: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const row = ref.current;
    const viewport = row?.closest<HTMLElement>("[data-radix-scroll-area-viewport]");
    if (!active || !row || !viewport) return;

    const shown = viewport.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    if (box.top < shown.top) viewport.scrollTop -= shown.top - box.top;
    else if (box.bottom > shown.bottom) viewport.scrollTop += box.bottom - shown.bottom;
  }, [active, ref]);
}
