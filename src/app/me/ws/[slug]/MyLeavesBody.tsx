'use client'

import { en } from "@/locales/en";
import { SectionLabel } from "./SectionLabel";
import { LeaveRow } from "./LeaveRow";
import type { LeaveRequestWithType } from "./types";

export function MyLeavesBody({
  leaves,
  loading,
  todayKey,
}: {
  leaves: LeaveRequestWithType[];
  loading: boolean;
  todayKey: string;
}) {
  if (loading) {
    return (
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {[1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: "52px",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-2)",
              animation: "vnz-pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (leaves.length === 0) {
    return (
      <p
        style={{
          padding: "16px",
          fontFamily: "DM Sans, sans-serif",
          fontSize: "13px",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        {en.meWsToday.myLeavesEmpty}
      </p>
    );
  }

  const active   = leaves.filter((r) => r.start_date <= todayKey && r.end_date >= todayKey);
  const upcoming = leaves.filter((r) => r.start_date > todayKey);
  const past     = leaves.filter((r) => r.end_date < todayKey);

  return (
    <div>
      {active.length > 0 && (
        <>
          <SectionLabel label={en.meWsToday.myLeavesActive} />
          {active.map((r) => (
            <LeaveRow key={r.id} request={r} todayKey={todayKey} />
          ))}
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <SectionLabel label={en.meWsToday.myLeavesUpcoming} />
          {[...upcoming].reverse().map((r) => (
            <LeaveRow key={r.id} request={r} todayKey={todayKey} />
          ))}
        </>
      )}
      {past.length > 0 && (
        <>
          <SectionLabel label={en.meWsToday.myLeavesPast} />
          {past.map((r) => (
            <LeaveRow key={r.id} request={r} todayKey={todayKey} />
          ))}
        </>
      )}
    </div>
  );
}
