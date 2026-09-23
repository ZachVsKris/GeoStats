import { redirect } from "next/navigation";

// Keep saved scores and standings code available for a future relaunch.
export default function LeaderboardPage() {
  redirect("/daily");
}
