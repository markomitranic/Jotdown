import { Children, isValidElement } from "react";
import type { CSSProperties, ComponentProps, ReactNode } from "react";
import { cn } from "cn";
import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";

/** The `:::` keywords an author can write, and what each one looks like. */
type Keyword = "note" | "tip" | "info" | "warning" | "danger" | "source";

type Look = { colour: string; title: string; icon: ReactNode };

/** A status glyph filled with the callout's colour, its mark cut out in the card's. */
const FILLED = "size-5 -me-0.5 fill-(--callout-color) text-card";

const GLYPH = "size-5 -me-0.5 text-(--callout-color)";

/**
 * One row per keyword: the colour of its rail and glyph, the label it prints when the author wrote none, and the glyph.
 *
 * `note` and `source` are the muted grey pair; the other four borrow the
 * status colours.
 */
const LOOKS: Record<Keyword, Look> = {
  note: { colour: "note", title: "Note", icon: <IconNote /> },
  tip: { colour: "success", title: "Tip", icon: <CircleCheck className={FILLED} /> },
  info: { colour: "info", title: "Info", icon: <Info className={FILLED} /> },
  warning: { colour: "warning", title: "Warning", icon: <TriangleAlert className={FILLED} /> },
  danger: { colour: "destructive", title: "Danger", icon: <CircleX className={FILLED} /> },
  source: { colour: "source", title: "Source", icon: <IconSource /> },
};

type Props = Omit<ComponentProps<"div">, "type"> & { type?: string };

/**
 * A `:::note` and its five siblings: a card with a coloured rail, a glyph and the prose beside them.
 *
 * `remarkDirectiveAdmonition` rewrites every directive into this component plus
 * a `CalloutTitle` and a `CalloutDescription`, and it only emits a title when
 * the author wrote a label, `:::tip[Read this first]`. Docusaurus always
 * printed one, so the keyword's own name is injected when the label is missing;
 * a written label still wins.
 *
 * The label is recognised by its marker attribute as well as by its component,
 * because the children may arrive already rendered, as the paragraph the title
 * component drew rather than the component itself. Adapted from Fumadocs UI, MIT.
 *
 * @example <CalloutContainer type="source">…</CalloutContainer> // grey, bookmark glyph, "Source"
 */
export function CalloutContainer({ type = "note", className, style, children, ...props }: Props) {
  const look = LOOKS[type as Keyword] ?? LOOKS.note;
  const titled = Children.toArray(children).some(
    (child) =>
      isValidElement<{ "data-callout-title"?: string }>(child) &&
      (child.type === CalloutTitle || child.props["data-callout-title"] !== undefined),
  );

  return (
    <div
      {...props}
      className={cn(
        "my-4 flex gap-2 rounded-xl border bg-card p-3 ps-1 text-card-foreground text-sm shadow-md",
        className,
      )}
      style={{ "--callout-color": accentOf(look.colour), ...style } as CSSProperties}
    >
      <div role="none" className="w-0.5 rounded-sm bg-(--callout-color)/50" />
      {look.icon}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {titled ? null : <CalloutTitle>{look.title}</CalloutTitle>}
        {children}
      </div>
    </div>
  );
}

/**
 * The rail and glyph colour for a type, readable grey when the stylesheet names none.
 *
 * @example accentOf("note"); // "var(--color-note, var(--color-muted-foreground))"
 */
function accentOf(colour: string) {
  return `var(--color-${colour}, var(--color-muted-foreground))`;
}

/** The `note` glyph: Docusaurus's own, kept so the most common callout has one. */
function IconNote() {
  return (
    <svg viewBox="0 0 14 16" className={GLYPH} fill="currentColor" aria-hidden="true">
      <path d="M6.3 5.69a.942.942 0 0 1-.28-.7c0-.28.09-.52.28-.7.19-.18.42-.28.7-.28.28 0 .52.09.7.28.18.19.28.42.28.7 0 .28-.09.52-.28.7a1 1 0 0 1-.7.3c-.28 0-.52-.11-.7-.3zM8 7.99c-.02-.25-.11-.48-.31-.69-.2-.19-.42-.3-.69-.31H6c-.27.02-.48.13-.69.31-.2.2-.3.44-.31.69h1v3c.02.27.11.5.31.69.2.2.42.31.69.31h1c.27 0 .48-.11.69-.31.2-.19.3-.42.31-.69H8V7.98v.01zM7 2.3c-3.14 0-5.7 2.54-5.7 5.68 0 3.14 2.56 5.7 5.7 5.7s5.7-2.55 5.7-5.7c0-3.15-2.56-5.69-5.7-5.69v.01zM7 .98c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.12-7-7 3.14-7 7-7z" />
    </svg>
  );
}

/** The `:::source` glyph: where a pattern in the text comes from, book, author, year. */
function IconSource() {
  return (
    <svg viewBox="0 0 24 24" className={GLYPH} fill="currentColor" aria-hidden="true">
      <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
    </svg>
  );
}

/**
 * The label, marked so the in-place editor can find it.
 *
 * A callout's box holds a colour rail and an icon beside its prose, so an
 * editor handed the box would wipe both. The two attributes here are how the
 * editor points at the right elements instead of recognising a class name.
 */
export function CalloutTitle({ className, ...props }: ComponentProps<"p">) {
  return <p data-callout-title="" {...props} className={cn("my-0! font-medium", className)} />;
}

/** The body, marked for the same reason the label is. */
export function CalloutDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-callout-body=""
      {...props}
      className={cn("prose-no-margin text-muted-foreground empty:hidden", className)}
    />
  );
}
