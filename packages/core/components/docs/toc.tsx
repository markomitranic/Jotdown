"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "cn";
import { ChevronDown, Text } from "lucide-react";
import { Collapsible } from "radix-ui";
import * as Primitive from "fumadocs-core/toc";
import { CollapsibleContent } from "./collapsible";
import { useTreePath } from "./tree";

/**
 * The page's table of contents: a rail beside the article on a wide screen, a dropdown above it otherwise.
 *
 * The rail draws a line through the headings that bends with their depth, and
 * lights the stretch of it beside the headings in view. Adapted from Fumadocs
 * UI, MIT.
 */

const ItemsContext = createContext<Primitive.TableOfContents>([]);

/**
 * The page's headings, as the table of contents lists them.
 *
 * @example useTOCItems().length; // 6
 */
export function useTOCItems() {
  return use(ItemsContext);
}

/**
 * Tracks which of the page's headings are in view.
 *
 * @example <TOCProvider toc={toc}>{page}</TOCProvider>
 */
export function TOCProvider({ toc, children }: { toc: Primitive.TableOfContents; children: ReactNode }) {
  return (
    <ItemsContext value={toc}>
      <Primitive.AnchorProvider toc={toc}>{children}</Primitive.AnchorProvider>
    </ItemsContext>
  );
}

/**
 * The rail beside the article, from the `xl` breakpoint up, or an empty column holder for a page with no headings.
 *
 * @example <TOC />
 */
export function TOC() {
  const items = useTOCItems();

  if (items.length === 0) return <div id="jd-toc-placeholder" className="hidden xl:layout:[--jd-toc-width:268px]" />;

  return (
    <div
      id="jd-toc"
      className="sticky top-(--jd-docs-row-1) flex h-[calc(var(--jd-docs-height)-var(--jd-docs-row-1))] w-(--jd-toc-width) flex-col pe-4 pt-12 pb-2 [grid-area:toc] max-xl:hidden xl:layout:[--jd-toc-width:268px]"
    >
      <h3 id="toc-title" className="inline-flex items-center gap-1.5 text-muted-foreground text-sm">
        <Text className="size-4" />
        On this page
      </h3>
      <TOCScrollArea>
        <TOCItems>
          {items.map((item) => (
            <TOCItem key={item.url} item={item} />
          ))}
        </TOCItems>
      </TOCScrollArea>
    </div>
  );
}

/** A scrolling list that keeps the active heading in view and fades at its edges. */
function TOCScrollArea({ children }: { children: ReactNode }) {
  const view = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={view}
      className="mask-[linear-gradient(to_bottom,transparent,white_16px,white_calc(100%-16px),transparent)] relative ms-px min-h-0 overflow-auto overscroll-contain py-3 text-sm [scrollbar-width:none]"
    >
      <Primitive.ScrollProvider containerRef={view}>{children}</Primitive.ScrollProvider>
    </div>
  );
}

const PopoverContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

/**
 * The table of contents as a dropdown pinned above the article, below the `xl` breakpoint.
 *
 * Its closed row names the heading being read and fills a ring as the reader goes down the page.
 *
 * @example <TOCPopover />
 */
export function TOCPopover() {
  const items = useTOCItems();
  const header = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  const onClickOutside = useEffectEvent((event: MouseEvent) => {
    if (!open || !(event.target instanceof HTMLElement)) return;
    if (header.current && !header.current.contains(event.target)) setOpen(false);
  });

  useEffect(() => {
    window.addEventListener("click", onClickOutside);
    return () => window.removeEventListener("click", onClickOutside);
  }, []);

  return (
    <PopoverContext value={useMemo(() => ({ open, setOpen }), [open])}>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        data-toc-popover=""
        className="sticky top-(--jd-docs-row-2) z-10 h-(--jd-toc-popover-height) [grid-area:toc-popover] xl:hidden max-xl:layout:[--jd-toc-popover-height:--spacing(10)]"
      >
        <header
          ref={header}
          className={cn("border-b bg-background/80 backdrop-blur-sm transition-colors", open && "shadow-lg")}
        >
          <PopoverTrigger />
          <CollapsibleContent data-toc-popover-content="">
            <div className="flex max-h-[50vh] flex-col px-4 md:px-6">
              <TOCScrollArea>
                <TOCItems>
                  {items.map((item) => (
                    <TOCItem key={item.url} item={item} onClick={() => setOpen(false)} />
                  ))}
                </TOCItems>
              </TOCScrollArea>
            </div>
          </CollapsibleContent>
        </header>
      </Collapsible.Root>
    </PopoverContext>
  );
}

