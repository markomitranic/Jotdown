"use client";

import { Heading } from "@jotdown/core/components/blocks/Heading";
import { useRef, type ComponentProps } from "react";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { useEditable, type Within } from "./useEditable";

type Level = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/**
 * The heading's words sit inside the anchor the core draws, not in the `<h2>`.
 *
 * A heading carrying an `id` is `<h2><a data-card href="#id">words</a><button
 * …></button></h2>`, so an editor mounted on the `<h2>` would wipe both the
 * anchor and the copy button. Mounting it on the anchor instead leaves that
 * markup exactly as it was and makes the right element editable: a click inside
 * editable content places a caret rather than following the link, and the
 * button beside it still copies. A heading with no `id` is a bare `<h2>` and is
 * its own answer.
 */
const ANCHOR: Within = (root) => ({ body: root.querySelector(":scope > a[data-card]") ?? root });

/**
 * One heading level, editable in the anchor the article drew it in.
 *
 * @example export const H2 = editableHeading("h2");
 */
function editableHeading(as: Level) {
  function Editable(props: ComponentProps<"h2"> & { [SOURCE_RANGE]?: string }) {
    const root = useRef<HTMLHeadingElement>(null);

    useEditable(root, props[SOURCE_RANGE], ANCHOR);

    /** Under React 19 a ref is an ordinary prop, so `Heading` hands it to the real `<h2>` with the rest. */
    return <Heading as={as} ref={root} {...props} />;
  }

  Editable.displayName = `Editable(${as})`;
  return Editable;
}

/**
 * One export per level, rather than one object holding all six.
 *
 * The component map is built in a server module, and a server module importing
 * from a `"use client"` one does not get the module: it gets a stand-in whose
 * named exports are the references the client will fill in. An object export
 * has nothing for that stand-in to name, so spreading it there adds nothing at
 * all, with no error and no warning, and every heading quietly stays as
 * the core drew it. Named exports are what makes six references.
 */
export const H1 = editableHeading("h1");
export const H2 = editableHeading("h2");
export const H3 = editableHeading("h3");
export const H4 = editableHeading("h4");
export const H5 = editableHeading("h5");
export const H6 = editableHeading("h6");
