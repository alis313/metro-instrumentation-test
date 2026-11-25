"use client";

import * as React from "react";
import { Moon, Sun, Bell, Search, Download, Train } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  activeAlerts: number;
  onToggleAlerts: () => void;
}

export function DashboardHeader({
  activeAlerts,
  onToggleAlerts,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <header className="hero-bg dark sticky top-0 z-40 border-b border-border/60">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Train className="h-5 w-5" strokeWidth={2.5} />
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
            </span>
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-extrabold sm:text-lg">
              سامانه پایش ابزار دقیق خط مترو
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Metro Line Instrumentation Monitoring System
            </p>
          </div>
        </div>

        {/* Search (desktop) */}
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="جستجوی ایستگاه، ابزار یا کد..."
              className="border-border/50 bg-card/50 pr-9 backdrop-blur"
              aria-label="جستجو"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="ms-auto flex items-center gap-2">
          {/* Live badge */}
          <div className="hidden items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 backdrop-blur sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              پایش زنده
            </span>
          </div>

          {/* Alerts */}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAlerts}
            className="relative gap-1.5 border-border/50 bg-card/50 backdrop-blur"
            aria-label="هشدارها"
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">هشدارها</span>
            {activeAlerts > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tnum glow-alarm">
                {activeAlerts}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="hidden gap-1.5 border-border/50 bg-card/50 backdrop-blur sm:flex"
          >
            <Download className="h-4 w-4" />
            <span>خروجی</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="border-border/50 bg-card/50 backdrop-blur"
            aria-label="تغییر تم"
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
