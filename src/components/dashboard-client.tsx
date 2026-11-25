"use client";

import * as React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MetroLineSchematic } from "@/components/dashboard/metro-line-schematic";
import { StationSelector } from "@/components/dashboard/station-selector";
import { InstrumentMap } from "@/components/dashboard/instrument-map";
import { InstrumentTabs } from "@/components/dashboard/instrument-tabs";
import { AlertsSheet } from "@/components/dashboard/alerts-sheet";
import { DashboardFooter } from "@/components/dashboard/dashboard-footer";
import {
  STATIONS,
  getInstrumentsForStation,
  fmtDateTimeFa,
  fmtNum,
  NOW_TS,
  InstrumentStatus,
  Instrument,
  InstrumentSeries,
  InstrumentType,
  Threshold,
} from "@/lib/instrument-data";
import { ChevronLeft, ChevronRight, Train, Layers, Activity, ShieldAlert, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { STATUS_CLASSES, STATUS_LABELS_FA } from "@/components/dashboard/status-utils";
import { cn } from "@/lib/utils";

// ─── Excel data types ───────────────────────────────────────────────
interface ExcelReading { t: number; value: number; }
interface ExcelSeries { label: string; color: string; readings: ExcelReading[]; }
interface ExcelInstrumentData { code: string; label: string; readings: ExcelReading[]; series: ExcelSeries[]; }
interface ExcelStationData {
  stationId: string;
  extensometers: ExcelInstrumentData[];
  crackmeters: ExcelInstrumentData[];
  observationWells: ExcelInstrumentData[];
  tiltmeters: ExcelInstrumentData[];
}

// Thresholds for real data (based on observed data ranges)
const REAL_EXT_THRESHOLD: Threshold = { warning: 15, alarm: 30 };
const REAL_CRACK_THRESHOLD: Threshold = { warning: 2, alarm: 4 };
const REAL_WELL_THRESHOLD: Threshold = { warning: 50, alarm: 100 };
const REAL_TILT_THRESHOLD: Threshold = { warning: 0.5, alarm: 1.0 };

// Positions for instruments on the station map (per station)
// Each station has its own set of positions for extensometers, crackmeters, wells, tiltmeters.
// When real Excel data has more instruments than positions, we wrap around modulo the array length.
const STATION_POSITIONS: Record<string, {
  ext: { x: number; y: number }[];
  crack: { x: number; y: number }[];
  well: { x: number; y: number }[];
  tilt: { x: number; y: number }[];
}> = {
  "st-link": {
    ext:   [{ x: 50, y: 30 }, { x: 50, y: 70 }, { x: 70, y: 50 }, { x: 30, y: 50 }, { x: 65, y: 20 }, { x: 35, y: 80 }],
    crack: [{ x: 15, y: 15 }, { x: 85, y: 85 }, { x: 20, y: 60 }, { x: 80, y: 30 }, { x: 45, y: 10 }, { x: 60, y: 90 }],
    well:  [{ x: 80, y: 60 }, { x: 25, y: 35 }, { x: 70, y: 75 }],
    tilt:  [{ x: 88, y: 25 }, { x: 12, y: 75 }, { x: 90, y: 50 }, { x: 10, y: 30 }],
  },
  "st-n3": {
    // N3 (شهدا) — positions match the site image: road axis NE→SW diagonal
    ext:   [{ x: 33, y: 12 }, { x: 22, y: 30 }, { x: 49, y: 25 }, { x: 56, y: 66 }, { x: 60, y: 81 }, { x: 85, y: 79 }, { x: 15, y: 55 }],
    crack: [{ x: 40, y: 15 }, { x: 14, y: 38 }, { x: 48, y: 75 }, { x: 52, y: 78 }, { x: 56, y: 86 }, { x: 61, y: 89 }, { x: 67, y: 91 },
            { x: 38, y: 8 },  { x: 50, y: 18 }, { x: 52, y: 25 }, { x: 71, y: 40 }, { x: 55, y: 72 }, { x: 88, y: 65 },
            { x: 65, y: 92 }, { x: 24, y: 36 }, { x: 75, y: 30 }, { x: 18, y: 72 }, { x: 80, y: 50 }, { x: 90, y: 88 }],
    well:  [{ x: 80, y: 50 }, { x: 90, y: 88 }],
    tilt:  [{ x: 88, y: 25 }, { x: 12, y: 75 }, { x: 90, y: 50 }, { x: 10, y: 30 }],
  },
  "st-o3": {
    ext:   [{ x: 50, y: 30 }, { x: 50, y: 70 }, { x: 70, y: 50 }, { x: 30, y: 50 }, { x: 65, y: 20 }, { x: 35, y: 80 },
            { x: 75, y: 35 }, { x: 25, y: 65 }, { x: 60, y: 40 }, { x: 40, y: 60 }],
    crack: [{ x: 15, y: 15 }, { x: 85, y: 85 }, { x: 88, y: 18 }, { x: 12, y: 85 }, { x: 58, y: 22 }, { x: 42, y: 78 },
            { x: 80, y: 70 }, { x: 22, y: 40 }, { x: 75, y: 60 }, { x: 28, y: 25 }, { x: 65, y: 88 }, { x: 35, y: 50 }],
    well:  [{ x: 35, y: 22 }, { x: 78, y: 35 }, { x: 60, y: 75 }],
    tilt:  [{ x: 88, y: 18 }, { x: 12, y: 85 }, { x: 50, y: 12 }, { x: 50, y: 88 }, { x: 25, y: 50 }, { x: 75, y: 50 }],
  },
  "st-p3": {
    ext:   [{ x: 50, y: 30 }, { x: 50, y: 70 }, { x: 70, y: 50 }, { x: 30, y: 50 }, { x: 65, y: 20 }, { x: 35, y: 80 }, { x: 50, y: 50 }],
    crack: [{ x: 15, y: 15 }, { x: 85, y: 85 }, { x: 88, y: 18 }, { x: 12, y: 85 }, { x: 58, y: 22 }, { x: 42, y: 78 }],
    well:  [{ x: 35, y: 22 }, { x: 65, y: 78 }, { x: 50, y: 50 }, { x: 80, y: 60 }],
    tilt:  [{ x: 88, y: 18 }, { x: 12, y: 85 }, { x: 50, y: 12 }, { x: 50, y: 88 }],
  },
  "st-q3": {
    ext:   [{ x: 50, y: 30 }, { x: 50, y: 70 }, { x: 70, y: 50 }, { x: 30, y: 50 }, { x: 65, y: 20 }, { x: 35, y: 80 }],
    crack: [{ x: 15, y: 15 }, { x: 85, y: 85 }, { x: 88, y: 18 }, { x: 12, y: 85 }, { x: 58, y: 22 }, { x: 42, y: 78 },
            { x: 22, y: 40 }, { x: 78, y: 60 }],
    well:  [{ x: 35, y: 22 }, { x: 65, y: 78 }],
    tilt:  [{ x: 88, y: 18 }, { x: 12, y: 85 }, { x: 50, y: 12 }, { x: 50, y: 88 }],
  },
  "st-r3": {
    ext:   [{ x: 50, y: 30 }, { x: 50, y: 70 }, { x: 70, y: 50 }, { x: 30, y: 50 }, { x: 65, y: 20 }, { x: 35, y: 80 }, { x: 50, y: 50 }],
    crack: [{ x: 15, y: 15 }, { x: 85, y: 85 }, { x: 88, y: 18 }, { x: 12, y: 85 }, { x: 58, y: 22 }, { x: 42, y: 78 },
            { x: 80, y: 50 }, { x: 22, y: 60 }, { x: 65, y: 40 }],
    well:  [{ x: 35, y: 22 }, { x: 65, y: 78 }],
    tilt:  [{ x: 88, y: 18 }, { x: 12, y: 85 }, { x: 50, y: 12 }, { x: 50, y: 88 }],
  },
};

// Fallback positions for any station not in the table above
const FALLBACK_POSITIONS = {
  ext:   [{ x: 50, y: 30 }, { x: 50, y: 70 }, { x: 70, y: 50 }, { x: 30, y: 50 }, { x: 65, y: 20 }, { x: 35, y: 80 }],
  crack: [{ x: 15, y: 15 }, { x: 85, y: 85 }, { x: 88, y: 18 }, { x: 12, y: 85 }, { x: 58, y: 22 }, { x: 42, y: 78 }],
  well:  [{ x: 35, y: 22 }, { x: 65, y: 78 }],
  tilt:  [{ x: 88, y: 18 }, { x: 12, y: 85 }, { x: 50, y: 12 }, { x: 50, y: 88 }],
};

// Backward-compat aliases used elsewhere in the file
const LINK_EXT_POSITIONS = STATION_POSITIONS["st-link"].ext;
const LINK_CRACK_POSITIONS = STATION_POSITIONS["st-link"].crack;
const LINK_WELL_POSITIONS = STATION_POSITIONS["st-link"].well;
const LINK_TILT_POSITIONS = STATION_POSITIONS["st-link"].tilt;

function statusFromValue(absVal: number, th: Threshold): InstrumentStatus {
  if (absVal >= th.alarm) return "alarm";
  if (absVal >= th.warning) return "warning";
  return "normal";
}

// Convert Excel instrument data to the dashboard's Instrument format
function excelToInstrument(
  ex: ExcelInstrumentData,
  stationId: string,
  type: InstrumentType,
  index: number,
  positions: { x: number; y: number }[],
  threshold: Threshold,
  unit: string,
  locationLabel: string
): Instrument {
  const pos = positions[index % positions.length];
  const readings = ex.readings;
  const last = readings[readings.length - 1];
  const first = readings[0];
  const lastReading = last.value;
  const lastDelta = last.value - first.value;

  // Build multi-series
  const series: InstrumentSeries[] = (ex.series || []).map((s) => ({
    label: s.label,
    color: s.color,
    readings: s.readings.map((r) => ({ t: r.t, value: r.value })),
  }));

  // Status based on maximum absolute delta across ALL series
  let maxAbsDelta = Math.abs(lastDelta);
  for (const s of series) {
    if (s.readings.length > 0) {
      const sDelta = Math.abs(
        s.readings[s.readings.length - 1].value - s.readings[0].value
      );
      if (sDelta > maxAbsDelta) maxAbsDelta = sDelta;
    }
  }
  const status = statusFromValue(maxAbsDelta, threshold);

  return {
    id: `${stationId}-${ex.code}`,
    code: ex.code,
    type,
    stationId,
    label: ex.label,
    location: locationLabel,
    unit,
    baseline: 0,
    threshold,
    pos,
    readings: readings.map((r) => ({ t: r.t, value: r.value })),
    series: series.length > 0 ? series : undefined,
    status,
    lastReading,
    lastDelta: Number(lastDelta.toFixed(4)),
    updatedAt: last.t,
  };
}

// Merge Excel data into instruments for any station that has real data.
// Falls back to mock data if no Excel data is available for the station.
function mergeInstruments(
  stationId: string,
  excelData: ExcelStationData | null
): Instrument[] {
  const mock = getInstrumentsForStation(stationId);

  if (!excelData) {
    return mock.length > 0 ? mock : [];
  }

  // Has real Excel data - use it instead of mock data
  const result: Instrument[] = [];
  const pos = STATION_POSITIONS[stationId] || FALLBACK_POSITIONS;

  // Extensometers from Excel
  for (let i = 0; i < excelData.extensometers.length; i++) {
    result.push(
      excelToInstrument(
        excelData.extensometers[i],
        stationId,
        "extensometer",
        i,
        pos.ext,
        REAL_EXT_THRESHOLD,
        "mm",
        "محور جاده — نقاط گیرداری متعدد"
      )
    );
  }

  // Crackmeters (ترک‌سنج) from Excel → type: jointmeter
  for (let i = 0; i < excelData.crackmeters.length; i++) {
    result.push(
      excelToInstrument(
        excelData.crackmeters[i],
        stationId,
        "jointmeter",
        i,
        pos.crack,
        REAL_CRACK_THRESHOLD,
        "mm",
        "سازه مجاور — نقاط ترک‌سنجی"
      )
    );
  }

  // Observation wells from Excel → type: observation_well
  for (let i = 0; i < excelData.observationWells.length; i++) {
    result.push(
      excelToInstrument(
        excelData.observationWells[i],
        stationId,
        "observation_well",
        i,
        pos.well,
        REAL_WELL_THRESHOLD,
        "m",
        "چاه مشاهده‌ای — عمق سطح آب زیرزمینی"
      )
    );
  }

  // Tiltmeters from Excel → type: tiltmeter
  for (let i = 0; i < excelData.tiltmeters.length; i++) {
    result.push(
      excelToInstrument(
        excelData.tiltmeters[i],
        stationId,
        "tiltmeter",
        i,
        pos.tilt,
        REAL_TILT_THRESHOLD,
        "degree",
        "ساختمان مجاور — محورهای A و B"
      )
    );
  }

  return result;
}

export default function DashboardClient() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <DashboardGate />
      </AuthProvider>
    </ThemeProvider>
  );
}

