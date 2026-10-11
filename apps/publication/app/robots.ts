import type { MetadataRoute } from "next";

/** Keeps every crawler off the site. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}

export const dynamic = "force-static";
