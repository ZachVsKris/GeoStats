export type GoogleProviderStatus = "checking" | "enabled" | "disabled" | "unknown";

export async function checkGoogleProvider(url: string | undefined, key: string | undefined,
  fetcher: typeof fetch = fetch): Promise<GoogleProviderStatus> {
  if (!url || !key) return "unknown";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(`${url}/auth/v1/settings`, {
      headers: { apikey: key }, signal: controller.signal,
    });
    if (!response.ok) return "unknown";
    const settings = await response.json() as { external?: { google?: boolean } };
    return settings.external?.google === true ? "enabled"
      : settings.external?.google === false ? "disabled" : "unknown";
  } catch { return "unknown"; }
  finally { clearTimeout(timeout); }
}
