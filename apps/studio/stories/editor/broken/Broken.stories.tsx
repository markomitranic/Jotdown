import { expect, fn, userEvent, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { STUDIO } from "@/.storybook/page";
import { onBranch } from "@/.storybook/studio-api";
import { LiveEditConfigProvider } from "@jotdown/editor/client/config";
import { BrokenPage } from "@jotdown/editor/components/broken/BrokenPage";
import { FixJsonFile } from "@jotdown/editor/components/broken/FixJsonFile";
import { ProjectProblems } from "@jotdown/editor/components/broken/ProjectProblems";

const GITHUB = "https://github.com/you/notes/blob/main/";
const BROKEN_PAGE = "---\ndescription: An agent forgot the title\nfull: often\n---\n\nInstall steps.\n";
const BROKEN_META = '{\n  "title": "Guides",\n  "pages": ["setup", "install",]\n}\n';

/**
 * A project with files that could not be read: the strip above every page, a page whose front matter is broken, and a `meta.json` fixed in place.
 */
const meta = preview.meta({
  title: "Studio/Broken files",
  decorators: [
    (Story) => (
      <LiveEditConfigProvider config={STUDIO}>
        <div className="mx-auto max-w-3xl p-8">
          <Story />
        </div>
      </LiveEditConfigProvider>
    ),
  ],
});

export const Strip = meta.story({
  render: () => (
    <ProjectProblems
      fileUrl={GITHUB}
      problems={[
        {
          file: "docs/guides/install.mdx",
          problem: "title: Invalid input: expected string, received undefined",
          url: "/guides/install",
        },
        { file: "docs/guides/meta.json", problem: "Not valid JSON. Unexpected token ']'", url: null },
        { file: "docs/moved.json", problem: "Not valid JSON. Unexpected end of JSON input", url: null },
      ]}
    />
  ),
});

export const Page = meta.story({
  beforeEach: () => onBranch("docs/guides/install.mdx", BROKEN_PAGE),
  render: () => (
    <BrokenPage
      title="install"
      path="docs/guides/install.mdx"
      problem={
        "title: Invalid input: expected string, received undefined\nfull: Invalid input: expected boolean, received string"
      }
      text={BROKEN_PAGE}
      githubUrl={`${GITHUB}docs/guides/install.mdx`}
    />
  ),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await expect(page.getByText(/Saving removes/)).toBeVisible();
    await userEvent.type(page.getByLabelText("Title"), "Install");
    await expect(page.getByRole("button", { name: "Save and open" })).toBeEnabled();
  },
});

export const FixMeta = meta.story({
  beforeEach: () => onBranch("docs/guides/meta.json", BROKEN_META),
  render: () => <FixJsonFile file="docs/guides/meta.json" open onOpenChange={fn()} />,
  play: async () => {
    const dialog = within(document.body);
    await expect(await dialog.findByText(/Not valid JSON/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  },
});
