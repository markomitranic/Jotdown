import { fn } from "storybook/test";
import preview from "@/.storybook/preview";
import { STUDIO } from "@/.storybook/page";
import { LiveEditConfigProvider } from "@jotdown/editor/client/config";
import { StructureProvider } from "@jotdown/editor/structure/useStructure";
import PageError from "@/app/error";
import { NoPagesYet } from "./NoPagesYet";
import { NoDocsYet } from "./setup/NoDocsYet";

/**
 * The pages the studio shows instead of a page: a repository with no docs, a project with no pages, and a page that broke while drawing.
 */
const meta = preview.meta({
  title: "Studio/States",
  decorators: [
    (Story) => (
      <LiveEditConfigProvider config={STUDIO}>
        <Story />
      </LiveEditConfigProvider>
    ),
  ],
});

export const NoDocs = meta.story({ render: () => <NoDocsYet projectKey="you/site" branch="main" /> });

export const NoPages = meta.story({
  render: () => (
    <StructureProvider>
      <NoPagesYet projectKey="you/site" />
    </StructureProvider>
  ),
});

export const PageBroke = meta.story({
  render: () => <PageError error={Object.assign(new Error("Boom"), { digest: "2914738625" })} retry={fn()} />,
});
