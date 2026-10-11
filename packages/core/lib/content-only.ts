import type { Root } from "mdast";
import type { Position } from "unist";

/** One piece of a page that would run code, and where it was written. */
export type ExecutableContent = { reason: string; place?: Position };

const literalNodes = new Set([
  "Program",
  "ExpressionStatement",
  "Literal",
  "ObjectExpression",
  "Property",
  "ArrayExpression",
  "UnaryExpression",
  "Identifier",
  "TemplateLiteral",
  "TemplateElement",
]);

const expressionNodes =
  /^(mdxFlowExpression|mdxTextExpression|mdxJsxAttributeValueExpression|mdxJsxExpressionAttribute)$/;

const forbiddenTags = /^(script|iframe|object|embed|base|meta|link|include)$/i;

/**
 * Everything in a parsed MDX page that would run code, each with the place it sits.
 *
 * Literal component properties and inline figures pass. An empty list means
 * the page is content only and safe to compile.
 *
 * @example executableContent(parse("<Card title=\"Setup\" />")); // []
 * @example executableContent(parse("<Card title={HOME} />"))[0].reason; // "MDX properties cannot reference JavaScript variables."
 */
export function executableContent(tree: Root) {
  const found: ExecutableContent[] = [];
  visit(tree, found);
  return found;
}

/** Collects the executable nodes under one document node, reporting each at the nearest markdown position. */
function visit(value: unknown, found: ExecutableContent[], place?: Position): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) visit(item, found, place);
    return;
  }

  const node = value as Record<string, unknown>;
  const here = (node.position as Position | undefined) ?? place;
  const report = (reason: string) => found.push({ reason, place: here });

  if (node.type === "mdxjsEsm") {
    report("Project documents cannot import or export JavaScript. Use the built-in blocks.");
    return;
  }

  const isElement = node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";
  if (isElement && typeof node.name === "string" && forbiddenTags.test(node.name)) {
    report(`The ${node.name} tag is not supported in project documents.`);
  }

  const isHandler =
    typeof node.name === "string" && (/^on/i.test(node.name) || node.name === "dangerouslySetInnerHTML");
  if (node.type === "mdxJsxAttribute" && isHandler) {
    report("Project documents cannot define event handlers or raw HTML.");
    return;
  }

  if (typeof node.type === "string" && expressionNodes.test(node.type)) {
    const data = node.data as { estree?: unknown } | undefined;
    const reason = data?.estree ? nonLiteral(data.estree) : "Unsupported MDX expression.";
    if (reason) report(reason);
    return;
  }

  if (node.children) visit(node.children, found, here);
  if (node.attributes) visit(node.attributes, found, here);
  if (node.value && typeof node.value === "object") visit(node.value, found, here);
}

/**
 * Why an expression is more than plain data, or null when it is JSON-like values and signed numbers.
 *
 * @example nonLiteral(estreeOf("{[1, -2]}")); // null
 * @example nonLiteral(estreeOf("{alert(1)}")); // "MDX properties must contain literal values; …"
 */
function nonLiteral(value: unknown, parent?: Record<string, unknown>, key?: string): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const reason = nonLiteral(item, parent, key);
      if (reason) return reason;
    }
    return null;
  }

  const node = value as Record<string, unknown>;
  if (typeof node.type !== "string") return null;

  if (!literalNodes.has(node.type))
    return "MDX properties must contain literal values; executable expressions are not supported.";

  if (node.type === "Identifier" && !(parent?.type === "Property" && key === "key" && parent.computed === false))
    return "MDX properties cannot reference JavaScript variables.";

  if (node.type === "Property" && (node.computed || node.method || node.shorthand || node.kind !== "init"))
    return "MDX properties must be plain data.";

  if (node.type === "UnaryExpression" && node.operator !== "-" && node.operator !== "+")
    return "Only signed numbers are supported in MDX properties.";

  const walked = ["body", "expression", "properties", "elements", "key", "value", "argument", "quasis", "expressions"];
  for (const [childKey, child] of Object.entries(node)) {
    if (!walked.includes(childKey)) continue;
    const reason = nonLiteral(child, node, childKey);
    if (reason) return reason;
  }
  return null;
}
