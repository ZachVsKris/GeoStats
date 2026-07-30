"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackAnalytics } from "../lib/analytics";

export default function AnalyticsPageView() {
  const pathname = usePathname();
  useEffect(() => {
    trackAnalytics("page_view");
  }, [pathname]);
  return null;
}
