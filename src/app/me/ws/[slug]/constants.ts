import { en } from "@/locales/en";
import type { AccordionTab } from "./types";

export const TABS: { key: AccordionTab; label: string; accentColor: string }[] = [
  {
    key: "office",
    label: en.meWsToday.tabPeopleInOffice,
    accentColor: "var(--teal)",
  },
  {
    key: "remote",
    label: en.meWsToday.tabPeopleRemote,
    accentColor: "var(--amber)",
  },
  {
    key: "leave",
    label: en.meWsToday.tabPeopleNotCheckedIn,
    accentColor: "var(--brand)",
  },
  {
    key: "onLeave",
    label: en.meWsToday.tabPeopleOnLeave,
    accentColor: "var(--danger)",
  },
  {
    key: "holidays",
    label: en.meWsToday.tabHolidayCalendar,
    accentColor: "var(--text-secondary)",
  },
  {
    key: "myLeaves",
    label: en.meWsToday.tabMyLeaves,
    accentColor: "var(--brand)",
  },
];
