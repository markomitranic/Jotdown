import Link from "next/link";
import { DocsBody, DocsPage, DocsTitle } from "@jotdown/core/components/docs/page";
import { SiteShell } from "@/components/SiteShell";

/** Rendered inside the docs shell, so the sidebar stays on the way back to the first page. */
export default function NotFound() {
  return (
    <SiteShell>
      <DocsPage>
        <DocsTitle>Page not found</DocsTitle>
        <DocsBody>
          <p>Nothing lives at this address. It was never here, or the page has been deleted.</p>
          <p>
            <Link href="/">Back to the start</Link>
          </p>
        </DocsBody>
      </DocsPage>
    </SiteShell>
  );
}
