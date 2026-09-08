"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, QrCode, Trophy, Gauge, ScanLine, BarChart3, Menu, X, Radio, Users, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/xpass", label: "My XPass", icon: QrCode },
  { href: "/squads", label: "Squads", icon: Users },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

function initials(name = "ED") {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({
  children,
  userName,
  userRole,
}: {
  children: React.ReactNode;
  userName?: string;
  userRole?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isStaff =
    userRole === "VOLUNTEER" ||
    userRole === "EVENT_COORDINATOR" ||
    userRole === "ADMIN" ||
    userRole === "SUPER_ADMIN";

  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  return (
    <div className="noise min-h-[100dvh] bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[248px] border-r border-sidebar-border bg-sidebar p-5 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <Brand />
            <button
              className="text-muted-foreground lg:hidden"
              onClick={() => setOpen(false)}
              data-testid="button-close-menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-10">
            <p className="mono mb-3 px-3 text-[9px] uppercase tracking-[.25em] text-muted-foreground">Explore</p>
            <nav className="space-y-1">
              {nav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  data-testid={`link-nav-${label.toLowerCase().replace(" ", "-")}`}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                    pathname === href
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <Icon size={17} />
                  {label}
                  {href === "/xpass" && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  )}
                </Link>
              ))}
            </nav>

            {isStaff && (
              <>
                <p className="mono mb-3 mt-9 px-3 text-[9px] uppercase tracking-[.25em] text-muted-foreground">
                  Staff tools
                </p>
                <nav className="space-y-1">
                  <Link
                    href="/operations"
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                      pathname === "/operations"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                    data-testid="link-nav-operations"
                  >
                    <Gauge size={17} />
                    Operations
                  </Link>
                  <Link
                    href="/scanner"
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                      pathname === "/scanner"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                    data-testid="link-nav-scanner"
                  >
                    <ScanLine size={17} />
                    Scanner
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                        pathname === "/admin"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                      )}
                      data-testid="link-nav-admin"
                    >
                      <BarChart3 size={17} />
                      Admin command
                    </Link>
                  )}
                </nav>
              </>
            )}
          </div>

          <div className="mt-auto space-y-3">
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/45 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_hsl(142_70%_60%/.8)]" />
                <span className="mono text-[10px] uppercase tracking-wider text-emerald-300">XpoX network online</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Engineers Day 2026 · Registration open.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
              data-testid="button-logout"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {open && (
        <button
          className="fixed inset-0 z-30 bg-background/70 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          data-testid="button-overlay-close"
        />
      )}

      {/* Main content */}
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-md md:px-8">
          <button
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setOpen(true)}
            data-testid="button-open-menu"
          >
            <Menu size={20} />
          </button>
          <div className="hidden items-center gap-2 lg:flex">
            <span className="mono text-[10px] text-muted-foreground">XpoX /</span>
            <span className="text-sm capitalize">
              {pathname === "/dashboard"
                ? "Student dashboard"
                : pathname.replace(/^\//, "").replace(/-/g, " ")}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/live"
              className="hidden items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground sm:flex"
              data-testid="link-live-display"
            >
              <Radio size={14} className="text-primary" /> Live leaderboard
            </Link>
            <div className="h-7 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-display text-xs font-bold text-secondary-foreground"
                data-testid="text-user-initials"
              >
                {initials(userName)}
              </div>
              <div className="hidden leading-tight sm:block">
                <div className="text-xs font-semibold" data-testid="text-user-name">
                  {userName ?? "Connecting..."}
                </div>
                <div className="mono text-[9px] uppercase text-muted-foreground">{userRole ?? "student"}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
