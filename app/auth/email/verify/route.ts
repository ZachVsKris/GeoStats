import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { safeRelativePath } from "../../../../lib/authRedirect";
import { friendlyAuthError } from "../../../../lib/authErrors";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const fail = (message: string) => {
    const url = new URL("/auth/complete", origin);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  };
  // Prevent another site from posting an attacker's login link into this browser.
  if (request.headers.get("origin") !== origin) return fail("Open your GeoStats email link and confirm sign-in from that page.");
  try {
    const form = await request.formData();
    const token = form.get("token_hash");
    const type = form.get("type");
    if (typeof token !== "string" || !/^[a-zA-Z0-9_-]{20,512}$/.test(token) || (type !== "email" && type !== "recovery")) {
      return fail("This sign-in link is invalid. Return to GeoStats and request a new one.");
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) return fail("Email sign-in is temporarily unavailable. Please try again later.");
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type });
    if (error) throw error;
    if (!data.user || !data.session) throw new Error("Missing authenticated session");
    const next = form.get("next");
    const destination = new URL(safeRelativePath(typeof next === "string" ? next : null, origin) || "/daily", origin);
    // Do not send one-time credentials back through an auth route.
    if (destination.pathname.startsWith("/auth/")) destination.pathname = "/daily";
    destination.searchParams.set("auth", "success");
    const createdAt = Date.parse(data.user.created_at);
    destination.searchParams.set("account", Number.isFinite(createdAt) && Date.now() - createdAt < 300_000 ? "new" : "returning");
    return NextResponse.redirect(destination, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    return fail(friendlyAuthError(error));
  }
}
