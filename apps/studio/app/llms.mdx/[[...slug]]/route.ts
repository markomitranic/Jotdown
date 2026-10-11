import { notFound } from "next/navigation";
import { requireSource } from "@/lib/source";

/**
 * The markdown source of one page, as text, at `/llms.mdx/<the page's path>`.
 *
 * This is what Copy markdown in the page menu copies and what View as Markdown
 * opens, so it serves the file as written, front matter and all, rather than
 * anything compiled from it. Served as `text/plain` on purpose: a browser
 * handed `text/markdown` downloads it instead of showing it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const page = (await requireSource()).getPage((await params).slug ?? []);
  if (!page) notFound();

  return new Response(await page.data.getText("raw"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const dynamic = "force-dynamic";
