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
  INSTRUMENT_TYPES,
} from "@/lib/instrument-data";
import {
  STATUS_CLASSES,
  STATUS_LABELS_FA,
} from "./status-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InstrumentMapProps {
  stationName: string;
  stationCode: string;
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

// type colors (no blue/indigo)
const TYPE_FILL: Record<InstrumentType, string> = {
  extensometer: "#0d7d6c",
  inclinometer: "#b45309",
  tiltmeter: "#15803d",
  observation_well: "#7c3aed",
  jointmeter: "#b91c1c",
};

// The map is rectangular: viewBox is 160 wide × 100 tall (8:5 aspect).
// Original instrument positions are in 0..100 for both x and y. We scale x by 1.6
// at render time to spread the layout across the wider canvas.
const MAP_W = 160;
const MAP_H = 100;
const X_SCALE = MAP_W / 100; // 1.6

export function InstrumentMap({
  stationName,
  stationCode,
  instruments,
  selectedId,
  onSelect,
}: InstrumentMapProps) {
  const legend = React.useMemo(() => {
    return (Object.keys(INSTRUMENT_TYPES) as InstrumentType[]).map((t) => ({
      type: t,
      label: INSTRUMENT_TYPES[t].nameFa,
      fill: TYPE_FILL[t],
      count: instruments.filter((i) => i.type === t).length,
    }));
  }, [instruments]);

  // scaled positions for static structures
  const stBox = { x: 32 * X_SCALE, y: 42, w: 36 * X_SCALE, h: 16 };
  const bNE = { x: 80 * X_SCALE, y: 10, w: 14 * X_SCALE, h: 14 };
  const bSW = { x: 6 * X_SCALE, y: 76, w: 14 * X_SCALE, h: 14 };
  const bW = { x: 2 * X_SCALE, y: 44, w: 10 * X_SCALE, h: 12 };
  const compass = { x: 88 * X_SCALE, y: 88 };

  return (
    <Card className="overflow-hidden border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>نقشه استقرار ابزارها</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground font-mono">
            {stationCode}
          </span>
        </CardTitle>
        <CardDescription className="text-xs">
          چیدمان تقریبی ابزارهای پایش در اطراف سازه زیرزمینی ایستگاه {stationName}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {/* Rectangular map with legend overlaid inside */}
        <div className="relative aspect-[8/5] w-full overflow-hidden rounded-lg border border-border bg-muted/20 eng-grid">
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            aria-label="نقشه استقرار ابزارهای ایستگاه"
          >
            <defs>
              <pattern id="soil" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="oklch(0.94 0.012 75)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="oklch(0.82 0.02 75)" strokeWidth="0.6" />
              </pattern>
              <pattern id="surface" patternUnits="userSpaceOnUse" width="4" height="4">
                <rect width="4" height="4" fill="oklch(0.9 0.01 180)" />
                <circle cx="1" cy="1" r="0.4" fill="oklch(0.78 0.02 180)" />
              </pattern>
            </defs>

            {/* ground surface */}
            <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="url(#surface)" opacity="0.35" />

            {/* connecting lines from station box to instrument clusters (drawn first, behind markers) */}
            <g opacity="0.18" stroke="oklch(0.55 0.05 220)" strokeWidth="0.25" strokeDasharray="0.8 0.8" fill="none">
              <line x1={stBox.x + stBox.w / 2} y1={stBox.y} x2={50 * X_SCALE} y2={30} />
              <line x1={stBox.x + stBox.w / 2} y1={stBox.y + stBox.h} x2={50 * X_SCALE} y2={70} />
              <line x1={stBox.x + stBox.w} y1={stBox.y + stBox.h / 2} x2={70 * X_SCALE} y2={50} />
              <line x1={stBox.x} y1={stBox.y + stBox.h / 2} x2={30 * X_SCALE} y2={50} />
            </g>

            {/* underground structure (station box) */}
            <g>
              <rect
                x={stBox.x}
                y={stBox.y}
                width={stBox.w}
                height={stBox.h}
                rx="1.5"
                fill="oklch(0.32 0.04 220)"
                stroke="oklch(0.22 0.05 220)"
                strokeWidth="0.6"
              />
              <rect x={stBox.x} y={stBox.y} width={stBox.w} height={stBox.h} rx="1.5" fill="url(#soil)" opacity="0.18" />
              {/* entrance/excavation shafts */}
              <rect x={stBox.x + 14 * X_SCALE} y={stBox.y - 2} width={8 * X_SCALE} height="2" fill="oklch(0.25 0.05 220)" />
              <rect x={stBox.x + 6 * X_SCALE} y={stBox.y - 2} width={3 * X_SCALE} height="2" fill="oklch(0.25 0.05 220)" />
              <rect x={stBox.x + 27 * X_SCALE} y={stBox.y - 2} width={3 * X_SCALE} height="2" fill="oklch(0.25 0.05 220)" />
              <text
                x={stBox.x + stBox.w / 2}
                y={stBox.y + stBox.h / 2 + 1}
                textAnchor="middle"
                fontSize="3"
                fill="oklch(0.95 0.01 180)"
                fontWeight="bold"
                style={{ fontFamily: "inherit" }}
              >
                سازه ایستگاه
              </text>
            </g>

            {/* nearby structures (buildings) at corners */}
            <g opacity="0.95">
              <rect x={bNE.x} y={bNE.y} width={bNE.w} height={bNE.h} rx="0.6" fill="oklch(0.7 0.02 60)" stroke="oklch(0.55 0.03 60)" strokeWidth="0.4" />
              <text x={bNE.x + bNE.w / 2} y={bNE.y + bNE.h / 2 + 0.8} textAnchor="middle" fontSize="2.2" fill="oklch(0.2 0.02 60)">ساختمان</text>

              <rect x={bSW.x} y={bSW.y} width={bSW.w} height={bSW.h} rx="0.6" fill="oklch(0.7 0.02 60)" stroke="oklch(0.55 0.03 60)" strokeWidth="0.4" />
              <text x={bSW.x + bSW.w / 2} y={bSW.y + bSW.h / 2 + 0.8} textAnchor="middle" fontSize="2.2" fill="oklch(0.2 0.02 60)">ساختمان</text>

              <rect x={bW.x} y={bW.y} width={bW.w} height={bW.h} rx="0.5" fill="oklch(0.7 0.02 60)" stroke="oklch(0.55 0.03 60)" strokeWidth="0.4" />
            </g>

            {/* direction compass */}
            <g transform={`translate(${compass.x}, ${compass.y})`}>
              <circle r="5" fill="oklch(1 0 0)" stroke="oklch(0.5 0.02 220)" strokeWidth="0.4" opacity="0.85" />
              <path d="M0,-3.5 L1.2,1 L0,0 L-1.2,1 Z" fill="oklch(0.55 0.2 27)" />
              <text x="0" y="-4" textAnchor="middle" fontSize="2" fill="oklch(0.3 0.02 220)" fontWeight="bold">N</text>
            </g>

            {/* instruments */}
            {instruments.map((ins) => {
              const fill = TYPE_FILL[ins.type];
              const statusRing =
                ins.status === "alarm"
                  ? "#ef4444"
                  : ins.status === "warning"
                  ? "#f59e0b"
                  : ins.status === "offline"
                  ? "#94a3b8"
                  : "transparent";
              const isSelected = selectedId === ins.id;
              const px = ins.pos.x * X_SCALE;
              const py = ins.pos.y;
              return (
                <g
                  key={ins.id}
                  transform={`translate(${px}, ${py})`}
                  className="cursor-pointer"
                  onClick={() => onSelect(ins.id)}
                >
                  {(ins.status === "alarm" || ins.status === "warning") && (
                    <circle r="3.4" fill={statusRing} opacity="0.18">
                      <animate attributeName="r" values="3.4;4.6;3.4" dur="2.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.18;0.05;0.18" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {isSelected && (
                    <circle r="3.6" fill="none" stroke="oklch(0.42 0.09 180)" strokeWidth="0.5" strokeDasharray="1 1" />
                  )}
                  <circle r="2.2" fill={fill} stroke="oklch(1 0 0)" strokeWidth="0.5" />
                  <circle r="0.9" fill="oklch(1 0 0)" />
                  {statusRing !== "transparent" && (
                    <circle r="2.6" fill="none" stroke={statusRing} strokeWidth="0.5" />
                  )}
                  <text
                    y={py > 50 ? "4.2" : "-2.8"}
                    textAnchor="middle"
                    fontSize="2"
                    fill="oklch(0.25 0.02 220)"
                    fontWeight="600"
                    style={{ fontFamily: "inherit" }}
                    className="pointer-events-none"
                  >
                    {ins.code}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend overlay inside the map — top-left corner */}
          <div className="absolute left-2 top-2 max-w-[260px] rounded-md border border-border/70 bg-card/95 p-2 shadow-sm backdrop-blur-sm sm:max-w-[320px]">
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-primary" />
              راهنمای ابزارها
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
              {legend.map((l) => {
                const Icon = TYPE_ICONS[l.type];
                return (
                  <li
                    key={l.type}
                    className="flex items-center gap-1.5"
                    title={l.label}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: l.fill }}
                    />
                    <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[10px]">{l.label}</span>
                    <span className="tnum ms-auto text-[9px] font-medium text-muted-foreground">
                      {l.count}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-2 border-t border-border/60 pt-1.5">
              <div className="mb-1 text-[9px] font-semibold text-muted-foreground">
                وضعیت
              </div>
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {(["normal", "warning", "alarm"] as const).map((s) => {
                  const sc = STATUS_CLASSES[s];
                  return (
                    <li
                      key={s}
                      className="flex items-center gap-1 text-[10px]"
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                      <span>{STATUS_LABELS_FA[s]}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* scale / view hint — bottom-right corner */}
          <div className="absolute bottom-2 right-2 rounded-md bg-card/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
            مقیاس تقریبی — دید از بالا
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
