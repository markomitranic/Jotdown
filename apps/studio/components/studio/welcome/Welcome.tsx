import { localSession } from "@/server/auth/session";
import { NightSky } from "./NightSky";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { UpdateNotice } from "../account/UpdateNotice";
import { ProjectPicker } from "./ProjectPicker";

/**
 * What the studio shows with no project open: its name, one line on what it is, and the project switcher.
 *
 * A project GitHub refused to open says why under the switcher, and one whose
 * config is broken names the file, what is wrong and where to fix it. The
 * header names the editor as git knows them.
 */
export async function Welcome({ problem, broken }: { problem: string | null; broken?: BrokenConfig }) {
  const { editor } = await localSession();

  return (
    <NightSky>
      <header className="absolute top-5 wco:top-0 right-6 wco:right-[calc(var(--titlebar-end)+0.75rem)] z-10 flex wco:h-(--titlebar-height) items-center text-[0.8125rem] text-white/70">
        <UpdateNotice />
      </header>

      <section className="relative z-10 flex flex-col items-center px-6 pt-[24vh] text-center">
        <h1 className="font-normal font-serif text-[clamp(4rem,9vw,8.25rem)] leading-[0.95] tracking-[-0.02em] [text-shadow:0_2px_40px_rgb(20_10_60/0.5)]">
          Jotdown
        </h1>
        <p className="mt-4.5 max-w-[40ch] text-lg/snug text-white/85">
          Your sites, docs and notes, written where they stand.
        </p>

        <ProjectPicker editor={editor} />

        {problem && (
          <p role="alert" className="mt-2 max-w-[48ch] text-[0.8125rem] text-red-300">
            {problem}
          </p>
        )}
        {broken && <BrokenConfigNotice {...broken} />}
      </section>
    </NightSky>
  );
}

const OUTSIDE_LINK =
  "mt-3 inline-flex items-center gap-2 text-[0.8125rem] text-white/80 underline underline-offset-3 hover:text-white";

/** A project file the project cannot open without, what is wrong with it, and where it is on GitHub. */
export type BrokenConfig = { projectKey: string; file: string; problem: string; githubUrl: string };

/**
 * The project that would not open, the file to blame and the parser's own words, under the switcher.
 *
 * @example <BrokenConfigNotice projectKey="you/site" file=".jotdown/config.json" problem="Not valid JSON. …" githubUrl="https://github.com/…" />
 */
function BrokenConfigNotice({ projectKey, file, problem, githubUrl }: BrokenConfig) {
  return (
    <div role="alert" className="mt-8 w-full max-w-[60ch] border-red-300/80 border-l-2 pl-4 text-left text-[0.8125rem]">
      <p className="text-white">
        Sorry, {projectKey} cannot open because <code className="font-mono">{file}</code> is broken.
      </p>
      <pre className="mt-2 whitespace-pre-wrap font-mono text-red-300 text-xs leading-relaxed">{problem}</pre>
      {githubUrl && (
        <a href={githubUrl} target="_blank" rel="noreferrer" className={OUTSIDE_LINK}>
          <GitHubMark className="size-4.5" />
          Open in GitHub
        </a>
      )}
    </div>
  );
}
