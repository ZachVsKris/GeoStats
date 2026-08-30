"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackAnalytics } from "../lib/analytics";

export default function AnalyticsPageView() {
  const pathname = usePathname();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authenticated = params.get("auth") === "success";
    const accountState = params.get("account") === "new" ? "new" : "returning";
    if (authenticated) {
      params.delete("auth");
      params.delete("account");
      const search = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
    }
    trackAnalytics("page_view");
    if (authenticated) trackAnalytics("account_authenticated", { metadata: { accountState } });
  }, [pathname]);
  return null;
}
