import type { ComponentProps } from "react";
import { CodeBlock, Pre } from "./CodeBlock";

/**
 * A code fence of the article, framed with its copy button, with line numbers on.
 *
 * @example <Fence>…</Fence>
 */
export function Fence({ children, ...props }: ComponentProps<typeof CodeBlock>) {
  return (
    <CodeBlock data-line-numbers {...props}>
      <Pre>{children}</Pre>
    </CodeBlock>
  );
}
