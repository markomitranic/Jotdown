"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { Popover } from "radix-ui";
import { BlockScope, blockMeta, useEditing, type BlockMeta, type ProjectBlock } from "@jotdown/kit";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { Button } from "@jotdown/core/components/ui/button";
import { Input } from "@jotdown/core/components/ui/input";
import { Textarea } from "@jotdown/core/components/ui/textarea";
import { useInplace } from "../inplace/context";
import { blockBounds } from "../inplace/handleGeometry";
import { blockSettings } from "./settings";

/**
 * A project's own blocks on an editable page: drawn by their component, moved like any block, edited from inside.
 *
 * Each block stands in an element carrying its stamp, which is what gives it a
 * grip, and tells the primitives inside it where it was written. That element
 * draws no box, so the block's own root is what the layout around it places,
 * as on the site. Settings in the grip's menu edit its props, as fields when it
 * was registered with `defineBlock` and as its source when it was not.
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
  const edge = useRef({ getBoundingClientRect: () => topEdge(root.current) });
  const [changed, setChanged] = useState<Record<string, string>>({});
  const [asSource, setAsSource] = useState(false);

  return (
    <div ref={root} data-src-range={stamp ?? undefined} style={{ display: "contents" }} inert={asSource}>
      <BlockScope stamp={asSource ? null : stamp}>
        <Block {...own} {...changed} />
        {stamp && !asSource && (
          <BlockSettings
            name={name}
            meta={blockMeta(Block)}
            values={{ ...own, ...changed }}
            root={root}
            edge={edge}
            onProp={(prop, value) => setChanged((was) => ({ ...was, [prop]: value }))}
            onSource={() => setAsSource(true)}
          />
        )}
      </BlockScope>
      <Popover.Root open={asSource}>
        <Popover.Anchor virtualRef={edge} />
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="end"
            sideOffset={8}
            alignOffset={8}
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="pointer-events-none z-40 rounded-md bg-popover px-2.5 py-1 text-muted-foreground text-xs shadow-sm ring-1 ring-foreground/10"
          >
            Edited as source. Save to draw it again.
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

/**
 * The top edge of the block a wrapper holds, which its settings hang from.
 *
 * @example topEdge(wrapper); // DOMRect { top: 120, height: 0, … }
 */
function topEdge(wrapper: HTMLElement | null) {
  if (!wrapper) return new DOMRect();
  const { left, top, width } = blockBounds(wrapper);
  return new DOMRect(left, top, width, 0);
}

type SettingsProps = {
  name: string;
  meta: BlockMeta | null;
  values: Record<string, unknown>;
  root: RefObject<HTMLDivElement | null>;
  /** What the settings hang from, since the block's own element draws no box to anchor them to. */
  edge: RefObject<{ getBoundingClientRect(): DOMRect }>;
  onProp(prop: string, value: string): void;
  onSource(): void;
};

/**
 * The block's settings: a field per prop its registration names, and its source for everything else.
 *
 * Opened from the block's grip menu, and hung from the block's top edge.
 *
 * @example <BlockSettings name="Hero" meta={meta} values={props} root={root} edge={edge} onProp={set} onSource={raw} />
 */
function BlockSettings({ name, meta, values, root, edge, onProp, onSource }: SettingsProps) {
  const editing = useEditing();
  const inplace = useInplace();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string | null>(meta?.props ? null : "");

  useEffect(() => {
    const element = root.current;
    if (!element || !editing) return;
    blockSettings.set(element, () => opened(true));
    return () => {
      blockSettings.delete(element);
    };
  });

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
      <Popover.Anchor virtualRef={edge} />
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          aria-label={`${meta?.title ?? name} settings`}
          onKeyDown={(event) => event.stopPropagation()}
          className="jd-scroll-container z-50 max-h-(--radix-popover-content-available-height) w-80 overflow-y-auto rounded-lg bg-popover p-3 text-popover-foreground text-sm shadow-xl ring-1 ring-foreground/10 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
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
