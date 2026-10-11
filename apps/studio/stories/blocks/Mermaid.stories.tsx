import preview from "@/.storybook/preview";
import { PageStory } from "@/.storybook/page";
import * as page from "./Mermaid.mdx";

const meta = preview.meta({
  title: "Blocks/Mermaid",
  args: { editing: false },
  render: ({ editing }) => <PageStory page={page} editing={editing} />,
});

export const Reading = meta.story();

export const Editing = meta.story({ args: { editing: true } });
