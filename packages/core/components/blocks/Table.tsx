import type { ComponentProps } from "react";
import { WIDTH } from "@jotdown/core/lib/block-width";

type Props = ComponentProps<"table"> & { [WIDTH]?: string };

/**
 * A markdown table, in the horizontally scrolling box the core gives every table.
 *
 * A widened table's width is moved up onto the box, because the box is what
 * stands in the article and scrolls once the columns outgrow it.
 *
 * @example <Table data-block-width="wide">…</Table>
 */
export default function Table({ [WIDTH]: width, ...props }: Props) {
  return (
    <div className="prose-no-margin relative my-6 overflow-auto" {...{ [WIDTH]: width }}>
      <table {...props} />
    </div>
  );
}
