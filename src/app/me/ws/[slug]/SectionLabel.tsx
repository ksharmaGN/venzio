'use client'

export function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "6px 16px",
        fontFamily: "DM Sans, sans-serif",
        fontSize: "11px",
        fontWeight: 700,
        color: "var(--text-muted)",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {label}
    </div>
  );
}
