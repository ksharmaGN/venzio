'use client'

import { en } from "@/locales/en";
import { Avatar } from "./Avatar";
import type { MemberOnLeaveToday } from "./types";

export function OnLeaveTabBody({ loading, members }: { loading: boolean; members: MemberOnLeaveToday[] }) {
  if (loading) {
    return (
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {[1, 2].map((i) => (
          <div key={i} style={{ height: "52px", borderRadius: "var(--radius-md)", background: "var(--surface-2)", animation: "vnz-pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <p style={{ padding: "16px", fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
        {en.meWsToday.onLeaveEmpty}
      </p>
    );
  }

  return (
    <div>
      {members.map((m) => (
        <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <Avatar name={m.full_name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
              {m.full_name ?? m.email}
            </p>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
              {m.leave_type_name}
            </p>
          </div>
          <span style={{ fontSize: "11px", fontFamily: "DM Sans, sans-serif", fontWeight: 600, color: "var(--danger)", background: "color-mix(in srgb, var(--danger) 12%, transparent)", padding: "2px 8px", borderRadius: "20px", border: "1px solid var(--danger)", whiteSpace: "nowrap" }}>
            {en.meWsToday.onLeaveBadgeLabel}
          </span>
        </div>
      ))}
    </div>
  );
}
