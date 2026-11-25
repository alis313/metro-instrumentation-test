"use client";

import * as React from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Bell,
  X,
  Filter,
} from "lucide-react";
import {
  AlertItem,
  InstrumentType,
  fmtNum,
  fmtDateTimeFa,
} from "@/lib/instrument-data";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  STATUS_CLASSES,
  STATUS_LABELS_FA,
  TYPE_LABELS_FA,
} from "./status-utils";
import { cn } from "@/lib/utils";

interface AlertsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: AlertItem[];
  onSelectStation?: (stationId: string) => void;
}

export function AlertsSheet({
  open,
  onOpenChange,
  alerts,
  onSelectStation,
}: AlertsSheetProps) {
  const [severity, setSeverity] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");

  const filtered = React.useMemo(() => {
    return alerts.filter((a) => {
      if (severity !== "all" && a.status !== severity) return false;
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      return true;
    });
  }, [alerts, severity, typeFilter]);

  const alarmCount = alerts.filter((a) => a.status === "alarm").length;
  const warnCount = alerts.filter((a) => a.status === "warning").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            هشدارها و آلارم‌های فعال
            <Badge variant="secondary" className="tnum">
              {filtered.length}
            </Badge>
          </SheetTitle>
          <SheetDescription className="text-xs">
            فهرست ابزارهایی که از حدود هشدار یا آلارم عبور کرده‌اند. برای مشاهده جزئیات روی ایستگاه کلیک کنید.
          </SheetDescription>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 tnum">
              <ShieldAlert className="h-3 w-3" />
              {alarmCount} آلارم
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 tnum">
              <AlertTriangle className="h-3 w-3" />
              {warnCount} هشدار
            </span>
          </div>
        </SheetHeader>

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 p-3">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="شدت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="alarm">آلارم</SelectItem>
              <SelectItem value="warning">هشدار</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="نوع ابزار" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه انواع</SelectItem>
              {(Object.keys(TYPE_LABELS_FA) as InstrumentType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS_FA[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(severity !== "all" || typeFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setSeverity("all");
                setTypeFilter("all");
              }}
            >
              <X className="h-3 w-3" />
              پاک
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2 p-3">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                <ShieldAlert className="h-8 w-8 text-emerald-500" />
                <span>هیچ هشدار فعالی وجود ندارد</span>
                <span className="text-xs">همه ابزارها در وضعیت عادی هستند</span>
              </div>
            ) : (
              filtered.map((a) => {
                const sc = STATUS_CLASSES[a.status];
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      onSelectStation?.(a.stationId);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "block w-full rounded-lg border p-3 text-right transition-all hover:shadow-sm",
                      sc.border,
                      sc.bg
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          sc.bg,
                          sc.text
                        )}
                      >
                        {a.status === "alarm" ? (
                          <ShieldAlert className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">
                            {a.instrumentLabel}
                          </span>
                          <span className="rounded bg-card px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                            {a.instrumentCode}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {a.stationName} • {TYPE_LABELS_FA[a.type]}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed">
                          {a.message}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium",
                              sc.bg,
                              sc.text
                            )}
                          >
                            {STATUS_LABELS_FA[a.status]}
                          </span>
                          <span className="tnum text-[11px]">
                            مقدار:{" "}
                            <span className="font-bold">
                              {fmtNum(a.value)}
                            </span>{" "}
                            <span className="text-muted-foreground">{a.unit}</span>
                          </span>
                          <span className="tnum text-[10px] text-muted-foreground">
                            {fmtDateTimeFa(a.time)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
