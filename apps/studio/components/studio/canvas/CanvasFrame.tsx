"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff, FileQuestion, History, Unplug } from "lucide-react";
import { fetchJson, postJson } from "@jotdown/core/lib/fetch-json";
import {
  CANVAS_PROTOCOL,
  colourMode,
  fromCanvas,
  type CanvasHello,
  type CanvasLoad,
  type FromStudio,
} from "@jotdown/core/lib/canvas";
import { Button } from "@jotdown/core/components/ui/button";
import { useDraftTheme } from "../settings/LiveTheme";

type Props = {
  /** The canvas's address, `<site>/_edit` or one of your own. */
  src: string;
  /** The open project: its key, where its pages are served, and who it is, to check the canvas is its own. */
  project: { key: string; base: string; title: string; repository?: string };
};

/** Why a canvas cannot be used, each with what to do about it. */
export type Dead =
  | { kind: "unreachable" }
  | { kind: "not-canvas" }
  | { kind: "too-old"; framework: string }
  | { kind: "too-new"; framework: string }
  | { kind: "wrong-project"; serving: string };

/** How long a canvas has to say hello before the studio gives up on it. */
const PATIENCE = 12_000;

/**
 * The project drawn by its site: the site's `/_edit` canvas framed, and fed the page the studio's address names.
 *
 * The canvas says hello, the studio checks it speaks this protocol and belongs
 * to this project, and from then on it hands the canvas each page as the
 * address changes and answers every request the canvas's editor makes from its
 * own editing endpoints, so a save from the canvas is a save like any other,
 * after which the page is fetched and handed over again.
 * A canvas that never answers, answers wrongly or belongs elsewhere gets a
 * page that says so and how to fix it, with the studio's own drawing a click
 * away.
 *
 * @example <CanvasFrame src="https://notes.example.com/_edit" project={{ key: "you/notes", base: "/you/notes", title: "Notes" }} />
 */
