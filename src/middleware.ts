import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Edge-compatible auth check using jose (jsonwebtoken doesn't work in Edge runtime)
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";
const SESSION_COOKIE = "instrumentation_session";

interface SessionPayload {
  userId: string;
  username: string;
  role: "ADMIN" | "VIEWER";
  displayName: string;
}

// Cache the secret key encoder
let secretKey: Uint8Array | null = null;
function getSecretKey(): Uint8Array {
  if (!secretKey) {
    secretKey = new TextEncoder().encode(JWT_SECRET);
  }
  return secretKey;
}

async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

const PROTECTED_PREFIXES = ["/admin"];
const PROTECTED_API_PREFIXES = ["/api/admin"];

const PUBLIC_PATHS = new Set([
  "/", "/login", "/api/auth/login", "/api/auth/logout", "/api/auth/me",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || pathname.startsWith("/inclinometers/")) {
    return NextResponse.next();
  }

  const isAdminPage = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdminApi = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));
  const isStationDataApi = pathname.startsWith("/api/station-data");

  if (!isAdminPage && !isAdminApi && !isStationDataApi) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = cookie ? await verifyToken(cookie) : null;

  // Station data API requires any authenticated user
  if (isStationDataApi && !isAdminApi && !isAdminPage) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!session) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Admin pages/APIs require ADMIN role
  if (session.role !== "ADMIN") {
    if (isAdminApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isAdminPage) {
      const homeUrl = new URL("/", req.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
