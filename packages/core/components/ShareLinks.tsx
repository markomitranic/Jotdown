"use client";

import type { ReactNode } from "react";
import { useCopyButton } from "@jotdown/core/lib/use-copy-button";
import { Check, Copy } from "lucide-react";

/** One address: its name and audience on a line, the field beneath. */
export function ShareLink({
  icon,
  label,
  audience,
  children,
}: {
  icon: ReactNode;
  label: string;
  audience: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
        {icon}
        <h3 className="font-medium">{label}</h3>
        <span className="ms-auto truncate text-muted-foreground text-xs">{audience}</span>
      </header>
      {children}
    </section>
  );
}

/**
 * A read-only address or file path that copies itself: the whole field is the button.
 *
 * The host, or a path's first folder, reads first and the rest dims after it.
 * A long rest gives way at its start, so the page's own name stays in sight.
 */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, copy] = useCopyButton(() => navigator.clipboard.writeText(value));
  const { host, rest } = value.includes("://") ? splitAddress(value) : splitPath(value);

  return (
    <button
      type="button"
      aria-label={label}
      title={value}
      onClick={copy}
      className="group flex h-10 w-full min-w-0 items-center gap-3 rounded-lg border border-border bg-card ps-3 pe-1 text-start outline-none transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <span className="flex min-w-0 flex-1 font-mono text-xs">
        <span className="shrink-0 text-foreground">{host}</span>
        <span dir="rtl" className="min-w-0 truncate text-muted-foreground">
          <bdi dir="ltr">{rest}</bdi>
        </span>
      </span>
      <span
        data-copied={copied || undefined}
        className="flex h-8 w-20 shrink-0 items-center justify-center gap-1.5 rounded-md font-medium text-muted-foreground text-xs transition-colors group-hover:bg-accent group-hover:text-accent-foreground data-copied:text-primary [&_svg]:size-3.5"
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

/**
 * An address without its scheme, parted into the host and everything after it.
 *
 * @example splitAddress("https://github.com/you/notes"); // { host: "github.com", rest: "/you/notes" }
 */
function splitAddress(url: string) {
  const { host, pathname, search, hash } = new URL(url);
  return { host, rest: `${pathname === "/" ? "" : pathname}${search}${hash}` };
}

/**
 * A file path parted into its first folder and everything after it.
 *
 * @example splitPath("docs/guides/setup.mdx"); // { host: "docs", rest: "/guides/setup.mdx" }
 */
function splitPath(path: string) {
  const slash = path.indexOf("/");
  if (slash === -1) return { host: path, rest: "" };

  return { host: path.slice(0, slash), rest: path.slice(slash) };
}
