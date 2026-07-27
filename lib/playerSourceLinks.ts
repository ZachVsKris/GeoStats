import type { Category, DataSourceId } from "./categories";

export type PlayerSourceStatus = "pending" | "exact" | "general" | "needs_exact_url" | "invalid" | "unavailable";

const RAW_OR_DOWNLOAD_EXTENSION = /\.(?:csv|tsv|json|xml|zip|gz|gzip|xlsx?|parquet)(?:$|[?#])/i;
const RAW_OR_DOWNLOAD_PATH = /\/(?:api|bulk|download|downloads)(?:\/|$)/i;
const RAW_OR_DOWNLOAD_QUERY = /(?:^|[?&])(?:format|download|output|type)=(?:csv|tsv|json|xml|zip|xlsx?|parquet)(?:&|$)/i;
const FORCED_DOWNLOAD_QUERY = /(?:^|[?&])(?:download|attachment)=/i;
const RAW_HOST = /(^|\.)(?:api|comtradeapi)\./i;

export function isHumanReadableExternalUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (RAW_HOST.test(url.hostname)) return false;
    const complete = `${url.pathname}${url.search}${url.hash}`;
    if (RAW_OR_DOWNLOAD_EXTENSION.test(complete)) return false;
    if (RAW_OR_DOWNLOAD_PATH.test(url.pathname)) return false;
    if (RAW_OR_DOWNLOAD_QUERY.test(url.search)) return false;
    if (FORCED_DOWNLOAD_QUERY.test(url.search)) return false;
    return true;
  } catch {
    return false;
  }
}

export function worldBankPlayerSourceUrl(indicator: string) {
  return `https://data.worldbank.org/indicator/${encodeURIComponent(indicator)}`;
}

export function sourceSpecificLinkLooksExact(source: DataSourceId, indicator: string, value: string | null | undefined) {
  if (!isHumanReadableExternalUrl(value)) return false;
  const url = new URL(value!);
  const decoded = decodeURIComponent(`${url.pathname}${url.search}${url.hash}`).toLowerCase();
  const expected = indicator.toLowerCase();
  if (source === "worldbank") {
    return url.hostname === "data.worldbank.org" && decoded.includes(`/indicator/${expected}`);
  }
  if (source === "unesco") {
    return url.hostname === "databrowser.uis.unesco.org" && url.pathname.startsWith("/browser/") && decoded.includes(expected);
  }
  // Other providers require a successful server-side player-link audit. A
  // generic dataset landing page is never promoted to an exact player link.
  return false;
}

export function hasUsablePlayerSourceStatus(status: string | null | undefined) {
  return status === "exact" || status === "general";
}

export function resolvePlayerSourceUrl(category: Pick<Category, "source" | "indicator" | "playerSourceUrl" | "playerSourceStatus" | "sourcePageUrl" | "sourceUrl" | "methodologyUrl">) {
  if (hasUsablePlayerSourceStatus(category.playerSourceStatus) && isHumanReadableExternalUrl(category.playerSourceUrl)) {
    return category.playerSourceUrl;
  }
  if (category.source === "worldbank") return worldBankPlayerSourceUrl(category.indicator);
  for (const candidate of [category.sourcePageUrl, category.sourceUrl, category.methodologyUrl]) {
    if (isHumanReadableExternalUrl(candidate)) return candidate!;
  }
  return null;
}
