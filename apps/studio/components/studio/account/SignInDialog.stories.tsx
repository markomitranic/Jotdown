import { HttpResponse, delay, http } from "msw";
import { expect, within } from "storybook/test";
import preview from "@/.storybook/preview";
import type { SignInState } from "@/server/auth/device";
import { openSignIn } from "./account";
import { SignInDialog } from "./SignInDialog";

/**
 * Signing in to GitHub: the code to type on github.com, and what happens once GitHub answers.
 *
 * Each story answers the sign-in from memory, the first check after a second.
 */
const meta = preview.meta({
  title: "Studio/Sign in",
  render: () => <SignInDialog />,
});

/** GitHub answers the check with `state`, after asking for the code went through. */
function signIn(state: SignInState) {
  return [
    http.post("/api/auth", async ({ request }) => {
      const { action } = (await request.json()) as { action: string };
      if (action === "check") return HttpResponse.json({ state });
      await delay(400);
      return HttpResponse.json({
        userCode: "WDJB-MJHT",
        verificationUri: "https://github.com/login/device",
        expiresAt: Date.now() + 900_000,
        interval: 1,
      });
    }),
  ];
}

export const Waiting = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(...signIn("waiting"));
  },
  play: async ({ canvasElement }) => {
    openSignIn();
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText("WDJB-MJHT")).toBeVisible();
    await expect(page.getByText("Waiting for GitHub")).toBeVisible();
  },
});

export const SignedIn = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(...signIn("signed-in"));
  },
  play: async ({ canvasElement }) => {
    openSignIn();
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText("Signed in", {}, { timeout: 3000 })).toBeVisible();
  },
});

export const Expired = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(...signIn("expired"));
  },
  play: async ({ canvasElement }) => {
    openSignIn();
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByRole("button", { name: "Get a new code" }, { timeout: 3000 })).toBeVisible();
  },
});
