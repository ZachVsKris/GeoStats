import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) return NextResponse.json({ error: "Submit the report from GeoStats." }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 5000) return NextResponse.json({ error: "Report is too long." }, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid report." }, { status: 400 }); }
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!['data','bug','other'].includes(body?.kind) || message.length < 10 || message.length > 1500) return NextResponse.json({ error: "Describe the problem in 10–1,500 characters." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Reports are temporarily unavailable. Please try again later." }, { status: 503 });
  const auth = await createSupabaseServerClient();
  const identity = auth ? await auth.auth.getClaims() : null;
  // Vercel supplies this header; no raw network address is stored.
  const network = request.headers.get("x-vercel-forwarded-for")?.split(',')[0]?.trim() || "unknown";
  const rateKey = createHash('sha256').update(`${process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'geostats'}:${network}`).digest('hex');
  const { error } = await admin.rpc('submit_player_report_v1', {
    p_kind: body.kind, p_message: message,
    p_category_id: typeof body.categoryId === 'string' ? body.categoryId.slice(0,200) : null,
    p_challenge_date: /^\d{4}-\d{2}-\d{2}$/.test(body.challengeDate ?? '') ? body.challengeDate : null,
    p_difficulty: ['easy','normal','expert'].includes(body.difficulty) ? body.difficulty : null,
    p_page_path: typeof body.path === 'string' && body.path.startsWith('/') && !body.path.startsWith('//') ? body.path.split(/[?#]/)[0].slice(0,240) : '/daily',
    p_user_id: identity?.data?.claims?.sub ?? null, p_rate_key: rateKey,
  });
  if (error) return NextResponse.json({ error: error.message.includes('report_rate_limit') ? "You’ve sent several reports. Please try again in an hour." : "Your report could not be saved. Please try again." }, { status: error.message.includes('report_rate_limit') ? 429 : 503 });
  return NextResponse.json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
}
