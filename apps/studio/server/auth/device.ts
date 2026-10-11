import { keepToken } from "./token";

/**
 * Signing in to GitHub with its device flow: GitHub shows a code, you enter it on github.com, the studio gets a token.
 *
 * The flow needs a public OAuth client ID and no secret, so it runs entirely in
 * the studio's server. The device code stays here; the page only ever sees the
 * short code you type, and asks whether GitHub has answered yet.
 */

/** The OAuth app the studio signs in through. Its consent screen is the one GitHub shows. */
const CLIENT_ID = "178c6fc778ccc68e1d6a";
const SCOPES = "repo read:org";

type Pending = { deviceCode: string; interval: number; expiresAt: number; nextPoll: number };

const memory = globalThis as { jotdownSignIn?: Pending };

/** The code to type, where to type it, and when it stops working. */
export type DeviceCode = { userCode: string; verificationUri: string; expiresAt: number; interval: number };

/** How a sign-in stands: still waiting for you, done, or over without a token. */
export type SignInState = "waiting" | "signed-in" | "expired" | "denied";

/**
 * Asks GitHub for a fresh code to type on github.com, replacing any sign-in under way.
 *
 * @example await startSignIn(); // { userCode: "WDJB-MJHT", verificationUri: "https://github.com/login/device", … }
 */
export async function startSignIn(): Promise<DeviceCode> {
  const answer = await github<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }>("https://github.com/login/device/code", { client_id: CLIENT_ID, scope: SCOPES });

  const expiresAt = Date.now() + answer.expires_in * 1000;
  memory.jotdownSignIn = { deviceCode: answer.device_code, interval: answer.interval, expiresAt, nextPoll: 0 };

  return { userCode: answer.user_code, verificationUri: answer.verification_uri, expiresAt, interval: answer.interval };
}

/**
 * Asks GitHub whether the code was entered, and keeps the token once it was.
 *
 * Asking sooner than GitHub's interval answers `waiting` without asking, since
 * GitHub slows down a client that polls too fast.
 *
 * @example await checkSignIn(); // "waiting"
 */
export async function checkSignIn(): Promise<SignInState> {
  const pending = memory.jotdownSignIn;
  if (!pending || Date.now() > pending.expiresAt) return "expired";
  if (Date.now() < pending.nextPoll) return "waiting";

  const answer = await github<{ access_token?: string; error?: string; interval?: number }>(
    "https://github.com/login/oauth/access_token",
    {
      client_id: CLIENT_ID,
      device_code: pending.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    },
  );

  if (answer.access_token) {
    memory.jotdownSignIn = undefined;
    await keepToken(answer.access_token);
    return "signed-in";
  }

  if (answer.error === "slow_down") pending.interval = answer.interval ?? pending.interval + 5;
  pending.nextPoll = Date.now() + pending.interval * 1000;

  if (answer.error === "authorization_pending" || answer.error === "slow_down") return "waiting";
  memory.jotdownSignIn = undefined;
  return answer.error === "access_denied" ? "denied" : "expired";
}

async function github<Answer>(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status} to the sign-in.`);
  return (await response.json()) as Answer;
}
