"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Users,
  CalendarDays,
  Gift,
  Zap,
  Shield,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { href: "/admin", label: "Analytics", icon: BarChart3, exact: true },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/squads", label: "Squads", icon: Users },
  { href: "/admin/xp", label: "XP Ledger", icon: Zap },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
  { href: "/admin/audit", label: "Audit Log", icon: ClipboardList },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      {/* Admin sub-nav */}
      <div className="mb-6 -mx-5 border-b border-border px-5 md:-mx-8 md:px-8">
        <div className="flex items-center gap-1 overflow-x-auto pb-0">
          <div className="flex items-center gap-1 pb-3">
            <Shield size={14} className="flex-shrink-0 text-primary mr-2" />
            <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground mr-4">
              Admin
            </span>
          </div>
          {adminNav.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact
              ? pathname === href
              : pathname.startsWith(href) && href !== "/admin";
            const isExactAdmin = pathname === "/admin" && href === "/admin";
            const active = isActive || isExactAdmin;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 pb-3 px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                data-testid={`link-admin-nav-${label.toLowerCase().replace(" ", "-")}`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
