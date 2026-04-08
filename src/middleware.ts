import { NextRequest, NextResponse } from "next/server";

const DEMO_RESPONSE = NextResponse.json(
  { error: "데모 모드에서는 데이터를 수정할 수 없습니다." },
  { status: 403 },
);

export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return;

  const path = request.nextUrl.pathname;

  // Block all non-GET API requests (POST, PATCH, DELETE)
  if (request.method !== "GET") {
    return DEMO_RESPONSE;
  }

  // Block GET routes that write to DB (cron jobs)
  if (path.startsWith("/api/cron/")) {
    return DEMO_RESPONSE;
  }
}

export const config = {
  matcher: "/api/:path*",
};
