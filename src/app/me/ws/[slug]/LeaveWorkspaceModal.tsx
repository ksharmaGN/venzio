'use client'

import { createPortal } from "react-dom";
import { en } from "@/locales/en";

export function LeaveWorkspaceModal({
  workspaceName, loading, error, onCancel, onConfirm,
}: {
  workspaceName: string
  loading: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
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
        if (!loading) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-ws-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "20px",
          margin: "auto",
        }}
      >
        <h2
          id="leave-ws-title"
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--navy)",
            margin: "0 0 12px",
          }}
        >
          {en.meWsToday.leaveWorkspaceTitle}
        </h2>
        <p
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "14px",
            color: "var(--text-secondary)",
            margin: "0 0 16px",
            lineHeight: 1.5,
          }}
        >
          {en.meWsToday.leaveWorkspaceMessage(workspaceName)}
        </p>
        {error && (
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              color: "var(--danger)",
              margin: "0 0 12px",
            }}
          >
            {error}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
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
              cursor: loading ? "default" : "pointer",
            }}
          >
            {en.meWsToday.leaveWorkspaceCancel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            style={{
              height: "44px",
              padding: "0 16px",
              border: "none",
              borderRadius: "var(--radius-md)",
              background: "var(--danger)",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading
              ? en.meWsToday.leaveWorkspaceLoading
              : en.meWsToday.leaveWorkspaceConfirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
