import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const protectedRoutes = [
    "/dashboard",
    "/courses",
    "/quizzes",
    "/assignments",
    "/grades",
    "/contracts",
    "/rules",
    "/clauses",
    "/clause-library",
    "/settings",
    "/users",
    "/upgrade",
  ];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isAuthRoute = pathname.startsWith("/login");
  const isSetPasswordRoute = pathname.startsWith("/set-password");
  const isMaintenanceRoute = pathname.startsWith("/maintenance");
  const isMaintenanceApi = pathname.startsWith("/api/maintenance");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/vercel");

  const maintenanceBypass =
    isMaintenanceRoute || isMaintenanceApi || isAuthApi || isAsset;

  // Maintenance mode: while the portal flag is on, every page except the
  // maintenance screen itself (and auth/assets) bounces to /maintenance. This
  // applies to students, admins, and unauthenticated visitors alike.
  if (!maintenanceBypass) {
    try {
      const statusRes = await fetch(
        `${request.nextUrl.origin}/api/maintenance/status`,
        {
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
        },
      );
      const statusData = (await statusRes.json().catch(() => ({}))) as {
        enabled?: boolean;
      };
      if (statusData?.enabled) {
        return NextResponse.redirect(new URL("/maintenance", request.url));
      }
    } catch {
      // Treat a status fetch failure as "not in maintenance".
    }
  }

  // 2. Early exit: If no session cookie exists, redirect immediately (Fast Edge Check)
  if (!sessionCookie) {
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // 3. User has a cookie. Fetch full session via API to bypass Edge limitations.
  try {
    const sessionRes = await fetch(
      `${request.nextUrl.origin}/api/auth/get-session`,
      {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      },
    );

    const sessionData = await sessionRes.json();

    if (!sessionData || !sessionData.user) {
      if (isProtectedRoute) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      return NextResponse.next();
    }

    if (sessionData.user.mustChangePassword && !isSetPasswordRoute) {
      return NextResponse.redirect(new URL("/set-password", request.url));
    }

    if (isAuthRoute) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  } catch (error) {
    console.error("Proxy session fetch error:", error);
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

// Ensure the matcher catches everything except static files and API routes
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)",
  ],
};
