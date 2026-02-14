import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const publicPaths = ["/", "/login", "/signup", "/pricing", "/forgot-password"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const path = nextUrl.pathname;

  // Allow API routes and static assets
  if (path.startsWith("/api") || path.startsWith("/_next")) {
    return NextResponse.next();
  }

  const isPublicPath = publicPaths.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  // Redirect authed users away from login/signup
  if (isLoggedIn && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL("/home", nextUrl));
  }

  // Protect authenticated routes
  if (!isPublicPath && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(path);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
