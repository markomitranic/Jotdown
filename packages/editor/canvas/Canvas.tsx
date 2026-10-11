"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { FrameworkProvider } from "fumadocs-core/framework";
import { DocsShell, SidebarFooter } from "@jotdown/core/components/DocsShell";
import { DocsBody, DocsPage, DocsTitle } from "@jotdown/core/components/docs/page";
import { PageContent } from "@jotdown/core/components/PageContent";
import { SiteLink } from "@jotdown/core/components/SiteLink";
import { TitleBarControls, WindowTitleBar } from "@jotdown/core/components/WindowTitleBar";
import { SHORTCUTS, pressed } from "@jotdown/core/components/shortcuts";
import { DocCardList } from "@jotdown/core/components/blocks/DocCardList";
import { compileInBrowser } from "@jotdown/core/lib/browser-page";
import {
  CANVAS_PROTOCOL,
  colourMode,
  fromStudio,
  isLoopback,
  type CanvasLoad,
  type FromCanvas,
} from "@jotdown/core/lib/canvas";
import { deserializeTree } from "@jotdown/core/lib/serial-tree";
import { sectionTabs } from "@jotdown/core/lib/sections";
import { Article } from "@jotdown/editor/components/Article";
import { LiveEditRoot } from "@jotdown/editor/components/LiveEditRoot";
import { EDITABLE_FIELDS, getMDXComponents } from "@jotdown/editor/components/mdx";
import { ArrangeableSidebar } from "@jotdown/editor/components/sidebar/ArrangeableSidebar";
import { sendRequestsThrough } from "@jotdown/editor/client/api";
import { canvasTransport } from "@jotdown/editor/client/canvas";
import type { LiveEditGlobalData } from "@jotdown/editor/types";
import { KitProvider, type KitSite, type LayoutProps, type ProjectBlock } from "@jotdown/kit";
import { withUnknownBlocks } from "@jotdown/core/components/blocks/UnknownBlock";
import { pageList } from "@jotdown/core/lib/page-list";
import { editableBlocks } from "@jotdown/editor/project/ProjectBlock";
import { ProjectInserts } from "@jotdown/editor/project/inserts";

type Props = {
  /** The site's logo and title, as its sidebar draws them. */
  title: ReactNode;
  /** Who this canvas belongs to, for the studio to check it framed the right site. */
  project: { title: string; repository?: string };
  /** The framework version the site was built with. */
  framework: string;
  /** The site as the project's blocks read it; where its pages are served is the studio's to say. */
  site: Omit<KitSite, "base">;
  /** The layout a page is drawn in when its front matter names none. */
  layout: string;
  /** The project's own blocks, which win over the framework's by name. */
  blocks: Record<string, ProjectBlock>;
  /** The project's own layouts, by name. */
  layouts: Record<string, ComponentType<LayoutProps>>;
};

type Drawing = Omit<Props, "project" | "framework">;

/**
 * A site's editing canvas: its own look and blocks, drawing whichever page the studio that framed it hands over.
 *
 * It holds no content of its own. It says hello to the window around it, and
 * once a studio on this machine answers, it draws the page it is sent, in the
 * site's shell with the arranging sidebar, and carries every request its editor
 * makes back to that studio. A link inside it asks the studio for the page
 * rather than leaving, and the studio's own shortcuts are handed back to it.
 * Framed by the desktop app, it lays itself out as the app's window does, and
 * a press on its title bar moves the window. The colour mode is the studio's,
 * and a mode picked on the canvas is handed up for the studio to keep. Opened
 * on its own, outside the studio, it says what it is.
 *
 * @example <Canvas title={title} project={{ title: "Notes" }} site={site} layout="docs" blocks={{ Hero }} layouts={{}} framework="0.3.0" />
 */
