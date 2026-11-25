import * as React from "react";
import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";

interface DashboardFooterProps {
  totalInstruments: number;
  totalAlerts: number;
  lastUpdate: string;
}

export function DashboardFooter({
  totalInstruments,
  totalAlerts,
  lastUpdate,
}: DashboardFooterProps) {
  return (
    <footer className="mt-auto border-t border-border bg-card/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            داشبورد پایش ابزار دقیق خط مترو
          </span>
          <span aria-hidden className="hidden sm:inline">•</span>
          <span className="tnum">کل ابزارها: {totalInstruments}</span>
          {totalAlerts > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              <span className="tnum">{totalAlerts} هشدار فعال</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" />
              همه ابزارها سالم
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>آخرین به‌روزرسانی:</span>
          <span className="tnum text-foreground/80">{lastUpdate}</span>
        </div>
      </div>
      <div className="border-t border-border/60 bg-muted/20 px-4 py-2 text-center text-[10px] text-muted-foreground sm:px-6">
        سامانه پایش ابزار دقیق — داده‌های نمایش‌داده‌شده نمونه‌ای و برای اهداف نمایشی است. © ۱۴۰۵
      </div>
    </footer>
  );
}
