import { HttpResponse, delay, http } from "msw";
import type {
  ApiError,
  AssetResponse,
  LinkPreview,
  PageHistoryResponse,
  SaveRequest,
  SaveResponse,
  SourceResponse,
} from "@jotdown/editor/types";

/**
 * What the studio's GitHub answers for a story's page.
 *
 * `free` saves on the first try. `moved` is somebody having committed to the
 * file since it was rendered, and `down` is the editing service not answering
 * at all. `uploading` is an upload that never finishes, and `refused` one the
 * server turns away.
 */
export type Scenario = "free" | "moved" | "down" | "uploading" | "refused";

/** The one editor every story is signed in as. */
export const EDITOR = { name: "Grace Hopper", email: "grace@example.com" };

/** The live-edit endpoints of any project, and nothing else under a `live-edit` folder. */
const API = "/api/projects/:project/live-edit";

const SHA = "5f061f14c0ffee";

/**
 * The branch head the fake studio answers from: every page's text by repository path.
 *
 * A story's page writes itself in when it renders, and a save writes over it,
 * so a second save in the same story is sent against the text the first left.
 */
const branch = new Map<string, string>();

/**
 * Puts a page's text on the fake branch, as the file the page was rendered from.
 *
 * @example onBranch("docs/stories/callouts.mdx", callouts.source);
 */
export function onBranch(path: string, text: string) {
  branch.set(path, text);
}

/**
 * Request handlers standing in for the live-edit endpoints.
 *
 * They answer the wire types the browser reads, so a story exercises the same
 * client code a studio tab runs, from the toolbar down to the request helper.
 * Every story gets `free`; one that wants another hands its own to `msw.use`,
 * which puts them in front.
 *
 * @example beforeEach: ({ msw }) => { msw.use(...studioApi("moved")); }
 */
export function studioApi(scenario: Scenario = "free") {
  if (scenario === "down") {
    return [http.all(`${API}/*`, () => HttpResponse.error())];
  }

  return [
    http.get(`${API}/source`, ({ request }) => {
      const path = pathOf(request);
      const text = branch.get(path) ?? "";
      return HttpResponse.json<SourceResponse>({
        path,
        text: scenario === "moved" ? `${text}\nA line somebody else committed.\n` : text,
        sha: SHA,
      });
    }),

    http.post(`${API}/save`, async ({ request }) => {
      const save = (await request.json()) as SaveRequest;
      branch.set(save.path, save.text);
      return HttpResponse.json<SaveResponse>({ commitSha: "c0ffee5", sha: SHA });
    }),

    http.get("/llms.mdx/*", ({ params }) => HttpResponse.text(branch.get(`docs/${params[0]}.mdx`) ?? "")),

    http.post(`${API}/asset`, async ({ request }) => {
      if (scenario === "uploading") await delay("infinite");
      if (scenario === "refused") {
        return HttpResponse.json(
          { error: "Images have to be under 25 MB. Compress it or export a smaller one." } satisfies ApiError,
          { status: 413 },
        );
      }

      const query = new URL(request.url).searchParams;
      const extension = query.get("kind") === "file" ? query.get("ext") : "png";
      const url = `/${query.get("kind") === "file" ? "files" : "img"}/docs/${crypto.randomUUID().slice(0, 16)}.${extension}`;
      return HttpResponse.json<AssetResponse>({ path: `docs/_uploads${url}`, url });
    }),

    http.get("/api/link-preview", async () => {
      await delay(900);
      return HttpResponse.json<LinkPreview>({
        title: "Fumadocs",
        description: "The React.js documentation framework.",
        site: "Fumadocs",
        image: "https://www.fumadocs.dev/banner.png",
        favicon: "https://www.fumadocs.dev/icon.png",
      });
    }),

    http.get("/api/auth", () =>
      HttpResponse.json({
        account: { login: "grace", name: EDITOR.name, avatarUrl: "/icon.png" },
        source: "keychain",
      }),
    ),

    http.get(`${API}/history`, () =>
      HttpResponse.json<PageHistoryResponse>({ head: SHA, revisions: [], nextPage: null }),
    ),
  ];
}

function pathOf(request: Request) {
  return new URL(request.url).searchParams.get("path") ?? "";
}
