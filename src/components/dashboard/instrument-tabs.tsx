"use client";

import * as React from "react";
import {
  Ruler,
  MoveVertical,
  TrendingUp,
  Droplets,
  Split,
} from "lucide-react";
import {
  Instrument,
  InstrumentType,
  fmtNum,
} from "@/lib/instrument-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { InstrumentChart } from "./instrument-chart";
import {
  STATUS_CLASSES,
  STATUS_LABELS_FA,
  TYPE_LABELS_FA,
} from "./status-utils";
import { cn } from "@/lib/utils";

interface InstrumentTabsProps {
  instruments: Instrument[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

const TYPE_ICONS: Record<InstrumentType, React.ComponentType<{ className?: string }>> = {
  extensometer: Ruler,
  inclinometer: MoveVertical,
  tiltmeter: TrendingUp,
  observation_well: Droplets,
  jointmeter: Split,
};

const TYPE_ORDER: InstrumentType[] = [
  "extensometer",
  "inclinometer",
  "tiltmeter",
  "observation_well",
  "jointmeter",
];

export function InstrumentTabs({
  instruments,
  selectedId,
  onSelect,
}: InstrumentTabsProps) {
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

  const selectedInstrument = instruments.find((i) => i.id === selectedId);
  const selectedType = selectedInstrument?.type || "extensometer";

  // when type tab changes, auto-select first instrument of that type
  const handleTabChange = (type: string) => {
    const list = byType[type as InstrumentType];
    if (list && list.length > 0) onSelect(list[0].id);
  };

  // scroll to a specific chart when its chip is clicked
  const handleChipClick = (insId: string) => {
    onSelect(insId);
    const el = document.getElementById(`chart-${insId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <Card className="border-border/80">
      <CardContent className="p-3 sm:p-4">
        <Tabs value={selectedType} onValueChange={handleTabChange}>
          {/* Sticky instrument-type tabs — centered, floating, stays visible when scrolling */}
          <div className="sticky top-[125px] z-20 -mx-3 mb-3 border-y border-border/60 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:top-[80px] sm:-mx-4 sm:px-4">
            <div className="flex w-full overflow-x-auto">
              <TabsList
                className="mx-auto inline-flex h-auto w-max gap-1 bg-muted/60 p-1"
                aria-label="نوع ابزار"
              >
                {TYPE_ORDER.map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const list = byType[type];
                  const alarmCount = list.filter((i) => i.status === "alarm").length;
                  const warnCount = list.filter((i) => i.status === "warning").length;
                  return (
                    <TabsTrigger
                      key={type}
                      value={type}
                      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{TYPE_LABELS_FA[type]}</span>
                      <span className="tnum rounded bg-muted-foreground/10 px-1 text-[10px]">
                        {list.length}
                      </span>
                      {alarmCount > 0 && (
                        <span className="tnum rounded-full bg-red-500/15 px-1 text-[9px] font-bold text-red-600 dark:text-red-400">
                          {alarmCount}
                        </span>
                      )}
                      {warnCount > 0 && alarmCount === 0 && (
                        <span className="tnum rounded-full bg-amber-500/15 px-1 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                          {warnCount}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
          </div>

          {TYPE_ORDER.map((type) => {
            const list = byType[type];
            return (
              <TabsContent key={type} value={type} className="mt-3">
                {list.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    ابزاری از این نوع در این ایستگاه ثبت نشده است.
                  </div>
                ) : (
                  <>
                    {/* Instrument name menu — scrolls normally with the page */}
                    <div className="mb-4 rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
                      <div className="mb-1.5 text-center text-[10px] font-medium text-muted-foreground">
                        فهرست ابزارها — برای رفتن به نمودار، روی نام کلیک کنید
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {list.map((ins) => {
                          const sc = STATUS_CLASSES[ins.status];
                          const isSelected = ins.id === selectedId;
                          return (
                            <button
                              key={ins.id}
                              onClick={() => handleChipClick(ins.id)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all",
                                isSelected
                                  ? "border-primary bg-primary/10 shadow-sm"
                                  : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"
                              )}
                              title={ins.label}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full",
                                  sc.dot
                                )}
                                aria-hidden
                              />
                              <span className="font-mono font-semibold">
                                {ins.code}
                              </span>
                              <span className="tnum text-[10px] text-muted-foreground">
                                {fmtNum(ins.lastReading)}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {ins.unit}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* All charts stacked vertically */}
                    <div className="space-y-4">
                      {list.map((ins) => {
                        const sc = STATUS_CLASSES[ins.status];
                        const isSelected = ins.id === selectedId;
                        return (
                          <div
                            key={ins.id}
                            id={`chart-${ins.id}`}
                            className={cn(
                              "scroll-mt-[200px] rounded-lg border transition-all sm:scroll-mt-[140px]",
                              isSelected
                                ? "border-primary/40 ring-1 ring-primary/20"
                                : "border-border/60"
                            )}
                          >
                            {/* Instrument header bar above each chart */}
                            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
                              <span
                                className={cn(
                                  "h-2 w-2 shrink-0 rounded-full",
                                  sc.dot
                                )}
                                aria-hidden
                              />
                              <span className="text-sm font-semibold">
                                {ins.label}
                              </span>
                              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {ins.code}
                              </span>
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                  sc.bg,
                                  sc.text
                                )}
                              >
                                {STATUS_LABELS_FA[ins.status]}
                              </span>
                              <span className="ms-auto tnum text-xs font-bold">
                                {fmtNum(ins.lastReading)}{" "}
                                <span className="text-[9px] font-normal text-muted-foreground">
                                  {ins.unit}
                                </span>
                              </span>
                            </div>

                            {/* The chart itself */}
                            <InstrumentChart instrument={ins} />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
