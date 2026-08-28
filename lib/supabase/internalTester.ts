import { createSupabaseAdminClient, createSupabaseServerClient } from "./server";

export async function internalTesterAccess() {
  const authClient = await createSupabaseServerClient();
  if (!authClient) return { ok: false as const, status: 503, error: "Supabase is not configured." };
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Sign in to continue." };
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false as const, status: 503, error: "The server admin key is not configured." };

  const tester = await admin.from("internal_testers").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!tester.error && tester.data) return { ok: true as const, user, admin };

  // Administrators retain QA access. This also makes the deploy fail safe while
  // PostgREST refreshes its schema cache immediately after the v16.2.6 migration.
  const legacyAdmin = await admin.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!legacyAdmin.error && legacyAdmin.data) return { ok: true as const, user, admin };
  return { ok: false as const, status: 403, error: "Random is an internal GeoStats QA tool." };
}
