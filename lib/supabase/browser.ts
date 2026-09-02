import { createBrowserClient } from "@supabase/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserClient | null | undefined;

export function createSupabaseBrowserClient() {
  if (browserClient !== undefined) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    browserClient = null;
    return browserClient;
  }

  browserClient = createBrowserClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}
