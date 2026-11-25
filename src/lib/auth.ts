// Auth utilities: password hashing, JWT, session helpers
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";
const SESSION_COOKIE = "instrumentation_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  username: string;
  role: "ADMIN" | "VIEWER";
  displayName: string;
}

// ─── Password hashing ────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── JWT ──────────────────────────────────────────────────────────────

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SESSION_MAX_AGE}s` });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}

// ─── Cookie helpers (server-side) ────────────────────────────────────

// Determine if the request is over HTTPS (either direct or behind Caddy/HTTPS proxy).
// We check the X-Forwarded-Proto header set by reverse proxies like Caddy.
function isSecureRequest(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  // In production behind a reverse proxy, rely on x-forwarded-proto.
  // next/headers cookies() doesn't expose request headers directly,
  // so we use process.env to let the operator opt-in.
  return process.env.COOKIE_SECURE === "1";
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = signToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      lastLoginAt: true,
      stationAccess: { include: { station: true } },
    },
  });
  return user;
}

// ─── Route guards ────────────────────────────────────────────────────

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

// ─── Activity logging ────────────────────────────────────────────────

export async function logActivity(params: {
  userId?: string | null;
  username: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        userId: params.userId ?? null,
        username: params.username,
        action: params.action,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[activity] Failed to log:", err);
  }
}

// ─── Station access check for viewers ────────────────────────────────

export async function canUserAccessStation(
  session: SessionPayload,
  stationId: string
): Promise<boolean> {
  if (session.role === "ADMIN") return true;
  const access = await db.userStationAccess.findUnique({
    where: {
      userId_stationId: { userId: session.userId, stationId },
    },
  });
  return !!access;
}

export async function getAccessibleStationIds(session: SessionPayload): Promise<string[] | "ALL"> {
  if (session.role === "ADMIN") return "ALL";
  const rows = await db.userStationAccess.findMany({
    where: { userId: session.userId },
    select: { stationId: true },
  });
  return rows.map((r) => r.stationId);
}