export function CanvasFrame({ src, project }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [hello, setHello] = useState<CanvasHello | null>(null);
  const [dead, setDead] = useState<Dead | null>(null);
  const greeted = useRef(false);
  const origin = new URL(src).origin;
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const draftTheme = useDraftTheme();
  const queries = useQueryClient();

  const slug = pathname.startsWith(project.base) ? pathname.slice(project.base.length).replace(/^\//, "") : "";
  const page = useQuery({
    queryKey: ["canvas", "load", project.key, slug],
    queryFn: () => fetchJson<CanvasLoad>(`/api/canvas?${new URLSearchParams({ key: project.key, slug })}`),
    enabled: hello !== null,
  });

  function post(message: FromStudio) {
    frame.current?.contentWindow?.postMessage(message, origin);
  }

  const onMessage = useEffectEvent(async (event: MessageEvent) => {
    if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
    const message = fromCanvas.safeParse(event.data);
    if (!message.success) return;
    const { data } = message;

    if (data.type === "hello") {
      greeted.current = true;
      setHello(data);
      setDead(judge(data, project));
      return;
    }
    if (data.type === "navigate") return router.push(data.url);
    if (data.type === "theme") return setTheme(data.mode);
    if (data.type === "drag") return moveWindow(data.phase);
    if (data.type === "shortcut")
      return window.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: data.key,
          metaKey: data.meta,
          ctrlKey: data.ctrl,
          shiftKey: data.shift,
          altKey: data.alt,
          bubbles: true,
        }),
      );
    if (data.type !== "request") return;
    const answered = await answer(data.url, data.method, data.headers, data.body, data.id);
    post(answered);
    if (data.method !== "GET" && answered.status < 300)
      await queries.invalidateQueries({ queryKey: ["canvas", "load"] });
  });

  useEffect(() => {
    const listen = (event: MessageEvent) => void onMessage(event);
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt is a new frame, so the wait starts over
  useEffect(() => {
    greeted.current = false;
    setHello(null);
    setDead(null);
    setLoaded(false);
    const giveUp = setTimeout(() => {
      if (!greeted.current) setDead({ kind: "unreachable" });
    }, PATIENCE);
    return () => clearTimeout(giveUp);
  }, [attempt, src]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the page is sent again whenever it or the canvas changes
  useEffect(() => {
    if (hello && !dead && page.data) post(page.data);
  }, [hello, dead, page.data]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the mode is sent again whenever it or the canvas changes
  useEffect(() => {
    const mode = colourMode.safeParse(theme);
    if (hello && mode.success) post({ type: "theme", mode: mode.data });
  }, [hello, theme]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the draft theme is sent again whenever it or the canvas changes
  useEffect(() => {
    if (hello) post({ type: "look", theme: draftTheme });
  }, [hello, JSON.stringify(draftTheme)]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a canvas learns once, as it says hello, whether the app frames it
  useEffect(() => {
    if (hello) post({ type: "window", app: document.documentElement.hasAttribute("data-app") });
  }, [hello]);

  return (
    <div className="relative min-h-0 flex-1">
      <iframe
        key={attempt}
        ref={frame}
        src={src}
        title={`${project.title}, drawn by its site`}
        onLoad={() => setLoaded(true)}
        className={`size-full border-0 bg-background transition-opacity ${hello && !dead ? "opacity-100" : "opacity-0"}`}
      />
      {!hello && !dead && <Waiting />}
      {dead && (
        <DeadCanvas
          dead={dead.kind === "unreachable" && loaded ? { kind: "not-canvas" } : dead}
          src={src}
          project={project}
          onRetry={() => setAttempt((count) => count + 1)}
        />
      )}
      {page.error && hello && !dead && (
        <p
          role="alert"
          className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-md bg-popover px-3 py-2 text-sm shadow-lg ring-1 ring-foreground/10"
        >
          {page.error.message}
        </p>
      )}
    </div>
  );
}

/**
 * Whether a canvas that said hello can be used: the protocol this studio speaks, and this project.
 *
 * @example judge({ protocol: 0, … }, project); // { kind: "too-old", framework: "0.1.0" }
 */
function judge(hello: CanvasHello, project: Props["project"]): Dead | null {
  if (hello.protocol < CANVAS_PROTOCOL) return { kind: "too-old", framework: hello.framework };
  if (hello.protocol > CANVAS_PROTOCOL) return { kind: "too-new", framework: hello.framework };

  const theirs = hello.project.repository?.toLowerCase().replace(/\.git$/, "");
  const ours = project.repository?.toLowerCase().replace(/\.git$/, "");
  const same = theirs && ours ? theirs === ours : hello.project.title === project.title;
  return same ? null : { kind: "wrong-project", serving: hello.project.title };
}

/**
 * Starts or stops moving the app's window, for a press on the canvas's title bar.
 *
 * The app moves its window for a press on its own page's title bar, and never
 * sees one inside a frame, so the press is played again on the page, on a
 * stand-in the app takes for its title bar. In a browser nothing listens.
 *
 * @example moveWindow("start");
 */
function moveWindow(phase: "start" | "end") {
  const titleBar = document.createElement("div");
  titleBar.className = "electrobun-webkit-app-region-drag";
  titleBar.hidden = true;
  document.body.append(titleBar);
  titleBar.dispatchEvent(new MouseEvent(phase === "start" ? "mousedown" : "mouseup", { bubbles: true }));
  titleBar.remove();
}

/** The editing endpoints a canvas may reach, and nothing else in the studio. */
const ALLOWED = [/^\/api\/projects\/[^/]+\/live-edit\//, /^\/api\/link-preview\?/];

/**
 * One request the canvas made, answered from the studio's own endpoint, as the message that carries the answer back.
 *
 * @example await answer("/api/projects/abc/live-edit/save", "POST", {}, body, "1"); // { type: "response", id: "1", status: 200, body: { … } }
 */
async function answer(url: string, method: string, headers: Record<string, string>, body: unknown, id: string) {
  const path = new URL(url, location.origin);
  if (path.origin !== location.origin || !ALLOWED.some((allowed) => allowed.test(path.pathname + path.search)))
    return {
      type: "response",
      id,
      status: 403,
      body: { error: "The canvas may only reach the editing service." },
    } as const;

  const response = await fetch(path, { method, headers, body: body as BodyInit | undefined }).catch(() => null);
  if (!response)
    return { type: "response", id, status: 0, body: { error: "The studio could not be reached." } } as const;
  return { type: "response", id, status: response.status, body: await response.json().catch(() => null) } as const;
}

/** The empty frame while a canvas loads, quiet for a moment before it says anything. */
function Waiting() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <p className="animate-[fade-in_300ms_ease_1s_both] text-muted-foreground text-sm">Opening the site's canvas</p>
    </div>
  );
}

type DeadProps = { dead: Dead; src: string; project: Props["project"]; onRetry: () => void };

/**
 * The page shown in place of a canvas that cannot be used: what happened, how to fix it, and the way out.
 *
 * @example <DeadCanvas dead={{ kind: "unreachable" }} src="https://notes.example.com/_edit" project={project} onRetry={retry} />
 */
export function DeadCanvas({ dead, src, project, onRetry }: DeadProps) {
  const router = useRouter();
  const skinny = useMutation({
    mutationFn: () => postJson("/api/projects/renderer", { key: project.key, renderer: { mode: "skinny" } }),
    onSuccess: () => router.refresh(),
  });
  const host = new URL(src).host;
  const told = TOLD[dead.kind](dead, host, project.title);

  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-background p-8">
      <div role="alert" className="w-full max-w-md">
        <span className="grid size-10 place-items-center rounded-lg bg-secondary text-muted-foreground">
          {told.icon}
        </span>
        <h2 className="mt-4 font-medium text-lg">{told.title}</h2>
        <p className="mt-1.5 text-muted-foreground text-sm">{told.why}</p>
        <ol className="mt-4 list-decimal space-y-1.5 ps-5 text-sm">
          {told.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => skinny.mutate()} disabled={skinny.isPending}>
            Open in Skinny
          </Button>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

type Told = { icon: ReactNode; title: string; why: string; steps: string[] };

const TOLD: Record<Dead["kind"], (dead: Dead, host: string, title: string) => Told> = {
  unreachable: (_, host) => ({
    icon: <CloudOff className="size-5" />,
    title: `Nothing answered at ${host}`,
    why: "The site's canvas did not load, so the studio has nothing to draw the project with.",
    steps: [
      "Check the site is deployed and opens in a browser.",
      "For a dev server, check it is running and serves /_edit.",
      "Check the url in the project's config, or the custom address you chose.",
    ],
  }),
  "not-canvas": (_, host) => ({
    icon: <FileQuestion className="size-5" />,
    title: `${host} is not a Jotdown canvas`,
    why: "A page loaded, but it never said it was a canvas. The site may be built with something other than Jotdown, or the address may be wrong.",
    steps: ["Build the site with Jotdown, which writes /_edit into every build.", "Check the address ends in /_edit."],
  }),
  "too-old": (dead) => ({
    icon: <History className="size-5" />,
    title: "The site was built with an older Jotdown",
    why: `Its canvas was built with Jotdown ${"framework" in dead ? dead.framework : ""}, which speaks an earlier version of the studio's protocol.`,
    steps: ["Pin a newer Jotdown in the project's config, or leave it on main.", "Push, and let the site build again."],
  }),
  "too-new": (dead) => ({
    icon: <History className="size-5" />,
    title: "The site was built with a newer Jotdown",
    why: `Its canvas was built with Jotdown ${"framework" in dead ? dead.framework : ""}, which this studio is too old to talk to.`,
    steps: ["Update the Jotdown app."],
  }),
  "wrong-project": (dead, host, title) => ({
    icon: <Unplug className="size-5" />,
    title: `${host} is serving ${"serving" in dead ? dead.serving : "another project"}, not ${title}`,
    why: "The canvas belongs to another project, so its pages and look are not this one's.",
    steps: ["Check the url in this project's config.", "For a dev server, start it in this project's folder."],
  }),
};