export function Canvas({ project, framework, ...drawing }: Props) {
  const [studio, setStudio] = useState<string | null>(null);
  const [load, setLoad] = useState<CanvasLoad | null>(null);
  const [alone, setAlone] = useState(false);
  const { theme, setTheme } = useTheme();
  const studioMode = useRef<string | null>(null);

  const followStudio = useEffectEvent((mode: string) => {
    studioMode.current = mode;
    setTheme(mode);
  });

  useEffect(() => {
    if (window.parent === window) return setAlone(true);
    let origin: string | null = null;

    function listen(event: MessageEvent) {
      if (event.source !== window.parent || !isLoopback(event.origin)) return;
      if (origin && event.origin !== origin) return;
      const message = fromStudio.safeParse(event.data);
      if (!message.success) return;

      if (!origin) {
        origin = event.origin;
        sendRequestsThrough(canvasTransport(window.parent, origin));
        document.documentElement.toggleAttribute("data-framed", true);
        setStudio(origin);
      }
      if (message.data.type === "load") setLoad(message.data);
      if (message.data.type === "theme") followStudio(message.data.mode);
      if (message.data.type === "window") document.documentElement.toggleAttribute("data-app", message.data.app);
    }

    window.addEventListener("message", listen);
    post(window.parent, "*", { type: "hello", protocol: CANVAS_PROTOCOL, framework, project });
    return () => window.removeEventListener("message", listen);
  }, [framework, project]);

  useStudioHandoffs(studio);

  useEffect(() => {
    const mode = colourMode.safeParse(theme);
    if (!studio || !studioMode.current || !mode.success || mode.data === studioMode.current) return;
    studioMode.current = mode.data;
    post(window.parent, studio, { type: "theme", mode: mode.data });
  }, [studio, theme]);

  if (alone) return <Alone title={project.title} />;
  if (!load) return null;
  return (
    <>
      <WindowTitleBar />
      <CanvasPage load={load} {...drawing} />
    </>
  );
}

/** Where a press moves the app's window: the title bar, and the contents bar that stands in it. */
const TITLE_BAR = "[data-window-drag], [data-toc-popover] > header";
const PRESSABLE = "a, button, input, textarea, select, [role='dialog']";

/**
 * Sends link clicks, the studio's own shortcuts and presses on the title bar up to the studio, once one has answered.
 *
 * The app only sees presses on its own page, so a press on the canvas's title
 * bar is handed up for the app to start moving the window, and the release
 * after it to stop.
 *
 * @example useStudioHandoffs("http://127.0.0.1:53041");
 */
function useStudioHandoffs(studio: string | null) {
  useEffect(() => {
    if (!studio) return;

    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const link = (event.target as Element | null)?.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;

      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || (url.hash && url.pathname === location.pathname)) return;
      event.preventDefault();
      post(window.parent, studio as string, { type: "navigate", url: url.pathname + url.hash });
    }

    function key(event: KeyboardEvent) {
      if (!pressed(event, SHORTCUTS.switcher)) return;
      event.preventDefault();
      post(window.parent, studio as string, {
        type: "shortcut",
        key: event.code,
        meta: event.metaKey,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
      });
    }

    let dragging = false;

    function press(event: MouseEvent) {
      const target = event.target as Element | null;
      if (event.button !== 0 || !document.documentElement.hasAttribute("data-app")) return;
      if (!target?.closest(TITLE_BAR) || target.closest(PRESSABLE)) return;
      dragging = true;
      post(window.parent, studio as string, { type: "drag", phase: "start" });
    }

    function release() {
      if (!dragging) return;
      dragging = false;
      post(window.parent, studio as string, { type: "drag", phase: "end" });
    }

    document.addEventListener("click", click, true);
    document.addEventListener("mousedown", press, true);
    window.addEventListener("mouseup", release, true);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("mousedown", press, true);
      window.removeEventListener("mouseup", release, true);
      window.removeEventListener("keydown", key);
    };
  }, [studio]);
}

/**
 * One loaded page: compiled here from its text, in the layout it asks for, editable where the studio allows.
 *
 * The page that was showing stays up while the next one compiles, so moving
 * between pages never flashes an empty canvas. The project's own blocks are
 * drawn by their components and edited from inside, and a tag nobody draws
 * gets a labelled stand-in rather than stopping the page.
 */
