import { definePreview, type Decorator } from "@storybook/nextjs-vite";
import addonA11y from "@storybook/addon-a11y";
import addonMsw from "msw-storybook-addon";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@jotdown/core/lib/query-client";
import { RootProvider } from "@jotdown/core/components/docs/root";
import { themeSchema, themeStylesheet } from "@jotdown/core/lib/theme";
import framework from "../../../.jotdown/config.json";
import { studioApi } from "./studio-api";
import "@jotdown/core/css/global.css";

/**
 * The projects a story can be worn by: the framework's default look, and a real project's theme.
 *
 * Every block paints from the tokens, so a block that looks right in both is
 * one that reads its colours rather than hard-coding them.
 */
const PROJECTS = {
  default: { title: "Default look", css: "" },
  framework: { title: "Jotdown", css: themeStylesheet(themeSchema.parse(framework.theme)) },
};

type Project = keyof typeof PROJECTS;

/**
 * Wears the chosen project and colour mode, inside the providers every page of the app sits in.
 *
 * The query client is the page's own, emptied before every story so no story
 * reads another's answers, and it never retries, so a failure shows at once.
 *
 * `forcedTheme` hands the mode to `next-themes`, which is what puts `.dark` on
 * `<html>` in the app too, so a story and a page flip modes the same way.
 */
const withProject: Decorator = (Story, { globals }) => {
  const project = PROJECTS[globals.project as Project] ?? PROJECTS.default;

  return (
    <QueryClientProvider client={getQueryClient()}>
      <RootProvider theme={{ forcedTheme: globals.mode, hotKey: false }}>
        <style>{project.css}</style>
        <Story />
      </RootProvider>
    </QueryClientProvider>
  );
};

/**
 * Throws away the editor's recovery copies and staged sidebar changes, so every story opens on a clean page.
 *
 * Only the editor's own keys go: the preview shares its storage with the
 * Storybook window around it, which keeps its own settings there.
 */
function forgetDrafts() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith("live-edit:"))
    .forEach((key) => localStorage.removeItem(key));
}

const defaults = getQueryClient().getDefaultOptions();
getQueryClient().setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retry: false } });

export default definePreview({
  addons: [addonA11y(), addonMsw()],
  decorators: [withProject],
  beforeEach: ({ msw }) => {
    getQueryClient().clear();
    msw.use(...studioApi());
    forgetDrafts();
  },
  globalTypes: {
    mode: {
      description: "Colour mode",
      toolbar: {
        title: "Mode",
        icon: "mirror",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
    project: {
      description: "Project theme",
      toolbar: {
        title: "Project",
        icon: "paintbrush",
        items: Object.entries(PROJECTS).map(([value, { title }]) => ({ value, title })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { mode: "light", project: "default" },
  parameters: {
    layout: "fullscreen",
    backgrounds: { disable: true },
    nextjs: { appDirectory: true },
    a11y: { test: "todo" },
    docs: { source: { type: "code" } },
  },
});