function PopoverTrigger() {
  const popover = use(PopoverContext);
  const items = Primitive.useItems();
  const page = useTreePath().at(-1);
  const open = popover?.open ?? false;
  const selected = items.findIndex((item) => item.active);
  const showItem = selected !== -1 && !open;

  return (
    <Collapsible.Trigger
      data-toc-popover-trigger=""
      className="flex h-10 w-full items-center gap-2.5 px-4 py-2.5 text-start text-muted-foreground text-sm focus-visible:outline-none md:px-6 [&_svg]:size-4"
    >
      <ProgressCircle
        value={(items.findLastIndex((item) => item.active) + 1) / Math.max(1, items.length)}
        className={cn("shrink-0", open && "text-primary")}
      />
      <span className="grid flex-1 *:col-start-1 *:row-start-1 *:my-auto">
        <span
          className={cn(
            "truncate transition-[opacity,translate,color]",
            open && "text-foreground",
            showItem && "pointer-events-none -translate-y-full opacity-0",
          )}
        >
          {page?.name ?? "On this page"}
        </span>
        <span
          className={cn(
            "truncate transition-[opacity,translate]",
            !showItem && "pointer-events-none translate-y-full opacity-0",
          )}
        >
          {items[selected]?.original.title}
        </span>
      </span>
      <ChevronDown className={cn("mx-0.5 shrink-0 transition-transform", open && "rotate-180")} />
    </Collapsible.Trigger>
  );
}

/**
 * A ring that fills as far as the reader has come, from 0 to 1.
 *
 * @example <ProgressCircle value={0.4} />
 */
function ProgressCircle({ value, className }: { value: number; className?: string }) {
  const size = 18;
  const stroke = 1.5;
  const radius = size / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(value, 0), 1) * circumference;
  const circle = { cx: size / 2, cy: size / 2, r: radius, fill: "none", strokeWidth: stroke };

  return (
    <svg
      role="progressbar"
      viewBox={`0 0 ${size} ${size}`}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={1}
      style={{ width: size, height: size }}
      className={className}
    >
      <circle {...circle} className="stroke-current/25" />
      <circle
        {...circle}
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all"
      />
    </svg>
  );
}

type Track = {
  content: ReactNode[];
  width: number;
  height: number;
  d: string;
  spans: [number, number][];
  positions: [number, number, number][];
};

/**
 * The list of headings and the lit line beside it, redrawn whenever the list changes size.
 *
 * @example <TOCItems>{rows}</TOCItems>
 */
