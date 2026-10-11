"use client";

import { useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { Popover } from "radix-ui";
import { Settings2 } from "lucide-react";
import { BlockScope, blockMeta, useEditing, type BlockMeta, type ProjectBlock } from "@jotdown/kit";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { Button } from "@jotdown/core/components/ui/button";
import { Input } from "@jotdown/core/components/ui/input";
import { Textarea } from "@jotdown/core/components/ui/textarea";
import { useInplace } from "../inplace/context";

/**
 * A project's own blocks on an editable page: drawn by their component, moved like any block, edited from inside.
 *
 * Each block stands in an element carrying its stamp, which is what gives it a
 * grip, and tells the primitives inside it where it was written. A settings
 * button on its corner edits its props, as fields when the block was
 * registered with `defineBlock` and as its source when it was not.
 *
 * @example getMDXComponents(editableBlocks({ Hero })); // Hero, editable
 */
export function editableBlocks(blocks: Record<string, ProjectBlock>) {
  return Object.fromEntries(
    Object.entries(blocks).map(([name, Block]) => [
      name,
      (props: Record<string, unknown>) => <EditableBlock name={name} Block={Block} props={props} />,
    ]),
  );
}

type Props = { name: string; Block: ProjectBlock; props: Record<string, unknown> };

function EditableBlock({ name, Block, props }: Props) {
  const { [SOURCE_RANGE]: written, ...own } = props;
  const stamp = typeof written === "string" ? written : null;
  const root = useRef<HTMLDivElement>(null);
  const [changed, setChanged] = useState<Record<string, string>>({});
  const [asSource, setAsSource] = useState(false);

  return (
    <div ref={root} data-src-range={stamp ?? undefined} className="group/project relative" inert={asSource}>
      <BlockScope stamp={asSource ? null : stamp}>
        <Block {...own} {...changed} />
        {stamp && !asSource && (
          <BlockSettings
            name={name}
            meta={blockMeta(Block)}
            values={{ ...own, ...changed }}
            root={root}
            onProp={(prop, value) => setChanged((was) => ({ ...was, [prop]: value }))}
            onSource={() => setAsSource(true)}
          />
        )}
      </BlockScope>
      {asSource && (
        <p className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md bg-popover px-2.5 py-1 text-muted-foreground text-xs shadow-sm ring-1 ring-foreground/10">
          Edited as source. Save to draw it again.
        </p>
      )}
    </div>
  );
}

type SettingsProps = {
  name: string;
  meta: BlockMeta | null;
  values: Record<string, unknown>;
  root: RefObject<HTMLDivElement | null>;
  onProp(prop: string, value: string): void;
  onSource(): void;
};

/**
 * The block's settings: a field per prop its registration names, and its source for everything else.
 *
 * @example <BlockSettings name="Hero" meta={meta} values={props} root={root} onProp={set} onSource={raw} />
 */
function BlockSettings({ name, meta, values, root, onProp, onSource }: SettingsProps) {
  const editing = useEditing();
  const inplace = useInplace();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string | null>(meta?.props ? null : "");
  if (!editing) return null;

  const ops = () => (root.current ? inplace?.handles.at(root.current) : null);
  const fields = Object.entries(meta?.props ?? {});

  function opened(next: boolean) {
    setOpen(next);
    if (next && !meta?.props) setSource(ops()?.markdown() ?? "");
  }

  function saveSource(event: FormEvent) {
    event.preventDefault();
    const rewrite = ops()?.rewrite;
    if (source === null || !rewrite) return;
    rewrite(source);
    setOpen(false);
    onSource();
  }

  function setProp(prop: string, value: string) {
    if (!editing || String(values[prop] ?? "") === value) return;
    editing.editor.setProp(editing.stamp, prop, value);
    onProp(prop, value);
  }

  return (
    <Popover.Root open={open} onOpenChange={opened}>
      <Popover.Trigger
        aria-label={`${meta?.title ?? name} settings`}
        className="absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-md bg-background/90 text-muted-foreground opacity-0 shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/project:opacity-100 data-[state=open]:opacity-100"
      >
        <Settings2 className="size-4" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          onKeyDown={(event) => event.stopPropagation()}
          className="z-50 w-80 rounded-lg bg-popover p-3 text-popover-foreground text-sm shadow-xl ring-1 ring-foreground/10 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        >
          <p className="font-medium">{meta?.title ?? name}</p>
          {meta?.description && <p className="mt-0.5 text-muted-foreground text-xs">{meta.description}</p>}

          {source === null ? (
            <div className="mt-3 space-y-2.5">
              {fields.map(([prop, field]) => (
                <div key={prop}>
                  <label htmlFor={`${id}-${prop}`} className="mb-1 block text-muted-foreground text-xs">
                    {field.label ?? prop}
                  </label>
                  <Input
                    id={`${id}-${prop}`}
                    defaultValue={String(values[prop] ?? "")}
                    placeholder={field.kind === "image" ? "/uploads/picture.png" : undefined}
                    onBlur={(event) => setProp(prop, event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setProp(prop, event.currentTarget.value);
                    }}
                    className="h-8"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSource(ops()?.markdown() ?? "")}
                className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
              >
                Edit as source
              </button>
            </div>
          ) : (
            <form onSubmit={saveSource} className="mt-3">
              <Textarea
                value={source}
                onChange={(event) => setSource(event.target.value)}
                spellCheck={false}
                aria-label={`${name} source`}
                className="max-h-80 min-h-28 font-mono text-xs"
              />
              <div className="mt-2.5 flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Apply
                </Button>
              </div>
            </form>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
