/**
 * Answers 200 for as long as the process accepts HTTP and Next is routing.
 *
 * This is the path a load balancer health check points at, so `proxy.ts` lets
 * it through without a sign-in. It probes nothing downstream, not even GitHub,
 * and says nothing about the deploy, because anyone on the network can read it.
 */
export async function GET() {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}

export const dynamic = "force-dynamic";
