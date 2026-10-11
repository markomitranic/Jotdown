import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "./env";
import { PROJECT_COOKIE, PROJECT_HEADER, projectMount } from "./lib/project-key";

/**
 * Mounts each project at `/owner/repo`, and refuses writes sent by other sites.
 *
 * `/you/notes/guides/setup` is the page `/guides/setup` of the repository
 * `you/notes`. The proxy takes the first two segments off, names the project
 * in a request header, and hands the rest to the routes, which serve every
 * project the way a publication serves one site.
 *
 * An upload asked for from the site root, `/img/docs/a.png` written in a page or
 * `url(/uploads/font.woff2)` in a theme's stylesheet, is sent to the same address
 * under the project of the page that asked, read off the `Referer`.
 *
 * A rewritten request comes back through the proxy with its project already
 * named, and goes on as it is. Read off the address a second time,
 * `/guides/setup` would be the project `guides/setup`.
 *
 * The studio signs nobody in, so a write sent by another site would go through
 * as the editor. Any request that changes something is refused unless it
 * comes from the studio's own pages. Inside the desktop app, `appGuard` also
 * keeps out everything that is not the app's own window.
 */
const UPLOADS = /^\/(uploads|img|files|whiteboards)\//;
const REMEMBERED = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31_536_000 } as const;
const LAUNCH_COOKIE = "jotdown-launch";
const LOOPBACK = /^(127\.0\.0\.1|localhost)(:\d+)?$/;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const refused = appGuard(request);
  if (refused) return refused;
  if (crossSiteWrite(request)) return new NextResponse(null, { status: 403 });
  if (request.headers.has(PROJECT_HEADER)) return NextResponse.next();

  const mount = projectMount(pathname);
  if (!mount && UPLOADS.test(pathname)) return uploadFromReferer(request);
  if (!mount) return NextResponse.next({ request: { headers: forwarded(request, null) } });

  const inside = mount.rest;
  const response = NextResponse.rewrite(
    new URL((UPLOADS.test(inside) ? `/api/project-assets${inside}` : inside) + search, request.url),
    { request: { headers: forwarded(request, mount.key) } },
  );

  if (isPageView(request, inside)) response.cookies.set(PROJECT_COOKIE, mount.key, REMEMBERED);
  return response;
}

/**
 * Lets only the desktop app's own window in, when the studio runs inside the app, or nothing at all otherwise.
 *
 * The app opens its window with the launch secret in the address. That one
 * request trades it for an `HttpOnly`, `SameSite=Strict` cookie and comes back
 * without it, and any later request without the cookie is refused, so another
 * program on this machine, or a page in a browser, cannot drive the studio. A
 * `Host` other than loopback is refused too, which is what stops a rebound DNS
 * name from reaching it. The health check stays open for the app to poll.
 *
 * @example appGuard(request); // null when the request may go on
 */
function appGuard(request: NextRequest) {
  const secret = env.JOTDOWN_LAUNCH_SECRET;
  if (!secret) return null;
  if (!LOOPBACK.test(request.headers.get("host") ?? "")) return new NextResponse(null, { status: 421 });
  if (request.nextUrl.pathname === "/api/health") return null;

  const launch = request.nextUrl.searchParams.get("launch");
  if (launch !== null) {
    if (!sameSecret(launch, secret)) return new NextResponse(null, { status: 403 });

    const address = request.nextUrl.clone();
    address.searchParams.delete("launch");
    const response = NextResponse.redirect(address);
    response.cookies.set(LAUNCH_COOKIE, secret, { httpOnly: true, sameSite: "strict", path: "/" });
    return response;
  }

  const cookie = request.cookies.get(LAUNCH_COOKIE)?.value ?? "";
  return sameSecret(cookie, secret) ? null : new NextResponse("Open Jotdown from its app.", { status: 403 });
}

/**
 * Compares two secrets in constant time, by their hashes so their lengths never leak.
 *
 * @example sameSecret("a", "a"); // true
 */
function sameSecret(supplied: string, expected: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}

/**
 * Whether a request would change something on behalf of another site.
 *
 * A browser names the page's origin on every request that is not a plain read,
 * so one naming a different host, or `null` for a sandboxed frame, was sent by
 * another site. A request naming none came from a program, not a web page.
 *
 * @example crossSiteWrite(new NextRequest("http://localhost:6192/api/x", { method: "POST", headers: { origin: "https://evil.example" } })); // true
 */
function crossSiteWrite(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") return false;

  const origin = request.headers.get("origin");
  if (origin === null) return false;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return URL.parse(origin)?.host !== host;
}

/** The request's headers as the routes get them, naming the project only when the proxy read it off the address. */
function forwarded(request: NextRequest, key: string | null) {
  const headers = new Headers(request.headers);
  if (key) headers.set(PROJECT_HEADER, key);
  else headers.delete(PROJECT_HEADER);
  return headers;
}

/**
 * Sends an upload asked for from the site root to the same address under the asking page's project.
 *
 * Only the referring page's path matters, since that is where the project is
 * named. The redirect goes back to the page's own origin, so the browser stays
 * on whichever host it reached the studio by.
 *
 * @example uploadFromReferer(request); // /img/docs/a.png asked by /you/notes/setup: 307 to /you/notes/img/docs/a.png
 */
function uploadFromReferer(request: NextRequest) {
  const referer = URL.parse(request.headers.get("referer") ?? "");
  const mount = referer && projectMount(referer.pathname);
  if (!mount) return new NextResponse(null, { status: 404 });

  const { pathname, search } = request.nextUrl;
  const response = NextResponse.redirect(new URL(`/${mount.key}${pathname}${search}`, referer), 307);
  response.headers.set("cache-control", "no-store");
  return response;
}

/** Whether a request is somebody reading a page, which is what makes a project the one this browser last had open. */
function isPageView(request: NextRequest, inside: string) {
  return (
    request.method === "GET" &&
    !inside.startsWith("/api/") &&
    !UPLOADS.test(inside) &&
    request.headers.get("sec-fetch-dest") === "document"
  );
}
