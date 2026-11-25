"use client";

import * as React from "react";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "VIEWER";
  lastLoginAt: string | null;
  stations: Array<{ id: string; name: string; code: string }>;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = React.createContext<AuthCtx>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = React.useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ user, loading, refresh, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  return React.useContext(Ctx);
}
