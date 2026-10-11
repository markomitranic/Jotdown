import { RefusedAddress, previewOf } from "@/server/link-preview";

/**
 * `GET /api/link-preview?url=…`: the title, description, site, picture and icon a link embed shows.
 *
 * A page that cannot be read still answers, with the address alone. Only an
 * address the studio will not fetch is refused.
 */
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";

  try {
    return Response.json(await previewOf(url), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (!(error instanceof RefusedAddress)) throw error;
    return Response.json({ error: error.message }, { status: 422 });
  }
}

export const dynamic = "force-dynamic";
