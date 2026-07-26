import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

function safeRelativePath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function safeNext(incoming: URL) {
  const direct = safeRelativePath(incoming.searchParams.get("next"));
  if (direct) return direct;

  // GeoStats-branded token-hash email templates pass the original redirect
  // URL back through this endpoint. Only accept its nested destination when it
  // belongs to the same public origin, then reduce it to a relative path.
  const redirectTo = incoming.searchParams.get("redirect_to");
  if (redirectTo) {
    try {
      const redirect = new URL(redirectTo);
      if (redirect.origin === incoming.origin || redirect.hostname === "geostats.xyz" || redirect.hostname.endsWith(".vercel.app")) {
        return safeRelativePath(redirect.searchParams.get("next")) ?? "/daily";
      }
    } catch {
      // Invalid nested redirects fail closed to the default Daily route.
    }
  }
  return "/daily";
}

function redirectOrigin(request: Request, origin: string) {
  if (process.env.NODE_ENV === "development") return origin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  return forwardedHost ? `https://${forwardedHost}` : origin;
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const next = safeNext(incoming);
  const origin = redirectOrigin(request, incoming.origin);
  const queryError = incoming.searchParams.get("error_description") || incoming.searchParams.get("error");

  if (queryError) {
    const errorUrl = new URL("/auth/complete", origin);
    errorUrl.searchParams.set("error", queryError.replace(/\+/g, " "));
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const errorUrl = new URL("/auth/complete", origin);
    errorUrl.searchParams.set("error", "Supabase authentication is not configured.");
    return NextResponse.redirect(errorUrl);
  }

  try {
    const code = incoming.searchParams.get("code");
    const tokenHash = incoming.searchParams.get("token_hash");
    const otpType = incoming.searchParams.get("type");

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (tokenHash && otpType) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType as "email" | "magiclink" | "recovery" | "invite" | "email_change",
      });
      if (error) throw error;
    } else {
      throw new Error("The sign-in link did not contain a valid authentication code. Request a new link and try again.");
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw userError || new Error("GeoStats could not confirm the signed-in account.");
    }

    // exchangeCodeForSession/verifyOtp writes the access and refresh tokens to
    // persistent cookies before this redirect. The browser and server therefore
    // see the same session after a tab or browser restart.
    return NextResponse.redirect(new URL(next, origin));
  } catch (caught) {
    const errorUrl = new URL("/auth/complete", origin);
    errorUrl.searchParams.set(
      "error",
      caught instanceof Error ? caught.message : "GeoStats could not complete sign-in.",
    );
    return NextResponse.redirect(errorUrl);
  }
}
