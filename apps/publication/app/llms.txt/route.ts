import { llmsIndex } from "@jotdown/core/lib/llms";
import { markdownUrl } from "@/lib/markdown-url";
import { publication, publicationSource } from "@/server/project";

/** The publication's `/llms.txt`, written at build time. */
export async function GET() {
  const project = publication();
  const text = llmsIndex(project, await publicationSource(), markdownUrl);
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export const dynamic = "force-static";
