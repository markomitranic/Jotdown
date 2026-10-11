import type { MetadataRoute } from "next";

/**
 * Keeps every crawler off the site, which is internal and sits behind SSO.
 *
 * `proxy.ts` lets `/robots.txt` through unauthenticated, because a crawler that
 * gets a redirect to the login page instead of the file treats the site as
 * having no policy at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}

export const dynamic = "force-static";
