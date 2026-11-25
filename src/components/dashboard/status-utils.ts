import { InstrumentStatus, InstrumentType } from "@/lib/instrument-data";

export const STATUS_LABELS_FA: Record<InstrumentStatus, string> = {
  normal: "عادی",
  warning: "هشدار",
  alarm: "آلارم",
  offline: "آفلاین",
};

export const STATUS_CLASSES: Record<
  InstrumentStatus,
  { dot: string; text: string; bg: string; border: string; ring: string }
> = {
  normal: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    ring: "ring-emerald-500/30",
  },
  warning: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    ring: "ring-amber-500/30",
  },
  alarm: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-300",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    ring: "ring-red-500/30",
  },
  offline: {
    dot: "bg-slate-400",
    text: "text-slate-600 dark:text-slate-300",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    ring: "ring-slate-500/30",
  },
};

export const STATUS_HEX: Record<InstrumentStatus, string> = {
  normal: "#10b981",
  warning: "#f59e0b",
  alarm: "#ef4444",
  offline: "#94a3b8",
};

export const TYPE_LABELS_FA: Record<InstrumentType, string> = {
  extensometer: "اکستنسومتر",
  inclinometer: "اینکلاینومتر",
  tiltmeter: "تیلت‌متر",
  observation_well: "چاه مشاهده‌ای",
  jointmeter: "درزسنج",
};
