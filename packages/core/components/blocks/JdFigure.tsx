import type { ComponentProps } from "react";

/** `className` always arrives, because the rename only finds a figure that carries `jd-fig`. */
type Props = ComponentProps<"figure"> & { className: string };

/**
 * A `jd-fig` figure that opens on the fullscreen stage.
 *
 * A hand-drawn figure is laid out for the article column, which is often
 * narrower than the drawing wants. This marks the figure as one the stage
 * opens and adds the Expand control over it; the click itself is heard once
 * for the whole article by `FigureStage`, so a copy of the figure, which
 * carries only its markup, opens exactly like the original.
 *
 * Nobody types this tag. `remarkJdFigure` in `source.config.ts` renames a
 * `<figure className="jd-fig">` that holds an SVG to it at build time, so the
 * author writes the figure the figure skill describes and the file on
 * disk stays plain. An HTML figure has no drawing to stage and keeps its own
 * tag, so it never offers a click that would do nothing.
 *
 * @example <figure className="jd-fig"><div className="jd-fig-frame"><svg …/></div><figcaption>…</figcaption></figure>
 */
export default function JdFigure({ className, children, ...props }: Props) {
  return (
    <figure className={`${className} jd-fig--stage`} {...props}>
      {children}
      <button type="button" className="jd-fig__hint">
        Click to expand
      </button>
    </figure>
  );
}
