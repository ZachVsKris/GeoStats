import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { internalTesterAccess } from "../../lib/supabase/internalTester";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function RandomLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await internalTesterAccess();
  if (!access.ok) redirect("/daily");
  return children;
}
