import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const EVENTS = new Set([
  "page_view", "game_started", "game_completed", "share_clicked",
  "source_opened", "account_username_saved", "account_signin_requested",
  "account_gate_opened",
]);
const DIFFICULTIES = new Set(["easy", "normal", "expert"]);

type Payload = {
  eventName?: string;
  sessionId?: string;
  path?: string;
  difficulty?: string;
  challengeDate?: string;
  value?: number;
  metadata?: Record<string, unknown>;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  visitorState?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Payload | null;
  if (!body || !body.eventName || !EVENTS.has(body.eventName)) {
    return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });
  }
  const sessionId = String(body.sessionId ?? "").trim();
  if (sessionId.length < 8 || sessionId.length > 80) {
    return NextResponse.json({ error: "Invalid analytics session." }, { status: 400 });
  }
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  if (JSON.stringify(metadata).length > 3000) {
    return NextResponse.json({ error: "Analytics metadata is too large." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return new NextResponse(null, { status: 204 });
  const auth = await createSupabaseServerClient();
  const userResult = auth ? await auth.auth.getUser() : null;
  const user = userResult?.data.user ?? null;
  const difficulty = body.difficulty && DIFFICULTIES.has(body.difficulty) ? body.difficulty : null;
  const challengeDate = /^\d{4}-\d{2}-\d{2}$/.test(body.challengeDate ?? "") ? body.challengeDate : null;
  const value = typeof body.value === "number" && Number.isFinite(body.value) ? body.value : null;

  const { error } = await admin.from("analytics_events").insert({
    event_name: body.eventName,
    session_id: sessionId,
    user_id: user?.id ?? null,
    path: String(body.path ?? "").slice(0, 240) || null,
    difficulty,
    challenge_date: challengeDate,
    value,
    metadata,
    referrer: String(body.referrer ?? "").slice(0, 160) || null,
    utm_source: String(body.utmSource ?? "").slice(0, 160) || null,
    utm_medium: String(body.utmMedium ?? "").slice(0, 160) || null,
    utm_campaign: String(body.utmCampaign ?? "").slice(0, 160) || null,
    visitor_state: body.visitorState === "returning" ? "returning" : body.visitorState === "new" ? "new" : null,
  });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /analytics_events/i.test(error.message) && /not find|does not exist/i.test(error.message)) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
