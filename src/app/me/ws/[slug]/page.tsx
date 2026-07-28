"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { en } from "@/locales/en";
import type {
  WorkspaceTodayResponse,
  Holiday,
  LeaveTypeWithBalance,
  MemberOnLeaveToday,
  LeaveRequestWithType,
  AccordionTab,
  ApplyLeaveState,
} from "./types";
import { resolveMemberDisplayStatus, todayStr } from "./helpers";
import { MemberRow } from "./MemberRow";
import { ChevronIcon } from "./ChevronIcon";
import { MyLeavesBody } from "./MyLeavesBody";
import { HolidaysTabBody } from "./HolidaysTabBody";
import { OnLeaveTabBody } from "./OnLeaveTabBody";
import { LeaveWorkspaceModal } from "./LeaveWorkspaceModal";
import { ApplyLeaveModal } from "./ApplyLeaveModal";
import { TABS } from "./constants";

export default function WorkspaceTodayPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [data, setData] = useState<WorkspaceTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);

  const [openTab, setOpenTab] = useState<AccordionTab | null>(null);

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [modalPortalReady, setModalPortalReady] = useState(false);

  const [applyLeave, setApplyLeave] = useState<ApplyLeaveState>({
    open: false,
    types: [],
    typesLoading: false,
    selectedTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    submitting: false,
    error: null,
    success: false,
  });

  const [myLeavesState, setMyLeavesState] = useState<{ data: LeaveRequestWithType[]; loading: boolean }>({ data: [], loading: true });
  const [onLeaveTodayState, setOnLeaveTodayState] = useState<{ data: MemberOnLeaveToday[]; loading: boolean }>({ data: [], loading: true });

  useEffect(() => {
    setModalPortalReady(true);
  }, []);

  useEffect(() => {
    fetch(`/api/me/ws/${slug}/today`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(en.meWsToday.errorFailedToLoad);
        setLoading(false);
      });

    const year = new Date().getFullYear();
    fetch(`/api/me/ws/${slug}/holidays?year=${year}`)
      .then((r) => r.json())
      .then((d: { holidays: Holiday[] }) => { setHolidays(d.holidays); setHolidaysLoading(false); })
      .catch(() => setHolidaysLoading(false));

    fetch(`/api/me/ws/${slug}/leave-requests`)
      .then((r) => r.json())
      .then((d: { leaveRequests: LeaveRequestWithType[] }) => setMyLeavesState({ data: d.leaveRequests ?? [], loading: false }))
      .catch(() => setMyLeavesState((prev) => ({ ...prev, loading: false })));

    fetch(`/api/me/ws/${slug}/leave-requests/today`)
      .then((r) => r.json())
      .then((d: { members: MemberOnLeaveToday[] }) => setOnLeaveTodayState({ data: d.members ?? [], loading: false }))
      .catch(() => setOnLeaveTodayState((prev) => ({ ...prev, loading: false })));
  }, [slug]);

  function toggleTab(tab: AccordionTab) {
    setOpenTab((prev) => (prev === tab ? null : tab));
  }

  async function openApplyLeave() {
    setApplyLeave({ open: true, types: [], typesLoading: true, selectedTypeId: "", startDate: "", endDate: "", reason: "", submitting: false, error: null, success: false });
    try {
      const res = await fetch(`/api/me/ws/${slug}/leave-types`);
      if (res.ok) {
        const d = (await res.json()) as { leaveTypes: LeaveTypeWithBalance[] };
        setApplyLeave((prev) => ({ ...prev, types: d.leaveTypes ?? [] }));
      }
    } finally {
      setApplyLeave((prev) => ({ ...prev, typesLoading: false }));
    }
  }

  async function submitLeave() {
    if (!applyLeave.selectedTypeId || !applyLeave.startDate || !applyLeave.endDate) return;
    setApplyLeave((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const res = await fetch(`/api/me/ws/${slug}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leave_type_id: applyLeave.selectedTypeId,
          start_date: applyLeave.startDate,
          end_date: applyLeave.endDate,
          reason: applyLeave.reason || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setApplyLeave((prev) => ({ ...prev, success: true }));
        fetch(`/api/me/ws/${slug}/leave-requests`)
          .then((r) => r.json())
          .then((d: { leaveRequests: LeaveRequestWithType[] }) => setMyLeavesState({ data: d.leaveRequests ?? [], loading: false }))
          .catch(() => undefined);
        setTimeout(() => {
          setApplyLeave((prev) => ({ ...prev, open: false, success: false, submitting: false }));
        }, 2000);
      } else {
        setApplyLeave((prev) => ({ ...prev, error: body.error ?? en.meWsToday.applyLeaveErrorGeneric, submitting: false }));
      }
    } catch {
      setApplyLeave((prev) => ({ ...prev, error: en.meWsToday.applyLeaveErrorGeneric, submitting: false }));
    }
  }

  async function confirmLeaveWorkspace() {
    if (!data?.workspace.id) return;
    setLeaveLoading(true);
    setLeaveError(null);
    try {
      const res = await fetch(`/api/me/workspaces/${data.workspace.id}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (res.ok) {
        setLeaveModalOpen(false);
        router.push("/me");
        router.refresh();
        return;
      }
      if (body.code === "SOLE_ADMIN") {
        setLeaveError(en.meWsToday.leaveWorkspaceSoleAdmin);
      } else {
        setLeaveError(body.error ?? en.meWsToday.leaveWorkspaceError);
      }
    } catch {
      setLeaveError(en.meWsToday.leaveWorkspaceError);
    } finally {
      setLeaveLoading(false);
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  if (loading) {
    return (
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 16px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: "52px",
              background: "var(--surface-2)",
              borderRadius: "var(--radius-md)",
              marginBottom: "8px",
              animation: "vnz-pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
        <style>{`@keyframes vnz-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          padding: "48px 20px",
          textAlign: "center",
          fontFamily: "DM Sans, sans-serif",
          color: "var(--danger)",
        }}
      >
        {error ?? en.meWsToday.errorWorkspaceNotFound}
      </div>
    );
  }

  const inOffice = data.members.filter((m) => resolveMemberDisplayStatus(m) === "in_office");
  const remote   = data.members.filter((m) => resolveMemberDisplayStatus(m) === "remote");
  const checkedInIds = new Set([...inOffice, ...remote].map((m) => m.user_id));
  const onLeaveTodayFiltered = onLeaveTodayState.data.filter((m) => !checkedInIds.has(m.user_id));
  const onLeaveTodayIds = new Set(onLeaveTodayFiltered.map((m) => m.user_id));
  const notIn    = data.members.filter((m) => resolveMemberDisplayStatus(m) === "not_in" && !onLeaveTodayIds.has(m.user_id));

  const tabMembers = {
    office:   inOffice,
    remote:   remote,
    leave:    notIn,
    onLeave:  [],
    holidays: [],
    myLeaves: [],
  } as Record<AccordionTab, typeof inOffice>;

  const todayKey = todayStr();

  const holidayWarning = applyLeave.startDate && applyLeave.endDate
    ? holidays.filter((h) => h.date >= applyLeave.startDate && h.date <= applyLeave.endDate)
    : [];

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 16px" }}>
      <p
        style={{
          fontFamily: "DM Sans, sans-serif",
          fontSize: "12px",
          color: "var(--text-muted)",
          marginBottom: "4px",
        }}
      >
        {today}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        <h1
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--navy)",
            margin: 0,
            flex: 1,
            minWidth: 0,
          }}
        >
          {data.workspace.name}
        </h1>
        <button
          type="button"
          aria-label={en.meWsToday.applyLeaveButtonAria}
          title={en.meWsToday.applyLeaveButtonAria}
          onClick={() => void openApplyLeave()}
          style={{
            flexShrink: 0,
            height: "44px",
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            border: "1px solid var(--brand)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface-0)",
            color: "var(--brand)",
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="8" y1="14" x2="8" y2="14" />
            <line x1="8" y1="18" x2="8" y2="18" />
          </svg>
          {en.meWsToday.applyLeaveButtonText}
        </button>
        {data.viewerRole !== "admin" && (
          <button
            type="button"
            aria-label={en.meWsToday.leaveWorkspaceButtonAria}
            title={en.meWsToday.leaveWorkspaceButtonAria}
            onClick={() => {
              setLeaveError(null);
              setLeaveModalOpen(true);
            }}
            style={{
              flexShrink: 0,
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-0)",
              color: "var(--danger)",
              cursor: "pointer",
            }}
          >
            <LogOut size={20} strokeWidth={2.25} aria-hidden />
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {TABS.map((tab) => {
          const isOpen = openTab === tab.key;
          const count =
            tab.key === "holidays"
              ? holidays.length
              : tab.key === "myLeaves"
                ? myLeavesState.data.length
                : tab.key === "onLeave"
                  ? onLeaveTodayFiltered.length
                  : tabMembers[tab.key].length;

          return (
            <div
              key={tab.key}
              style={{
                background: "var(--surface-0)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              {/* Accordion header */}
              <button
                onClick={() => toggleTab(tab.key)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  gap: "10px",
                  borderBottom: isOpen ? "1px solid var(--border)" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: tab.accentColor,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "DM Sans, sans-serif",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      textAlign: "left",
                    }}
                  >
                    {tab.label}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "DM Sans, sans-serif",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: tab.accentColor,
                      background: `color-mix(in srgb, ${tab.accentColor} 12%, transparent)`,
                      padding: "2px 8px",
                      borderRadius: "20px",
                      minWidth: "24px",
                      textAlign: "center",
                    }}
                  >
                    {count}
                  </span>
                  <ChevronIcon open={isOpen} />
                </div>
              </button>

              {/* Accordion body */}
              {isOpen && (
                <>
                  {tab.key === "holidays" ? (
                    <HolidaysTabBody loading={holidaysLoading} holidays={holidays} todayKey={todayKey} />
                  ) : tab.key === "onLeave" ? (
                    <OnLeaveTabBody loading={onLeaveTodayState.loading} members={onLeaveTodayFiltered} />
                  ) : tab.key === "myLeaves" ? (
                    <MyLeavesBody leaves={myLeavesState.data} loading={myLeavesState.loading} todayKey={todayKey} />
                  ) : tabMembers[tab.key].length === 0 ? (
                    <p
                      style={{
                        padding: "16px",
                        fontFamily: "DM Sans, sans-serif",
                        fontSize: "13px",
                        color: "var(--text-muted)",
                        textAlign: "center",
                      }}
                    >
                      {en.meWsToday.emptyNoOneHereYet}
                    </p>
                  ) : (
                    <div>
                      {tabMembers[tab.key].map((m) => (
                        <MemberRow key={m.user_id} m={m} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {modalPortalReady && leaveModalOpen && (
        <LeaveWorkspaceModal
          workspaceName={data.workspace.name}
          loading={leaveLoading}
          error={leaveError}
          onCancel={() => setLeaveModalOpen(false)}
          onConfirm={() => void confirmLeaveWorkspace()}
        />
      )}

      {modalPortalReady && applyLeave.open && (
        <ApplyLeaveModal
          applyLeave={applyLeave}
          setApplyLeave={setApplyLeave}
          holidayWarning={holidayWarning}
          onSubmit={() => void submitLeave()}
        />
      )}

      <style>{`@keyframes vnz-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
