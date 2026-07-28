'use client'

import { createPortal } from "react-dom";
import { en } from "@/locales/en";
import type { ApplyLeaveState, Holiday } from "./types";

export function ApplyLeaveModal({
  applyLeave, setApplyLeave, holidayWarning, onSubmit,
}: {
  applyLeave: ApplyLeaveState
  setApplyLeave: React.Dispatch<React.SetStateAction<ApplyLeaveState>>
  holidayWarning: Holiday[]
  onSubmit: () => void
}) {
  return createPortal(
    <div
      role="presentation"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        minHeight: "100dvh",
        zIndex: 1100,
        background: "rgba(13, 27, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
        overflow: "auto",
      }}
      onClick={() => {
        if (!applyLeave.submitting) setApplyLeave((prev) => ({ ...prev, open: false }));
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-leave-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "20px",
          margin: "auto",
        }}
      >
        <h2
          id="apply-leave-title"
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--navy)",
            margin: "0 0 20px",
          }}
        >
          {en.meWsToday.applyLeaveTitle}
        </h2>

        {applyLeave.success ? (
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "14px",
              color: "var(--teal)",
              textAlign: "center",
              padding: "20px 0",
            }}
          >
            {en.meWsToday.applyLeaveSuccess}
          </p>
        ) : applyLeave.typesLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: "44px",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-md)",
                  animation: "vnz-pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        ) : applyLeave.types.length === 0 ? (
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "14px",
              color: "var(--text-muted)",
              textAlign: "center",
              padding: "20px 0",
            }}
          >
            {en.meWsToday.applyLeaveNoTypes}
          </p>
        ) : (
          <>
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontFamily: "DM Sans, sans-serif",
                  color: "var(--text-secondary)",
                  marginBottom: "5px",
                }}
              >
                {en.meWsToday.applyLeaveFieldLeaveType}
              </label>
              <select
                value={applyLeave.selectedTypeId}
                onChange={(e) => setApplyLeave((prev) => ({ ...prev, selectedTypeId: e.target.value }))}
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "0 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "14px",
                  fontFamily: "DM Sans, sans-serif",
                  background: "var(--surface-2)",
                  color: "var(--text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                  cursor: "pointer",
                }}
              >
                <option value="">{en.meWsToday.applyLeaveSelectPlaceholder}</option>
                {applyLeave.types.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.available_days === 0}>
                    {en.meWsToday.applyLeaveTypeOption(t.name, t.available_days)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontFamily: "DM Sans, sans-serif",
                  color: "var(--text-secondary)",
                  marginBottom: "5px",
                }}
              >
                {en.meWsToday.applyLeaveFieldStartDate}
              </label>
              <input
                type="date"
                value={applyLeave.startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setApplyLeave((prev) => ({
                    ...prev,
                    startDate: val,
                    endDate: prev.endDate && val > prev.endDate ? val : prev.endDate,
                  }));
                }}
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "0 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "14px",
                  fontFamily: "DM Sans, sans-serif",
                  background: "var(--surface-2)",
                  color: "var(--text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontFamily: "DM Sans, sans-serif",
                  color: "var(--text-secondary)",
                  marginBottom: "5px",
                }}
              >
                {en.meWsToday.applyLeaveFieldEndDate}
              </label>
              <input
                type="date"
                value={applyLeave.endDate}
                min={applyLeave.startDate || undefined}
                onChange={(e) => setApplyLeave((prev) => ({ ...prev, endDate: e.target.value }))}
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "0 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "14px",
                  fontFamily: "DM Sans, sans-serif",
                  background: "var(--surface-2)",
                  color: "var(--text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {holidayWarning.length > 0 && (
              <div
                style={{
                  marginBottom: "14px",
                  padding: "10px 12px",
                  border: "1px solid var(--amber)",
                  borderRadius: "var(--radius-md)",
                  background: "color-mix(in srgb, var(--amber) 10%, transparent)",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "13px",
                  color: "var(--amber)",
                  lineHeight: 1.5,
                }}
              >
                {`⚠ Your dates include company holidays: ${holidayWarning.map((h) => h.name).join(", ")}. Please adjust your dates.`}
              </div>
            )}

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontFamily: "DM Sans, sans-serif",
                  color: "var(--text-secondary)",
                  marginBottom: "5px",
                }}
              >
                {en.meWsToday.applyLeaveFieldReason}
              </label>
              <textarea
                value={applyLeave.reason}
                onChange={(e) => setApplyLeave((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder={en.meWsToday.applyLeaveFieldReasonPlaceholder}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "14px",
                  fontFamily: "DM Sans, sans-serif",
                  background: "var(--surface-2)",
                  color: "var(--text-primary)",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {applyLeave.error && (
              <p
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "13px",
                  color: "var(--danger)",
                  margin: "0 0 12px",
                }}
              >
                {applyLeave.error}
              </p>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={applyLeave.submitting}
                onClick={() => setApplyLeave((prev) => ({ ...prev, open: false }))}
                style={{
                  height: "44px",
                  padding: "0 16px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "transparent",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  cursor: applyLeave.submitting ? "default" : "pointer",
                }}
              >
                {en.meWsToday.applyLeaveCancel}
              </button>
              <button
                type="button"
                disabled={applyLeave.submitting || !applyLeave.selectedTypeId || !applyLeave.startDate || !applyLeave.endDate || holidayWarning.length > 0}
                onClick={onSubmit}
                style={{
                  height: "44px",
                  padding: "0 16px",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  background: "var(--brand)",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#fff",
                  cursor: applyLeave.submitting || !applyLeave.selectedTypeId || !applyLeave.startDate || !applyLeave.endDate || holidayWarning.length > 0
                    ? "not-allowed"
                    : "pointer",
                  opacity: applyLeave.submitting || !applyLeave.selectedTypeId || !applyLeave.startDate || !applyLeave.endDate || holidayWarning.length > 0
                    ? 0.65
                    : 1,
                }}
              >
                {applyLeave.submitting ? en.meWsToday.applyLeaveSubmitting : en.meWsToday.applyLeaveSubmit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
