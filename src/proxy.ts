import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/xpass", "/events", "/leaderboard"];
const STAFF_ROUTES = ["/operations", "/scanner"];
const ADMIN_ROUTES = ["/admin"];
const AUTH_ROUTES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  // If Supabase env vars are not yet configured, pass all requests through.
  // Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let proxyResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          proxyResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            proxyResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // If logged in and on auth pages, redirect to dashboard
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If not logged in and on protected routes, redirect to login
  const isProtected =
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) ||
    STAFF_ROUTES.some((route) => pathname.startsWith(route)) ||
    ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Role-based checks for staff/admin routes
  if (
    user &&
    (STAFF_ROUTES.some((r) => pathname.startsWith(r)) ||
      ADMIN_ROUTES.some((r) => pathname.startsWith(r)))
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile?.role as string) ?? "STUDENT";

    if (
      ADMIN_ROUTES.some((r) => pathname.startsWith(r)) &&
      role !== "ADMIN" &&
      role !== "SUPER_ADMIN"
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const isStaff =
      role === "VOLUNTEER" ||
      role === "EVENT_COORDINATOR" ||
      role === "ADMIN" ||
      role === "SUPER_ADMIN";
    if (STAFF_ROUTES.some((r) => pathname.startsWith(r)) && !isStaff) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return proxyResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
