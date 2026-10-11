import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { CalloutContainer, CalloutTitle } from "@jotdown/core/components/blocks/Callout";

const KINDS = ["note", "tip", "info", "warning", "caution", "danger", "source"] as const;

/**
 * Form controls do not inherit the label's type on their own, and without this
 * the kind and the title would each render in the OS control font.
 */
const INHERIT = { font: "inherit", letterSpacing: "inherit" } as const;

/**
 * Renders an admonition with an editable body and a switchable type.
 *
 * The box is the same `CalloutContainer` the page renders, not a copy of it, so
 * the colour, the rail and the glyph cannot drift from what a reader will see.
 * Only the heading differs: the type is a select and the label an input, both
 * sitting in the callout's own title slot and both outside the editable region.
 *
 * A kind the bridge parsed but this list does not know is added to the picker,
 * so switching away from it is possible without losing it in the meantime.
 */
export default function AdmonitionView({ node, updateAttributes }: ReactNodeViewProps) {
  const kind: string = node.attrs.kind;
  const title: string = node.attrs.title ?? "";
  const options = KINDS.some((known) => known === kind) ? KINDS : [kind, ...KINDS];

  return (
    <NodeViewWrapper>
      <CalloutContainer type={kind}>
        <CalloutTitle className="flex cursor-default items-center gap-2" contentEditable={false}>
          <select
            className="cursor-pointer appearance-none border-0 bg-transparent p-0 text-inherit hover:underline hover:decoration-dotted"
            style={INHERIT}
            value={kind}
            aria-label="Admonition type"
            onChange={(event) => updateAttributes({ kind: event.target.value })}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-inherit outline-none placeholder:text-current placeholder:opacity-40"
            style={INHERIT}
            value={title}
            placeholder="optional title"
            aria-label="Admonition title"
            onChange={(event) => updateAttributes({ title: event.target.value || null })}
          />
        </CalloutTitle>
        <NodeViewContent className="[&>*:last-child]:mb-0" />
      </CalloutContainer>
    </NodeViewWrapper>
  );
}
