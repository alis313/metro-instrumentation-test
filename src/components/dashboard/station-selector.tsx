"use client";

import * as React from "react";
import { MapPin, ChevronLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Station } from "@/lib/instrument-data";
import { STATUS_LABELS_FA, STATUS_CLASSES } from "./status-utils";
import { cn } from "@/lib/utils";

interface StationSelectorProps {
  stations: Station[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function StationSelector({
  stations,
  selectedId,
  onSelect,
}: StationSelectorProps) {
  return (
    <nav
      aria-label="انتخاب ایستگاه"
      className="flex h-full flex-col gap-1 overflow-y-auto p-3"
    >
      <div className="mb-2 flex items-center gap-2 px-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">فهرست ایستگاه‌ها</h2>
        <span className="ms-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tnum">
          {stations.length}
        </span>
      </div>

      {stations.map((st) => {
        const active = st.id === selectedId;
        const sc = STATUS_CLASSES[st.status];
        return (
          <button
            key={st.id}
            onClick={() => onSelect(st.id)}
            className={cn(
              "group flex w-full items-start gap-3 rounded-lg border p-3 text-right transition-all",
              "hover:bg-accent/50 hover:shadow-sm",
              active
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card"
            )}
            aria-current={active ? "page" : undefined}
          >
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">
                  {st.name}
                </span>
                {active && (
                  <ChevronLeft className="ms-auto h-4 w-4 shrink-0 text-primary" />
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-mono font-semibold">{st.code}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                    sc.bg,
                    sc.border,
                    sc.text
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                  {STATUS_LABELS_FA[st.status]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground tnum">
                  {st.instrumentCount} ابزار
                </span>
                {st.alertCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 tnum">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {st.alertCount} هشدار
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    سالم
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
