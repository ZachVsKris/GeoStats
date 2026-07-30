import { newYorkDate } from "../../../../lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel invokes this once each day after midnight in New York. The route is
 * secured with CRON_SECRET and delegates to the same locked, validated Daily
 * endpoint used by players, so scheduled and on-demand generation cannot race.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const date = newYorkDate();
  const target = new URL(`/api/daily-trio/${date}`, request.url);
  const response = await fetch(target, { cache: "no-store" });
  const body = await response.json().catch(() => ({ error: "Daily generation returned an unreadable response." }));
  return Response.json({ date, upstreamStatus: response.status, ...body }, {
    status: response.ok || response.status === 202 ? 200 : response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
