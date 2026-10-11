"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from "react";
import { cn } from "cn";
import { Check, ChevronRight, LinkIcon } from "lucide-react";
import { Accordion as Primitive } from "radix-ui";
import { chromeButton } from "@jotdown/core/components/docs/button";
import { useCopyButton } from "@jotdown/core/lib/use-copy-button";

/**
 * A stack of questions that open one at a time, or several at once with `type="multiple"`.
 *
 * One whose `id` is in the address opens on load. Adapted from Fumadocs UI, MIT.
 *
 * @example <Accordions><Accordion title="Why?">Because.</Accordion></Accordions>
 */
export function Accordions({
  type = "single",
  ref,
  className,
  defaultValue,
  children,
  ...props
}: Omit<ComponentProps<"div">, "defaultValue" | "dir"> & {
  type?: "single" | "multiple";
  ref?: Ref<HTMLDivElement>;
  defaultValue?: string | string[];
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const refs = (element: HTMLDivElement | null) => {
    root.current = element;
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  };
  const [value, setValue] = useState<string | string[]>(() =>
    type === "single" ? (defaultValue ?? "") : (defaultValue ?? []),
  );

  useEffect(() => {
    const id = window.location.hash.substring(1);
    const element = root.current;
    if (!element || id.length === 0) return;
    const selected = document.getElementById(id);
    if (!selected || !element.contains(selected)) return;
    const opened = selected.getAttribute("data-accordion-value");
    if (opened) setValue((now) => (typeof now === "string" ? opened : [opened, ...now]));
  }, []);

  const look = cn("divide-y divide-border overflow-hidden rounded-lg border bg-card", className);

  if (type === "multiple")
    return (
      <Primitive.Root
        {...props}
        ref={refs}
        type="multiple"
        value={value as string[]}
        onValueChange={setValue}
        className={look}
      >
        {children}
      </Primitive.Root>
    );

  return (
    <Primitive.Root
      {...props}
      ref={refs}
      type="single"
      collapsible
      value={value as string}
      onValueChange={setValue}
      className={look}
    >
      {children}
    </Primitive.Root>
  );
}

type AccordionProps = Omit<ComponentProps<typeof Primitive.Item>, "value" | "title"> & {
  title: ReactNode;
  value?: string;
};

/**
 * One question and its answer, with a button that copies a link to it when it has an `id`.
 *
 * @example <Accordion title="Can I self-host?" id="self-host">Yes.</Accordion>
 */
export function Accordion({ title, id, value = String(title), className, children, ...props }: AccordionProps) {
  return (
    <Primitive.Item value={value} {...props} className={cn("scroll-m-24", className)}>
      <Primitive.Header
        id={id}
        data-accordion-value={value}
        className="not-prose flex flex-row items-center font-medium text-card-foreground has-focus-visible:bg-accent"
      >
        <Primitive.Trigger className="group flex flex-1 items-center gap-2 px-3 py-2.5 text-start focus-visible:outline-none">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
          {title}
        </Primitive.Trigger>
        {id ? <CopyLink id={id} /> : null}
      </Primitive.Header>
      <Primitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="prose-no-margin px-4 pb-2 text-[0.9375rem]">{children}</div>
      </Primitive.Content>
    </Primitive.Item>
  );
}

function CopyLink({ id }: { id: string }) {
  const [checked, copy] = useCopyButton(() => {
    const url = new URL(window.location.href);
    url.hash = id;
    return navigator.clipboard.writeText(url.toString());
  });

  return (
    <button
      type="button"
      aria-live="polite"
      className={chromeButton({ variant: "ghost", className: "me-2 text-muted-foreground" })}
      onClick={copy}
    >
      {checked ? <Check className="size-3.5" /> : <LinkIcon className="size-3.5" />}
      <span className="sr-only">{checked ? "Copied link" : "Copy link"}</span>
    </button>
  );
}