function DashboardGate() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">در حال بارگذاری…</div>
      </div>
    );
  }
  if (!user) {
    // Client-side redirect to login
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }
  return <DashboardInner user={user} onLogout={logout} />;
}

function DashboardInner({ user, onLogout }: { user: NonNullable<ReturnType<typeof useAuth>["user"]>; onLogout: () => void }) {
  // Build the station list from the user's accessible stations.
  // Admins see all stations (from /api/admin/stations); viewers see their assigned stations.
  const [dbStations, setDbStations] = React.useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedStationId, setSelectedStationId] = React.useState<string>("");
  const [selectedInstrumentId, setSelectedInstrumentId] = React.useState<string | undefined>();
  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Load stations based on user role
  React.useEffect(() => {
    if (user.role === "ADMIN") {
      fetch("/api/admin/stations")
        .then((r) => r.json())
        .then((d) => {
          const sts = d.stations || [];
          setDbStations(sts);
          if (sts.length > 0 && !selectedStationId) setSelectedStationId(sts[0].id);
        })
        .catch(() => {});
    } else {
      // Viewer: use stations from auth context
      const sts = user.stations || [];
      setDbStations(sts);
      if (sts.length > 0 && !selectedStationId) setSelectedStationId(sts[0].id);
    }
  }, [user]);

  // Fetch configured station data for the selected station
  const [stationData, setStationData] = React.useState<ExcelStationData | null>(null);
  const [dataLoading, setDataLoading] = React.useState(false);

  React.useEffect(() => {
    if (!selectedStationId) return;
    setDataLoading(true);
    fetch(`/api/station-data/${selectedStationId}`)
      .then((r) => r.json())
      .then((data: ExcelStationData) => {
        if (data && (data.extensometers || data.crackmeters || data.observationWells || data.tiltmeters)) {
          setStationData(data);
        } else {
          setStationData(null);
        }
      })
      .catch(() => setStationData(null))
      .finally(() => setDataLoading(false));
  }, [selectedStationId]);

  // The currently selected station's configured data (from /api/station-data/[id])
  const excelData = stationData;

  // Get instruments with Excel data merged for the selected station
  const instruments = React.useMemo(
    () => mergeInstruments(selectedStationId, excelData),
    [selectedStationId, excelData]
  );

  // For network-wide totals, just use the current station's instruments (simplification).
  // A future enhancement can fetch all stations' data for the admin view.
  const allInstruments = React.useMemo(() => {
    return mergeInstruments(selectedStationId, excelData);
  }, [selectedStationId, excelData]);

  // Build live station list from DB stations. Instrument counts are computed for the
  // currently selected station; others show a placeholder until selected.
  const liveStations = React.useMemo(() => {
    return dbStations.map((st) => {
      const isSelected = st.id === selectedStationId;
      const stInstruments = isSelected ? mergeInstruments(st.id, excelData) : [];
      const alarmCount = stInstruments.filter((i) => i.status === "alarm").length;
      const warnCount = stInstruments.filter((i) => i.status === "warning").length;
      const status: InstrumentStatus =
        alarmCount > 0 ? "alarm" : warnCount > 0 ? "warning" : "normal";
      return {
        id: st.id,
        name: st.name,
        code: st.code,
        status,
        instrumentCount: isSelected ? stInstruments.length : 0,
        alertCount: alarmCount + warnCount,
      };
    });
  }, [dbStations, selectedStationId, excelData]);

  const alerts = React.useMemo(() => {
    const out: Array<{
      id: string;
      instrumentCode: string;
      instrumentLabel: string;
      stationId: string;
      stationName: string;
      type: InstrumentType;
      status: InstrumentStatus;
      value: number;
      unit: string;
      threshold: number;
      message: string;
      time: number;
    }> = [];
    for (const ins of allInstruments) {
      if (ins.status === "alarm" || ins.status === "warning") {
        const st = dbStations.find((s) => s.id === ins.stationId);
        const th =
          ins.status === "alarm" ? ins.threshold.alarm : ins.threshold.warning;
        out.push({
          id: ins.id,
          instrumentCode: ins.code,
          instrumentLabel: ins.label,
          stationId: ins.stationId,
          stationName: st?.name || ins.stationId,
          type: ins.type,
          status: ins.status,
          value: ins.lastReading,
          unit: ins.unit,
          threshold: th,
          message:
            ins.status === "alarm"
              ? `مقدار اندازه‌گیری شده از حد آلارم (${fmtNum(th)} ${ins.unit}) فراتر رفته است`
              : `مقدار اندازه‌گیری شده از حد هشدار (${fmtNum(th)} ${ins.unit}) فراتر رفته است`,
          time: ins.updatedAt,
        });
      }
    }
    const sev: Record<InstrumentStatus, number> = {
      alarm: 0, warning: 1, offline: 2, normal: 3,
    };
    out.sort((a, b) => sev[a.status] - sev[b.status] || b.time - a.time);
    return out;
  }, [allInstruments]);

  const station = React.useMemo(
    () => {
      const fromLive = liveStations.find((s) => s.id === selectedStationId);
      if (fromLive) return fromLive;
      const fromDb = dbStations.find((s) => s.id === selectedStationId);
      if (fromDb) return { ...fromDb, status: "normal" as InstrumentStatus, instrumentCount: 0, alertCount: 0 };
      return null;
    },
    [selectedStationId, liveStations, dbStations]
  );

  // Network-wide total for footer
  const totalInstruments = React.useMemo(
    () => allInstruments.length,
    [allInstruments]
  );

  // when station changes, auto-select first instrument of the new station
  React.useEffect(() => {
    if (instruments.length > 0) {
      setSelectedInstrumentId(instruments[0].id);
    } else {
      setSelectedInstrumentId(undefined);
    }
  }, [selectedStationId, instruments]);

  const handleSelectStation = (id: string) => {
    setSelectedStationId(id);
    setMobileNavOpen(false);
  };

  // For the station overview sidebar we use a compact summary
  const stationAlerts = alerts.filter((a) => a.stationId === selectedStationId);

  // Show a "no stations" message if the user has no accessible stations
  if (dbStations.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <DashboardHeader activeAlerts={0} onToggleAlerts={() => {}} />
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <h2 className="text-xl font-bold">ایستگاهی برای نمایش وجود ندارد</h2>
          <p className="mt-2 text-muted-foreground">
            {user.role === "ADMIN"
              ? "هنوز هیچ ایستگاهی تعریف نشده است. از پنل مدیریت یک ایستگاه جدید بسازید."
              : "مدیر سامانه هنوز به شما دسترسی به هیچ ایستگاهی نداده است."}
          </p>
          {user.role === "ADMIN" && (
            <a href="/admin" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground">
              رفتن به پنل مدیریت
            </a>
          )}
          <button
            onClick={onLogout}
            className="mt-4 text-sm text-muted-foreground underline"
          >
            خروج از حساب
          </button>
        </div>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">در حال بارگذاری ایستگاه…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader
        activeAlerts={alerts.length}
        onToggleAlerts={() => setAlertsOpen(true)}
      />

      <div className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        {/* Metro line schematic */}
        <MetroLineSchematic
          stations={liveStations}
          selectedId={selectedStationId}
          onSelect={handleSelectStation}
        />

        {/* Mobile station selector trigger */}
        <div className="mt-4 flex items-center gap-2 sm:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Layers className="h-4 w-4" />
                <span className="truncate">{station.name}</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <StationSelector
                stations={liveStations}
                selectedId={selectedStationId}
                onSelect={handleSelectStation}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Station detail header */}
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Train className="h-3.5 w-3.5" />
                <span>ایستگاه انتخاب‌شده</span>
                <span aria-hidden>•</span>
                <span className="font-mono font-semibold">{station.code}</span>
              </div>
              <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
                {station.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill status={station.status} />
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground tnum">
                  <Activity className="h-3 w-3" />
                  {instruments.length} ابزار فعال
                </span>
                {stationAlerts.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400 tnum">
                    <ShieldAlert className="h-3 w-3" />
                    {stationAlerts.length} هشدار فعال
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const idx = liveStations.findIndex((s) => s.id === selectedStationId);
                  const prev = (idx - 1 + liveStations.length) % liveStations.length;
                  handleSelectStation(liveStations[prev].id);
                }}
                aria-label="ایستگاه قبلی"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="hidden sm:inline">ایستگاه قبلی</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const idx = liveStations.findIndex((s) => s.id === selectedStationId);
                  const next = (idx + 1) % liveStations.length;
                  handleSelectStation(liveStations[next].id);
                }}
                aria-label="ایستگاه بعدی"
              >
                <span className="hidden sm:inline">ایستگاه بعدی</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Map + tabs */}
        <section className="mt-4 space-y-4">
          <InstrumentMap
            stationName={station.name}
            stationCode={station.code}
            instruments={instruments}
            selectedId={selectedInstrumentId}
            onSelect={setSelectedInstrumentId}
          />

          <InstrumentTabs
            instruments={instruments}
            selectedId={selectedInstrumentId}
            onSelect={setSelectedInstrumentId}
          />
        </section>

        {/* Project info cards */}
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <InfoCard
            title="درباره پروژه"
            icon={<Train className="h-4 w-4" />}
            body="این داشبورد نتایج ابزار دقیق پروژه احداث خط ۳ مترو را در ایستگاه‌های مختلف به نمایش می‌گذارد. در هر ایستگاه مجموعه‌ای از اکستنسومترها، اینکلاینومترها، تیلت‌مترها، چاه‌های مشاهده‌ای و درزسنج‌ها به صورت پیوسته پایش می‌شوند تا ایمنی سازه‌های زیرزمینی و مجاور تضمین شود."
          />
          <InfoCard
            title="روش پایش"
            icon={<Activity className="h-4 w-4" />}
            body="داده‌ها به صورت روزانه از ابزارها قرائت و در سیستم ثبت می‌شوند. هر اندازه‌گیری با بیس‌لاین و حدود هشدار/آلارم مقایسه شده و در صورت عبور، هشدار خودکار صادر می‌شود. کاربران می‌توانند با مراجعه به هر ایستگاه، روند زمانی هر ابزار را به همراه حدود مجاز مشاهده کنند."
          />
          <InfoCard
            title="راهنمای استفاده"
            icon={<Bell className="h-4 w-4" />}
            body="از نمودار خط مترو در بالا یک ایستگاه را انتخاب کنید. سپس در نقشه استقرار یا در تب‌های نوع ابزار، روی هر ابزار کلیک کنید تا نمودار سری زمانی آن همراه با حدود هشدار و آلارم نمایش داده شود. با کلیک روی دکمه هشدارها، فهرست کامل آلارم‌های فعال در کل پروژه را مشاهده کنید."
          />
        </section>
      </div>

      <DashboardFooter
        totalInstruments={totalInstruments}
        totalAlerts={alerts.length}
        lastUpdate={fmtDateTimeFa(NOW_TS)}
      />

      <AlertsSheet
        open={alertsOpen}
        onOpenChange={setAlertsOpen}
        alerts={alerts}
        onSelectStation={handleSelectStation}
      />
    </div>
  );
}

function StatusPill({ status }: { status: InstrumentStatus }) {
  const sc = STATUS_CLASSES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        sc.bg,
        sc.border,
        sc.text
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
      {STATUS_LABELS_FA[status]}
    </span>
  );
}

function InfoCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card-polish rounded-xl border border-border/60 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        {title}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
