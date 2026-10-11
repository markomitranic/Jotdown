import { fn } from "storybook/test";
import preview from "@/.storybook/preview";
import { OpeningProject, StartingUp } from "./OpeningProject";
import type { Opening } from "./projects";

const DOWNLOADING: Opening = {
  key: "acme/handbook",
  title: "Handbook",
  parts: { owner: "acme", repo: "handbook" },
  step: "downloading",
  found: { branch: "main", head: "5f061f1" },
  look: null,
  problem: null,
};

const REFUSED: Opening = {
  key: "acme/secret",
  title: null,
  parts: { owner: "acme", repo: "secret" },
  step: "finding",
  found: null,
  look: null,
  problem: "GitHub shows no acme/secret. It does not exist, or your account cannot see it.",
};

const FROM_A_FOLDER: Opening = {
  key: "local/handbook",
  title: "Handbook",
  parts: { owner: "local", repo: "handbook" },
  step: "downloading",
  found: { branch: "local", head: "3f1c0de" },
  look: null,
  problem: null,
};

const meta = preview.meta({
  title: "Studio/Opening a project",
  component: OpeningProject,
  args: { onDismiss: fn(), opening: DOWNLOADING },
});

export const Downloading = meta.story();

export const Refused = meta.story({ args: { opening: REFUSED } });

/** A folder on this computer, read off the disk rather than fetched from GitHub. */
export const FromAFolder = meta.story({ args: { opening: FROM_A_FOLDER } });

/** The reload right after the switcher downloaded the project, carrying on at the compile in the project's look. */
export const AfterTheReload = meta.story({
  render: () => (
    <StartingUp
      parts={{ owner: "acme", repo: "handbook" }}
      look={{
        title: "Handbook",
        logo: { alt: "Handbook", src: "/icon.png", srcDark: "/icon.png" },
        theme: "",
        found: { branch: "main", head: "5f061f1" },
        opened: true,
      }}
    />
  ),
});
