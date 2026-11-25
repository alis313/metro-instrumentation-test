"use client";

import * as React from "react";
import { Train, ChevronLeft } from "lucide-react";
import { Station } from "@/lib/instrument-data";
import { STATUS_CLASSES, STATUS_LABELS_FA } from "./status-utils";
import { cn } from "@/lib/utils";

interface MetroLineSchematicProps {
  stations: Station[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const STATUS_HEX: Record<string, string> = {
  normal: "#10b981",
  warning: "#f59e0b",
  alarm: "#ef4444",
  offline: "#94a3b8",
};

export function MetroLineSchematic({
  stations,
  selectedId,
  onSelect,
}: MetroLineSchematicProps) {
  // The line is rendered horizontally with stations as nodes.
  // On small screens it falls back to a horizontal scroll.
  return (
    <section
      aria-label="نقشه خط مترو"
      className="rounded-xl border border-border/60 bg-card/40 p-3 backdrop-blur sm:p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Train className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">مسیر خط مترو — ایستگاه‌ها</h2>
        <span className="ms-auto text-[10px] text-muted-foreground">
          برای انتخاب، روی هر ایستگاه کلیک کنید
        </span>
      </div>

      {/* Schematic line */}
      <div className="relative overflow-x-auto pb-2">
        <div className="relative flex min-w-[640px] items-start justify-between gap-2 px-6 pt-8 pb-10">
          {/* The track line (gradient) */}
          <div
            className="metro-track pointer-events-none absolute left-6 right-6 top-[44px] h-1 rounded-full opacity-70"
            aria-hidden
          />
          {/* Inner dashed highlight line on top */}
          <div
            className="pointer-events-none absolute left-6 right-6 top-[43px] h-[3px] border-t border-dashed border-white/40 dark:border-white/15"
            aria-hidden
          />

          {stations.map((st) => {
            const sc = STATUS_CLASSES[st.status];
            const isActive = st.id === selectedId;
            const hex = STATUS_HEX[st.status];
            return (
              <button
                key={st.id}
                onClick={() => onSelect(st.id)}
                className="group relative z-10 flex flex-1 flex-col items-center gap-1.5 outline-none"
                aria-current={isActive ? "true" : undefined}
                aria-label={`${st.name} — ${STATUS_LABELS_FA[st.status]}`}
              >
                {/* station code above the node */}
                <span className="absolute -top-7 text-[10px] font-mono font-semibold text-muted-foreground">
                  {st.code}
                </span>

                {/* node — circle with status color */}
                <span
                  className={cn(
                    "relative flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                    isActive
                      ? "scale-125 border-primary bg-primary/10"
                      : "border-card",
                    st.status === "alarm" && "glow-alarm"
                  )}
                  style={{
                    backgroundColor: isActive ? "transparent" : hex,
                    boxShadow: isActive
                      ? `0 0 0 4px ${hex}33, 0 0 0 1px ${hex}`
                      : `0 0 0 0 ${hex}00`,
                  }}
                >
                  {/* inner pulse for alarm */}
                  {st.status === "alarm" && (
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                      style={{ backgroundColor: hex }}
                      aria-hidden
                    />
                  )}
                  {/* inner dot */}
                  <span
                    className={cn(
                      "relative h-1.5 w-1.5 rounded-full",
                      isActive ? "" : "bg-white"
                    )}
                    style={isActive ? { backgroundColor: hex } : undefined}
                  />
                </span>

                {/* station name + status pill below */}
                <div className="mt-1 flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "max-w-[140px] text-center text-xs font-semibold leading-tight transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {st.name}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
                      sc.bg,
                      sc.border,
                      sc.text
                    )}
                  >
                    <span className={cn("h-1 w-1 rounded-full", sc.dot)} />
                    {STATUS_LABELS_FA[st.status]}
                  </span>
                  <span className="tnum text-[9px] text-muted-foreground">
                    {st.instrumentCount} ابزار
                    {st.alertCount > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        {" • "}
                        {st.alertCount} هشدار
                      </span>
                    )}
                  </span>
                </div>

                {/* active station marker arrow */}
                {isActive && (
                  <ChevronLeft className="absolute -bottom-1 h-3 w-3 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
