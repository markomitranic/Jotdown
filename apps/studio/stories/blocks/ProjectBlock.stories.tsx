import { Hero } from "@jotdown/kit/templates/blocks/Hero";
import { PageList } from "@jotdown/kit/templates/blocks/PageList";
import preview from "@/.storybook/preview";
import { PageStory } from "@/.storybook/page";
import * as page from "./ProjectBlock.mdx";
import { Bento, Tile } from "./project-grid";

/**
 * A project's own blocks, written with the kit: plain on a site, and in the canvas, props typed in place, settings in the grip's menu and an empty slot to fill. The bento's tiles span its columns the same way in both. `Pricing` is a tag nobody draws.
 */
const meta = preview.meta({
  title: "Blocks/Project blocks",
  args: { editing: false },
  render: ({ editing }) => <PageStory page={page} editing={editing} blocks={{ Hero, PageList, Bento, Tile }} />,
});

export const Reading = meta.story();

export const Editing = meta.story({ args: { editing: true } });
