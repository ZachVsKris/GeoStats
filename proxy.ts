import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function legacyRandomPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const redirects: Record<string, string> = {
    "/seeded": "/random",
    "/seeded/easy": "/random/scout",
    "/seeded/scout": "/random/scout",
    "/seeded/normal": "/random/adventurer",
    "/seeded/adventurer": "/random/adventurer",
    "/seeded/expert": "/random/expert",
    "/test": "/random",
    "/test/easy": "/random/scout",
    "/test/normal": "/random/adventurer",
    "/test/expert": "/random/expert",
  };
  return redirects[normalized] ?? null;
}

export async function proxy(request: NextRequest) {
  const legacyPath = legacyRandomPath(request.nextUrl.pathname);
  if (legacyPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = legacyPath;
    return NextResponse.redirect(redirectUrl, 308);
  }

  // Send a bare homepage visit to the default Scout Daily.
  if (request.nextUrl.pathname === "/" && request.nextUrl.search === "") {
    return NextResponse.redirect(new URL("/daily", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          supabaseResponse.headers.set(name, value),
        );
      },
    },
  });

  // This validates and refreshes the session. Do not put work between client
  // creation and this call, and return the same response so refreshed cookies
  // are not lost.
  await supabase.auth.getUser();
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
