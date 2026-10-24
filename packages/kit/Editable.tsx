"use client";

import { useRef, useState, type ChangeEvent, type ElementType, type KeyboardEvent } from "react";
import { cn } from "cn";
import { useEditing, usePage, usePageFields } from "./context";

/**
 * The primitives a project block draws its props with, plain on the site and editable in the canvas.
 *
 * A prop drawn through one of these is written back into the block's tag in
 * the file when the reader changes it in the canvas, always as a string. The
 * page's own title and description are written back into its front matter. A
 * block or layout drawn anywhere else gets exactly the markup it would have
 * drawn without them.
 */

const EDITABLE_RING =
  "rounded-sm outline-offset-4 transition-[outline-color] hover:outline-1 hover:outline-primary/40 hover:outline-dashed focus:outline-2 focus:outline-primary/60 focus:outline-solid";

type TextProps = {
  /** The prop this text is, as written in the block's tag. */
  prop: string;
  value: string | undefined;
  as?: ElementType;
  className?: string;
  /** What an empty text says in the canvas, where it can be typed into. */
  placeholder?: string;
};

/**
 * One line of a block's text, written in its tag as a prop.
 *
 * @example <Editable.Text prop="title" value={title} as="h1" className="text-4xl" />
 */
function Text({ prop, value = "", as: Tag = "span", className, placeholder = "Write here" }: TextProps) {
  const editing = useEditing();
  const shown = useRef(value);
  if (!editing) return <Tag className={className}>{value}</Tag>;

  function commit(element: HTMLElement) {
    const typed = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    if (typed === shown.current || !editing) return;
    shown.current = typed;
    editing.editor.setProp(editing.stamp, prop, typed);
  }

  function keys(event: KeyboardEvent<HTMLElement>) {
    if (event.metaKey || event.ctrlKey) return;
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.currentTarget.textContent = shown.current;
      event.currentTarget.blur();
    }
  }

  return (
    <Tag
      className={cn(
        EDITABLE_RING,
        "cursor-text empty:before:text-muted-foreground/70 empty:before:content-[attr(data-placeholder)]",
        className,
      )}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label={prop}
      data-placeholder={placeholder}
      onKeyDown={keys}
      onBlur={(event: { currentTarget: HTMLElement }) => commit(event.currentTarget)}
    >
      {value}
    </Tag>
  );
}

type ImageProps = {
  /** The prop holding the picture's address, as written in the block's tag. */
  prop: string;
  src: string | undefined;
  alt?: string;
  className?: string;
};

/**
 * A picture whose address is a prop, which the canvas replaces with one picked from disk.
 *
 * The picked file is committed first and only then written into the tag, and
 * the canvas shows it from memory meanwhile, since the site has not been built
 * with it yet.
 *
 * @example <Editable.Image prop="image" src={image} alt="" className="rounded-xl" />
 */
function Image({ prop, src, alt = "", className }: ImageProps) {
  const editing = useEditing();
  const picker = useRef<HTMLInputElement>(null);
  const [shown, setShown] = useState(src);
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  if (!editing) return src ? <img src={src} alt={alt} className={className} /> : null;

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editing) return;

    setShown(URL.createObjectURL(file));
    setState({ busy: true, error: null });
    const uploaded = await editing.editor.upload(file);
    if (!uploaded.ok) {
      setShown(src);
      return setState({ busy: false, error: uploaded.error });
    }
    editing.editor.setProp(editing.stamp, prop, uploaded.url);
    setState({ busy: false, error: null });
  }

  return (
    <span className="group/image relative block">
      {shown ? (
        <img src={shown} alt={alt} className={cn(className, state.busy && "opacity-60")} />
      ) : (
        <span className={cn("grid aspect-video place-items-center bg-muted text-muted-foreground text-sm", className)}>
          No picture yet
        </span>
      )}
      <button
        type="button"
        onClick={() => picker.current?.click()}
        disabled={state.busy}
        className="absolute top-3 right-3 rounded-md bg-background/90 px-2.5 py-1 font-medium text-foreground text-xs opacity-0 shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-opacity focus-visible:opacity-100 disabled:opacity-100 group-hover/image:opacity-100"
      >
        {state.busy ? "Uploading…" : "Replace picture"}
      </button>
      {state.error && (
        <span
          role="alert"
          className="absolute inset-x-3 bottom-3 rounded-md bg-background px-2.5 py-1.5 text-destructive text-xs shadow-sm"
        >
          {state.error}
        </span>
      )}
      <input ref={picker} type="file" accept="image/*" hidden onChange={pick} />
    </span>
  );
}

type FieldProps = { as?: ElementType; className?: string };

/**
 * The page's title, from its front matter, for a layout that draws its own heading.
 *
 * @example <Editable.Title className="text-5xl font-semibold" />
 */
function Title({ as: Tag = "h1", className }: FieldProps) {
  const { title } = usePage();
  const Field = usePageFields()?.Title;

  return <Tag className={className}>{Field ? <Field>{title}</Field> : title}</Tag>;
}

/**
 * The sentence under the page's title, which a page without one leaves out except in the canvas, where it can be written.
 *
 * @example <Editable.Description as="p" className="lead" />
 */
function Description({ as: Tag = "p", className }: FieldProps) {
  const { description } = usePage();
  const Field = usePageFields()?.Description;
  if (!Field && !description) return null;

  return <Tag className={className}>{Field ? <Field>{description}</Field> : description}</Tag>;
}

/** A block's props and the page's own fields, drawn so the canvas can edit them where they stand. */
export const Editable = { Text, Image, Title, Description };
