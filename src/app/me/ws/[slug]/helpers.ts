import { resolvePresenceTag } from "@/lib/client/presence";
import type { MemberTodaySummary } from "@/app/api/me/ws/[slug]/today/route";
import type { MemberDisplayStatus } from "./types";

export function resolveMemberDisplayStatus(m: MemberTodaySummary): MemberDisplayStatus {
  if (m.presence_status === "notIn") return "not_in";
  if (m.presence_status === "visited") return "remote";
  const tag = resolvePresenceTag(m.presence_status, m.matched_by, m.event_type);
  return tag === "in_office" ? "in_office" : "remote";
}

export function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function formatDate(dateStr: string): { display: string; dayName: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    display: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    dayName: date.toLocaleDateString("en-IN", { weekday: "short" }),
  };
}

export function leaveDays(start: string, end: string): number {
  return (
    Math.floor(
      (new Date(end + "T00:00:00Z").getTime() -
        new Date(start + "T00:00:00Z").getTime()) /
        86400000,
    ) + 1
  );
}
