'use client'

import type { MemberTodaySummary } from "@/app/api/me/ws/[slug]/today/route";
import { PRESENCE_TAG_CONFIG } from "@/lib/client/presence";
import { en } from "@/locales/en";
import { resolveMemberDisplayStatus } from "./helpers";
import { Avatar } from "./Avatar";

export function MemberRow({ m }: { m: MemberTodaySummary }) {
  const status = resolveMemberDisplayStatus(m);
  const cfg =
    status === "not_in"
      ? PRESENCE_TAG_CONFIG["not_in"]
      : status === "remote"
        ? { label: en.meWsToday.badgeRemote, color: "var(--amber)" }
        : PRESENCE_TAG_CONFIG["in_office"];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Avatar name={m.full_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {m.full_name ?? m.email}
        </p>
      </div>
      <span
        style={{
          fontSize: "11px",
          fontFamily: "DM Sans, sans-serif",
          fontWeight: 600,
          color: cfg.color,
          background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
          padding: "2px 8px",
          borderRadius: "20px",
          border: `1px solid ${cfg.color}`,
          whiteSpace: "nowrap",
        }}
      >
        {cfg.label}
      </span>
    </div>
  );
}