function CanvasPage({ load, title, site, layout, blocks, layouts }: { load: CanvasLoad } & Drawing) {
  const config = load.config as LiveEditGlobalData;
  const tree = useMemo(() => deserializeTree(load.tree), [load.tree]);
  const names = useMemo(() => Object.keys(blocks), [blocks]);
  const ownBlocks = useMemo(() => editableBlocks(blocks), [blocks]);
  const compiled = useQuery({
    queryKey: ["canvas", "page", load.text, names],
    queryFn: () => compileInBrowser(load.text, names),
    placeholderData: (previous) => previous,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const page = compiled.data;
  const front = page && !("problem" in page) ? page.data : null;

  const components = useMemo(
    () =>
      withUnknownBlocks(
        {
          ...getMDXComponents({
            DocCardList: (props: { title?: string }) => (
              <DocCardList tree={tree} url={load.url} root={load.url === (config.base || "/")} {...props} />
            ),
          }),
          ...ownBlocks,
        },
        load.text,
      ),
    [tree, load.url, load.text, config.base, ownBlocks],
  );

  const framework = useMemo(
    () => ({
      Link: SiteLink,
      usePathname: () => load.url,
      useParams: () => ({}),
      useRouter: () => ({ push: () => {}, refresh: () => {} }),
    }),
    [load.url],
  );

  const kit = useMemo(
    () => ({
      page: {
        title: front?.title ?? load.target.title,
        description: front?.description,
        url: load.url,
        data: { icon: front?.icon, full: front?.full, layout: front?.layout },
      },
      site: { ...site, base: config.base },
      pages: pageList(tree),
    }),
    [front, load.target.title, load.url, site, config.base, tree],
  );

  const named = front?.layout ?? layout;
  const Layout = layouts[named];
  const body = !page ? null : "problem" in page ? (
    <Problem>{page.problem}</Problem>
  ) : (
    <page.body components={components} />
  );
  const article = (children: ReactNode) => (
    <Article source={load.target.generated ? null : load.text} target={load.target}>
      {children}
    </Article>
  );

  return (
    <FrameworkProvider {...framework}>
      <KitProvider {...kit}>
        <ProjectInserts blocks={blocks}>
          <LiveEditRoot config={config}>
            {named === "docs" || !front ? (
              <DocsShell
                tree={tree}
                tabs={sectionTabs(tree, config.base)}
                title={title}
                base={config.base}
                sidebar={ArrangeableSidebar}
                footer={<SidebarFooter />}
              >
                <TitleBarControls />
                {!page ? null : "problem" in page ? (
                  <DocsPage breadcrumb={false} footer={false}>
                    <DocsTitle>{load.target.title}</DocsTitle>
                    <DocsBody>{body}</DocsBody>
                  </DocsPage>
                ) : (
                  <DocsPage toc={page.toc} full={page.data.full}>
                    {article(
                      <PageContent
                        title={page.data.title}
                        description={page.data.description}
                        icon={page.data.icon}
                        generated={load.target.generated}
                        editable={config.editable && !load.target.generated}
                        fields={EDITABLE_FIELDS}
                      >
                        {body}
                      </PageContent>,
                    )}
                  </DocsPage>
                )}
              </DocsShell>
            ) : named === "blank" ? (
              article(<main className="prose max-w-none">{body}</main>)
            ) : Layout ? (
              article(
                <Layout page={kit.page} site={kit.site}>
                  {body}
                </Layout>,
              )
            ) : (
              <main className="p-8">
                <Problem>{`This page asks for the layout "${named}", which is neither docs, blank nor one of .jotdown/layouts.`}</Problem>
              </main>
            )}
          </LiveEditRoot>
        </ProjectInserts>
      </KitProvider>
    </FrameworkProvider>
  );
}

/** Why the page cannot be drawn, where its content would be. */
function Problem({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="font-mono text-destructive text-sm">
      {children}
    </p>
  );
}

/** What the canvas says when it is opened on its own rather than inside the studio. */
function Alone({ title }: { title: string }) {
  return (
    <main className="grid min-h-dvh place-items-center p-8 text-center">
      <div className="max-w-sm">
        <h1 className="font-medium text-lg">The editing canvas of {title}</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          This page only draws something inside Jotdown, which edits the site through it. Readers never see it.
        </p>
      </div>
    </main>
  );
}

/** Posts one message to the studio. */
function post(target: Window, origin: string, message: FromCanvas) {
  target.postMessage(message, origin);
}
