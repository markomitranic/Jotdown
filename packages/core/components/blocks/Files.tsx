"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";
import { FileIcon, FolderIcon, FolderOpen } from "lucide-react";
import { Collapsible } from "radix-ui";
import { CollapsibleContent } from "@jotdown/core/components/docs/collapsible";

/**
 * A file tree, with folders that open and close.
 *
 * Adapted from Fumadocs UI, MIT.
 *
 * @example <Files><Folder name="docs" defaultOpen><File name="index.mdx" /></Folder></Files>
 */
export function Files({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("not-prose rounded-md border bg-card p-2", className)} />;
}

const ROW =
  "flex flex-row items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground [&_svg]:size-4";

/**
 * One file of the tree.
 *
 * @example <File name="package.json" />
 */
export function File({
  name,
  icon = <FileIcon />,
  className,
  ...props
}: ComponentProps<"div"> & { name: string; icon?: ReactNode }) {
  return (
    <div {...props} className={cn(ROW, className)}>
      {icon}
      {name}
    </div>
  );
}

/**
 * A folder of the tree, closed unless it says otherwise.
 *
 * @example <Folder name="src" defaultOpen>…</Folder>
 */
export function Folder({
  name,
  defaultOpen = false,
  children,
}: {
  name: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className={cn(ROW, "w-full")}>
        {open ? <FolderOpen /> : <FolderIcon />}
        {name}
      </Collapsible.Trigger>
      <CollapsibleContent>
        <div className="ms-2 flex flex-col border-l ps-2">{children}</div>
      </CollapsibleContent>
    </Collapsible.Root>
  );
}
