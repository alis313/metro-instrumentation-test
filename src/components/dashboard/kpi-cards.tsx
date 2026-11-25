"use client";

import * as React from "react";
import {
  Ruler,
  MoveVertical,
  TrendingUp,
  Droplets,
  Split,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { Instrument, InstrumentType, INSTRUMENT_TYPES } from "@/lib/instrument-data";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS_LABELS_FA, STATUS_CLASSES, TYPE_LABELS_FA } from "./status-utils";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/instrument-data";

interface KpiCardsProps {
  instruments: Instrument[];
  stationName: string;
}

const TYPE_ICONS: Record<InstrumentType, React.ComponentType<{ className?: string }>> = {
  extensometer: Ruler,
  inclinometer: MoveVertical,
  tiltmeter: TrendingUp,
  observation_well: Droplets,
  jointmeter: Split,
};

export function KpiCards({ instruments, stationName }: KpiCardsProps) {
  const byType = React.useMemo(() => {
    const map: Record<InstrumentType, Instrument[]> = {
      extensometer: [],
      inclinometer: [],
      tiltmeter: [],
      observation_well: [],
      jointmeter: [],
    };
    for (const ins of instruments) map[ins.type].push(ins);
    return map;
  }, [instruments]);

  const totals = React.useMemo(() => {
    const alarm = instruments.filter((i) => i.status === "alarm").length;
    const warning = instruments.filter((i) => i.status === "warning").length;
    const normal = instruments.filter((i) => i.status === "normal").length;
    return { alarm, warning, normal, total: instruments.length };
  }, [instruments]);

  return (
    <div className="space-y-3">
      {/* summary stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="کل ابزارها"
          value={fmtNum(totals.total, 0)}
          icon={<Activity className="h-4 w-4" />}
          tone="primary"
        />
        <StatTile
          label="وضعیت عادی"
          value={fmtNum(totals.normal, 0)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="normal"
        />
        <StatTile
          label="در هشدار"
          value={fmtNum(totals.warning, 0)}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="warning"
        />
        <StatTile
          label="در آلارم"
          value={fmtNum(totals.alarm, 0)}
          icon={<ShieldAlert className="h-4 w-4" />}
          tone="alarm"
        />
      </div>

      {/* per-type tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {(Object.keys(INSTRUMENT_TYPES) as InstrumentType[]).map((type) => {
          const list = byType[type];
          const meta = INSTRUMENT_TYPES[type];
          const Icon = TYPE_ICONS[type];
          const alarmCount = list.filter((i) => i.status === "alarm").length;
          const warnCount = list.filter((i) => i.status === "warning").length;
          const maxDelta = list.reduce(
            (m, i) => Math.max(m, Math.abs(i.lastDelta)),
            0
          );
          return (
            <Card
              key={type}
              className="overflow-hidden border-border/80 transition-shadow hover:shadow-md"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        {meta.nameEn}
                      </div>
                      <div className="text-sm font-semibold">
                        {meta.nameFa}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tnum">
                    {list.length}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      بیشینه تغییر
                    </span>
                    <span className="tnum text-sm font-bold">
                      {fmtNum(maxDelta)}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {meta.unit}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {alarmCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 tnum">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        {alarmCount} آلارم
                      </span>
                    )}
                    {warnCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 tnum">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {warnCount} هشدار
                      </span>
                    )}
                    {alarmCount === 0 && warnCount === 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        همه عادی
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "primary" | "normal" | "warning" | "alarm";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    normal: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    alarm: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return (
    <Card className="border-border/80">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md",
            toneMap[tone]
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="tnum text-lg font-bold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