function TOCItems({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const items = useTOCItems();
  const [track, setTrack] = useState<Track | null>(null);

  const draw = useCallback(() => {
    const list = container.current;
    if (!list || list.clientHeight === 0) return;
    if (items.length === 0) return setTrack(null);

    let width = 0;
    let height = 0;
    let d = "";
    const positions: [number, number, number][] = [];
    const content: ReactNode[] = [];

    items.forEach((item) => {
      const element = list.querySelector<HTMLElement>(`a[href="${item.url}"]`);
      if (!element) return;

      const styles = getComputedStyle(element);
      const x = lineOffset(item.depth) + 0.5;
      const top = element.offsetTop + Number.parseFloat(styles.paddingTop);
      const bottom = element.offsetTop + element.clientHeight - Number.parseFloat(styles.paddingBottom);
      width = Math.max(x + 8, width);
      height = Math.max(height, bottom);

      const above = positions.at(-1);
      d += above
        ? ` C ${above[2]} ${top - 4} ${x} ${above[1] + 4} ${x} ${top} L${x} ${bottom}`
        : ` M${x} ${top} L${x} ${bottom}`;

      if (item._step !== undefined)
        content.push(
          <g key={item.url} transform={`translate(${x}, ${(top + bottom) / 2})`}>
            <circle cx="0" cy="0" r="8" className="fill-primary" />
            <text
              textAnchor="middle"
              alignmentBaseline="central"
              dominantBaseline="middle"
              className="fill-primary-foreground font-medium font-mono text-xs leading-none rtl:-scale-x-100"
            >
              {item._step}
            </text>
          </g>,
        );
      positions.push([top, bottom, x]);
    });

    content.unshift(<path key="path" d={d} className="stroke-primary" strokeWidth="1" fill="none" />);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    const length = path.getTotalLength();
    const spans: [number, number][] = [];
    positions.forEach(([top, bottom], index) => {
      const previous = spans[index - 1];
      let at = previous ? previous[1] + (top - (positions[index - 1]?.[1] ?? 0)) : top;
      while (at < length && path.getPointAtLength(at).y < top) at++;
      spans.push([at, at + bottom - top]);
    });

    setTrack({ content, width, height, d, spans, positions });
  }, [items]);

  useEffect(() => {
    const list = container.current;
    if (!list) return;
    const observer = new ResizeObserver(draw);
    observer.observe(list);
    draw();
    return () => observer.disconnect();
  }, [draw]);

  return (
    <div ref={container} className="relative flex flex-col">
      {track && <ThumbTrack track={track} />}
      {children}
    </div>
  );
}

/** The lit stretch of the line, and the dot that rides along it as the reader scrolls. */
function ThumbTrack({ track }: { track: Track }) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<{ start: number; end: number; up: boolean } | null>(null);
  const toc = Primitive.useTOC();

  function measure(items: Primitive.TOCItemInfo[]) {
    const style: Record<string, string> = {};
    const start = items.findIndex((item) => item.active);
    if (start === -1) return style;
    const end = items.findLastIndex((item) => item.active);

    style["--track-top"] = `${track.positions[start]?.[0] ?? 0}px`;
    style["--track-bottom"] = `${track.positions[end]?.[1] ?? 0}px`;

    const last = previous.current;
    const up = last
      ? last.start > start || last.end > end || (last.start === start && last.end === end && last.up)
      : false;
    previous.current = { start, end, up };

    style["--offset-distance"] = `${up ? (track.spans[start]?.[0] ?? 0) : (track.spans[end]?.[1] ?? 0)}px`;
    style["--opacity"] = items[up ? start : end]?.original._step !== undefined ? "0" : "1";
    return style;
  }

  Primitive.useTOCListener((items) => {
    const element = ref.current;
    if (!element) return;
    for (const [name, value] of Object.entries(measure(items))) element.style.setProperty(name, value);
  });

  return (
    <div
      ref={ref}
      className="absolute inset-s-0 top-0 origin-center rtl:-scale-x-100"
      style={{ width: track.width, height: track.height, ...measure(toc.get()) } as CSSProperties}
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${track.width} ${track.height}`}
        className="absolute transition-[clip-path]"
        style={{
          width: track.width,
          height: track.height,
          clipPath:
            "polygon(0 var(--track-top,0), 100% var(--track-top,0), 100% var(--track-bottom,0), 0 var(--track-bottom,0))",
        }}
      >
        {track.content}
      </svg>
      <div
        className="absolute left-0 size-1 rounded-full bg-primary opacity-(--opacity,0) transition-[opacity,offset-distance] [offset-distance:var(--offset-distance,0)]"
        style={{ offsetPath: `path("${track.d}")` }}
      />
    </div>
  );
}

function itemOffset(depth: number) {
  if (depth <= 2) return 20;
  if (depth === 3) return 32;
  return 44;
}

function lineOffset(depth: number) {
  if (depth <= 2) return 8;
  if (depth === 3) return 16;
  return 24;
}

type ItemProps = ComponentProps<"a"> & { item: Primitive.TableOfContents[number] };

/**
 * One heading of the list, with its piece of the grey line and the bend down to the next heading's depth.
 *
 * @example <TOCItem item={{ title: "Install", url: "#install", depth: 2 }} />
 */
function TOCItem({ item, className, style, ...props }: ItemProps) {
  const items = useTOCItems();
  const index = items.indexOf(item);
  const first = index === 0;
  const last = index === items.length - 1;

  const line = useMemo(() => {
    const here = lineOffset(item.depth);
    const above = first ? here : lineOffset(items[index - 1]?.depth ?? item.depth);
    const below = last ? here : lineOffset(items[index + 1]?.depth ?? item.depth);

    return (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "absolute inset-s-0 -top-1.5 bottom-0 -z-1 h-[calc(100%+--spacing(1.5))] rtl:-scale-x-100",
          here !== below && "bottom-1.5 h-full",
        )}
        style={{ width: Math.max(above, here) + 9 }}
      >
        {above !== here && (
          <path
            d={`M ${above + 0.5} 0 C ${above + 0.5} 8 ${here + 0.5} 4 ${here + 0.5} 12`}
            stroke="black"
            strokeWidth="1"
            fill="none"
            className="stroke-foreground/10"
          />
        )}
        <line
          x1={here + 0.5}
          y1={above === here ? "6" : "12"}
          x2={here + 0.5}
          y2="100%"
          strokeWidth="1"
          className="stroke-foreground/10"
        />
        {item._step !== undefined && (
          <g transform={`translate(${here + 0.5}, ${here === below ? "3" : "6"})`}>
            <circle cx="0" cy="50%" r="8" className="fill-muted" />
            <text
              x="0"
              y="50%"
              textAnchor="middle"
              alignmentBaseline="central"
              dominantBaseline="middle"
              className="fill-muted-foreground font-medium font-mono text-xs leading-none rtl:-scale-x-100"
            >
              {item._step}
            </text>
          </g>
        )}
      </svg>
    );
  }, [items, item, index, first, last]);

  return (
    <Primitive.TOCItem
      href={item.url}
      {...props}
      className={cn(
        "prose wrap-anywhere relative scroll-m-4 py-1.5 text-muted-foreground text-sm transition-colors hover:text-accent-foreground data-[active=true]:text-primary",
        first && "pt-0",
        last && "pb-0",
        className,
      )}
      style={{ paddingInlineStart: itemOffset(item.depth), ...style }}
    >
      {line}
      {item.title}
    </Primitive.TOCItem>
  );
}
