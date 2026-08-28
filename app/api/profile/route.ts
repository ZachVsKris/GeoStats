import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const RESERVED = new Set(["admin", "administrator", "geostats", "geo_stats", "moderator", "official", "support", "system"]);
const BLOCKED_USERNAME_TOKENS = [
  "nigger", "nigga", "faggot", "kike", "chink", "spic", "cunt", "fuck", "shit", "whore",
];

function normalizedModerationText(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");
}

function usernamePassesModeration(value: string) {
  const normalized = normalizedModerationText(value);
  return !BLOCKED_USERNAME_TOKENS.some((token) => normalized.includes(token));
}

type ProfileRow = {
  username: string;
  display_name: string | null;
  username_customized?: boolean | null;
};

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "Accounts are not configured." }, { status: 503 }) } as const;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) } as const;
  return { supabase, user } as const;
}

async function readProfile(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  if (!supabase) return null;
  let result = await supabase
    .from("profiles")
    .select("username,display_name,username_customized")
    .eq("id", userId)
    .maybeSingle();

  // This fallback keeps the account UI usable while an owner is applying the
  // v13.5 migration. Once migrated, username_customized is authoritative.
  if (result.error && /username_customized/i.test(result.error.message)) {
    result = await supabase
      .from("profiles")
      .select("username,display_name")
      .eq("id", userId)
      .maybeSingle() as typeof result;
  }
  if (result.error) throw result.error;
  return result.data as ProfileRow | null;
}

export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  try {
    const profile = await readProfile(auth.supabase, auth.user.id);
    return NextResponse.json({
      signedIn: true,
      email: auth.user.email ?? null,
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
      usernameCustomized: profile?.username_customized ?? false,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Profile could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null) as { username?: string } | null;
  const username = body?.username?.trim();
  if (!username || !USERNAME_PATTERN.test(username)) {
    return NextResponse.json({ error: "Use 3–20 letters, numbers, or underscores." }, { status: 400 });
  }
  if (RESERVED.has(username.toLowerCase())) {
    return NextResponse.json({ error: "That username is reserved. Choose another." }, { status: 400 });
  }
  if (!usernamePassesModeration(username)) {
    return NextResponse.json({ error: "That username is not available. Choose another." }, { status: 400 });
  }

  // Check case-insensitively so Player and player cannot impersonate each other.
  const { data: taken, error: lookupError } = await auth.supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .neq("id", auth.user.id)
    .limit(1);
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if ((taken ?? []).length) return NextResponse.json({ error: "That username is taken." }, { status: 409 });

  let result = await auth.supabase
    .from("profiles")
    .update({ username, username_customized: true, updated_at: new Date().toISOString() })
    .eq("id", auth.user.id);

  // Graceful pre-migration fallback. The v13.5 SQL should still be applied so
  // new users are prompted exactly once rather than on every visit.
  if (result.error && /username_customized/i.test(result.error.message)) {
    result = await auth.supabase
      .from("profiles")
      .update({ username, updated_at: new Date().toISOString() })
      .eq("id", auth.user.id);
  }
  if (result.error) {
    return NextResponse.json({ error: result.error.code === "23505" ? "That username is taken." : result.error.message }, { status: 400 });
  }
  return NextResponse.json({ saved: true, username, usernameCustomized: true });
}
