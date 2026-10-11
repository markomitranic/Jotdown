import type { MDXContent } from "mdx/types";
import { DocsPage } from "@jotdown/core/components/docs/page";
import { EDITABLE_FIELDS, getMDXComponents } from "@jotdown/editor/components/mdx";
import { PageContent } from "@jotdown/core/components/PageContent";
import { SectionCards } from "@jotdown/core/components/blocks/SectionCards";
import { Article } from "@jotdown/editor/components/Article";
import { LiveEditConfigProvider } from "@jotdown/editor/client/config";
import type { LiveEditGlobalData } from "@jotdown/editor/types";
import { KitProvider, type ProjectBlock } from "@jotdown/kit";
import { withUnknownBlocks } from "@jotdown/core/components/blocks/UnknownBlock";
import { editableBlocks } from "@jotdown/editor/project/ProjectBlock";
import { EDITOR, onBranch } from "./studio-api";

/** A `.mdx` file as a story imports it: the compiled article, its front matter and its text. */
export type PageModule = {
  default: MDXContent;
  frontmatter: { title?: string; description?: string; icon?: string };
  source: string;
};

type Props = {
  page: PageModule;
  /** Signed in, so every block is editable where it stands. */
  editing?: boolean;
  /** A project's own blocks, drawn as a site's canvas draws them. */
  blocks?: Record<string, ProjectBlock>;
};

/**
 * A page drawn the way the route draws it, for a reader or for a signed-in editor.
 *
 * Reading is a local preview: nobody signed in, nothing editable. Editing is
 * the studio, with the page's own text handed to the in-place editor and the
 * editing endpoints answered by the story's request handlers.
 *
 * @example <PageStory page={callout} editing />
 */
export function PageStory({ page, editing = false, blocks = {} }: Props) {
  const { default: Compiled, frontmatter, source } = page;
  const title = frontmatter.title ?? "Untitled";
  const slug = `stories/${slugOf(title)}`;
  const path = `docs/${slug}.mdx`;
  onBranch(path, source);

  const content = (
    <PageContent
      title={title}
      description={frontmatter.description}
      icon={frontmatter.icon}
      editable={editing}
      fields={EDITABLE_FIELDS}
    >
      <Compiled
        components={withUnknownBlocks({ ...COMPONENTS, ...(editing ? editableBlocks(blocks) : blocks) }, source)}
      />
    </PageContent>
  );

  return (
    <KitProvider
      page={{ title, description: frontmatter.description, url: `/${slug}`, data: {} }}
      site={SITE}
      pages={PAGES}
    >
      <LiveEditConfigProvider config={editing ? STUDIO : PREVIEW}>
        <DocsPage breadcrumb={false} footer={false} tableOfContent={false}>
          <Article
            target={{
              path,
              localPath: path,
              title,
              markdownUrl: `/llms.mdx/${slug}`,
              githubUrl: `https://github.com/markomitranic/Jotdown/blob/main/${path}`,
              publicUrl: `https://handbook.your-org.com/${slug}`,
            }}
            source={editing ? source : null}
          >
            {content}
          </Article>
        </DocsPage>
      </LiveEditConfigProvider>
    </KitProvider>
  );
}

const SITE = { title: "Handbook", description: "How we build", base: "" };

const PAGES = [
  { title: "Browser editor", description: "How a save becomes a commit.", url: "/manual/browser-editor" },
  { title: "Mermaid diagrams", description: "Ten diagram types, worked through.", url: "/manual/mermaid-diagrams" },
];

/**
 * The page's components, with the section grid filled by two sample pages.
 *
 * The route binds `<DocCardList />` to the page tree, which a story has none
 * of, so the grid a page asks for is drawn from these instead.
 */
const COMPONENTS = getMDXComponents({
  DocCardList: ({ title }: { title?: string }) => (
    <SectionCards
      heading={title ?? "In this section"}
      cards={[
        { href: "/manual/browser-editor", title: "Browser editor", description: "How a save becomes a commit." },
        {
          href: "/manual/mermaid-diagrams",
          title: "Mermaid diagrams",
          description: "Ten diagram types, worked through.",
        },
      ]}
    />
  ),
});

const PREVIEW: LiveEditGlobalData = {
  apiBase: "/api/projects/stories/live-edit",
  base: "",
  editable: false,
  local: false,
  identity: null,
  docs: {},
  entries: {},
  icons: {},
  version: "c0ffee5",
};

export const STUDIO: LiveEditGlobalData = { ...PREVIEW, editable: true, identity: EDITOR };

function slugOf(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
