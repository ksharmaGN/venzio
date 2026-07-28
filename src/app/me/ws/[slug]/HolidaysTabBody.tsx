'use client'

import { en } from "@/locales/en";
import { formatDate } from "./helpers";
import type { Holiday } from "./types";

export function HolidaysTabBody({ loading, holidays, todayKey }: { loading: boolean; holidays: Holiday[]; todayKey: string }) {
  if (loading) {
    return (
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                height: "14px",
                width: `${100 + i * 30}px`,
                borderRadius: "6px",
                background: "var(--surface-2)",
                animation:
                  "vnz-pulse 1.5s ease-in-out infinite",
              }}
            />
            <div
              style={{
                height: "12px",
                width: "80px",
                borderRadius: "6px",
                background: "var(--surface-2)",
                animation:
                  "vnz-pulse 1.5s ease-in-out infinite",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (holidays.length === 0) {
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
        {en.meWsToday.emptyNoHolidaysConfigured(
          new Date().getFullYear(),
        )}
      </p>
    );
  }

  return (
    <>
      {holidays.map((h, idx) => {
        const isPast = h.date < todayKey;
        const isToday = h.date === todayKey;
        const { display, dayName } = formatDate(h.date);
        return (
          <div
            key={h.id}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "11px 16px",
              borderTop:
                idx === 0 ? "none" : "1px solid var(--border)",
              background: isToday
                ? "rgba(0, 212, 170, 0.06)"
                : "transparent",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "13px",
                  fontWeight: isToday ? 600 : 500,
                  color: isPast
                    ? "var(--text-muted)"
                    : isToday
                      ? "var(--teal)"
                      : "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "block",
                }}
              >
                {h.name}
                {isToday && (
                  <span
                    style={{
                      marginLeft: "6px",
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "var(--teal)",
                      background: "rgba(0,212,170,0.12)",
                      padding: "1px 6px",
                      borderRadius: "99px",
                      verticalAlign: "middle",
                    }}
                  >
                    {en.meWsToday.badgeToday}
                  </span>
                )}
              </span>
            </div>
            <div
              style={{
                marginLeft: "12px",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "12px",
                  color: isPast
                    ? "var(--text-muted)"
                    : isToday
                      ? "var(--teal)"
                      : "var(--brand)",
                }}
              >
                {display}
              </span>
              <span
                style={{
                  marginLeft: "5px",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "11px",
                  color: isPast
                    ? "var(--border)"
                    : isToday
                      ? "rgba(0,212,170,0.7)"
                      : "var(--brand)",
                }}
              >
                {dayName}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}
