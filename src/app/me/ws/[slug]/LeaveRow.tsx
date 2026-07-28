'use client'

import { en } from "@/locales/en";
import { leaveDays } from "./helpers";
import type { LeaveRequestWithType } from "./types";

export function LeaveRow({ request: leaveRequest, todayKey }: { request: LeaveRequestWithType; todayKey: string }) {
  const isPast = leaveRequest.end_date < todayKey;
  const isUpcoming = leaveRequest.start_date > todayKey;
  const isActive = !isPast && !isUpcoming;
  const totalDays = leaveDays(leaveRequest.start_date, leaveRequest.end_date);
  const [startYear, startMonth, startDay] = leaveRequest.start_date.split("-").map(Number);
  const [endYear, endMonth, endDay] = leaveRequest.end_date.split("-").map(Number);
  const formattedStart = new Date(startYear, startMonth - 1, startDay).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
  const formattedEnd = new Date(endYear, endMonth - 1, endDay).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dateLabel = leaveRequest.start_date === leaveRequest.end_date ? formattedEnd : `${formattedStart} – ${formattedEnd}`;

  return (
    <div
      style={{
        padding: "11px 16px",
        borderBottom: "1px solid var(--border)",
        background: isActive ? "rgba(0,212,170,0.04)" : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            color: isPast ? "var(--text-muted)" : "var(--text-primary)",
          }}
        >
          {leaveRequest.leave_type_name}
        </span>
        <span
          style={{
            fontSize: "11px",
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            color: isPast ? "var(--text-muted)" : isActive ? "var(--teal)" : "var(--brand)",
            background: isPast
              ? "var(--surface-2)"
              : isActive
                ? "rgba(0,212,170,0.12)"
                : "rgba(27,77,255,0.1)",
            padding: "2px 8px",
            borderRadius: "20px",
            whiteSpace: "nowrap",
          }}
        >
          {en.meWsToday.leaveDaysLabel(totalDays)}
        </span>
      </div>
      <div
        style={{
          fontFamily: "DM Sans, sans-serif",
          fontSize: "12px",
          color: isPast ? "var(--text-muted)" : "var(--text-secondary)",
          marginTop: "2px",
        }}
      >
        {dateLabel}
      </div>
      {leaveRequest.reason && (
        <div
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "12px",
            color: "var(--text-muted)",
            marginTop: "2px",
            fontStyle: "italic",
          }}
        >
          {leaveRequest.reason}
        </div>
      )}
      {leaveRequest.status === "rejected" && leaveRequest.rejection_reason && (
        <div
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "12px",
            color: "var(--danger)",
            marginTop: "2px",
            fontStyle: "italic",
          }}
        >
          {en.meWsToday.leaveRejectedPrefix} {leaveRequest.rejection_reason}
        </div>
      )}
      <div style={{ marginTop: "4px" }}>
        <span
          style={{
            display: "inline-block",
            fontSize: "11px",
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            padding: "1px 7px",
            borderRadius: "20px",
            color:
              leaveRequest.status === "approved"
                ? "var(--teal)"
                : leaveRequest.status === "rejected"
                  ? "var(--danger)"
                  : "var(--amber)",
            background:
              leaveRequest.status === "approved"
                ? "rgba(0,212,170,0.12)"
                : leaveRequest.status === "rejected"
                  ? "rgba(239,68,68,0.1)"
                  : "rgba(245,158,11,0.12)",
          }}
        >
          {leaveRequest.status === "approved"
            ? en.meWsToday.leaveStatusApproved
            : leaveRequest.status === "rejected"
              ? en.meWsToday.leaveStatusRejected
              : en.meWsToday.leaveStatusPending}
        </span>
      </div>
    </div>
  );
}
