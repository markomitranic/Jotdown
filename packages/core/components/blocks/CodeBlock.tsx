"use client";

import {
  createContext,
  use,
  useRef,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "cn";
import { Check, Clipboard } from "lucide-react";
import { Tabs } from "radix-ui";
import { chromeButton } from "@jotdown/core/components/docs/button";
import { useCopyButton } from "@jotdown/core/lib/use-copy-button";

/**
 * A highlighted code block: a framed figure with a copy button, a caption bar when it has a title, and tabs for fences written side by side.
 *
 * Adapted from Fumadocs UI, MIT.
 */

const InTabs = createContext(false);

/**
 * The `pre` inside a code block, as wide as its longest line.
 *
 * @example <Pre>{lines}</Pre>
 */
export function Pre({ className, ...props }: ComponentProps<"pre">) {
  return <pre {...props} className={cn("w-max min-w-full *:flex *:flex-col", className)} />;
}

type CodeBlockProps = Omit<ComponentProps<"figure">, "title"> & {
  title?: ReactNode;
  icon?: ReactNode;
  allowCopy?: boolean;
  keepBackground?: boolean;
  "data-line-numbers"?: boolean;
  "data-line-numbers-start"?: number;
};

/**
 * The frame around a highlighted fence.
 *
 * @example <CodeBlock title="install.sh"><Pre>…</Pre></CodeBlock>
 */
export function CodeBlock({
  title,
  icon,
  allowCopy = true,
  keepBackground = false,
  className,
  children,
  ...props
}: CodeBlockProps) {
  const inTabs = use(InTabs);
  const area = useRef<HTMLDivElement>(null);
  const copy = allowCopy && <CopyButton area={area} />;

  return (
    <figure
      dir="ltr"
      {...props}
      tabIndex={-1}
      className={cn(
        inTabs ? "-mx-px -mb-px bg-secondary last:rounded-b-xl" : "my-4 rounded-xl bg-card",
        keepBackground && "bg-(--shiki-light-bg) dark:bg-(--shiki-dark-bg)",
        "shiki not-prose relative overflow-hidden border text-sm shadow-sm",
        className,
      )}
    >
      {title ? (
        <div className="flex h-9.5 items-center gap-2 border-b px-4 text-muted-foreground">
          {typeof icon === "string" ? (
            // biome-ignore lint/security/noDangerouslySetInnerHtml: the icon is an SVG the highlighter generated at build time
            <div className="[&_svg]:size-3.5" dangerouslySetInnerHTML={{ __html: icon }} />
          ) : (
            icon
          )}
          <figcaption className="flex-1 truncate">{title}</figcaption>
          {copy && <div className="-me-2 empty:hidden">{copy}</div>}
        </div>
      ) : (
        copy && (
          <div className="absolute top-3 right-2 z-2 rounded-lg text-muted-foreground backdrop-blur-lg empty:hidden">
            {copy}
          </div>
        )
      )}
      <div
        ref={area}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a keyboard scrolls a wide fence only once it can focus it
        tabIndex={0}
        className="jd-scroll-container max-h-[600px] overflow-auto py-3.5 text-[0.8125rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        style={
          {
            "--padding-right": title ? undefined : "calc(var(--spacing) * 8)",
            counterSet: props["data-line-numbers"]
              ? `line ${Number(props["data-line-numbers-start"] ?? 1) - 1}`
              : undefined,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </figure>
  );
}

/** Copies the block's code, without the lines a diff marks for removal. */
function CopyButton({ area }: { area: RefObject<HTMLDivElement | null> }) {
  const [checked, copy] = useCopyButton(() => {
    const pre = area.current?.getElementsByTagName("pre").item(0);
    if (!pre) return;
    const clone = pre.cloneNode(true) as HTMLElement;
    for (const ignored of clone.querySelectorAll(".nd-copy-ignore")) ignored.replaceWith("\n");
    return navigator.clipboard.writeText(clone.textContent ?? "");
  });

  return (
    <button
      type="button"
      data-checked={checked || undefined}
      aria-live="polite"
      onClick={copy}
      className={chromeButton({
        size: "icon-xs",
        className: "hover:text-accent-foreground data-checked:text-accent-foreground",
      })}
    >
      {checked ? <Check /> : <Clipboard />}
      <span className="sr-only">{checked ? "Copied text" : "Copy text"}</span>
    </button>
  );
}

/**
 * Fences written side by side with `tab="…"`, drawn as one block with a tab per fence.
 *
 * @example <CodeBlockTabs defaultValue="bun">…</CodeBlockTabs>
 */
export function CodeBlockTabs({ className, ...props }: ComponentProps<typeof Tabs.Root>) {
  const nested = use(InTabs);

  return (
    <InTabs value>
      <Tabs.Root {...props} className={cn("rounded-xl border bg-card", !nested && "my-4", className)} />
    </InTabs>
  );
}

/** The row of tab titles. */
export function CodeBlockTabsList({ className, ...props }: ComponentProps<typeof Tabs.List>) {
  return <Tabs.List {...props} className={cn("flex flex-row overflow-x-auto px-2 text-muted-foreground", className)} />;
}

/** One tab title, underlined while its tab is open. */
export function CodeBlockTabsTrigger({ className, children, ...props }: ComponentProps<typeof Tabs.Trigger>) {
  return (
    <Tabs.Trigger
      {...props}
      className={cn(
        "group relative inline-flex items-center gap-2 text-nowrap px-2 py-1.5 font-medium text-sm transition-colors hover:text-accent-foreground data-[state=active]:text-primary [&_svg]:size-3.5",
        className,
      )}
    >
      <div className="absolute inset-x-2 bottom-0 h-px group-data-[state=active]:bg-primary" />
      {children}
    </Tabs.Trigger>
  );
}

/** One tab's fence. */
export function CodeBlockTab(props: ComponentProps<typeof Tabs.Content>) {
  return <Tabs.Content {...props} />;
}
