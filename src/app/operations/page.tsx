"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, CheckCircle2, ScanLine, Clock3, MapPin, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SectionHeading, StateCard, StatCard } from "@/components/ui-primitives";
import { Pill } from "@/components/pill";
import { getOperationsSummary, type OperationsSummary, type Event } from "@/lib/api";
import { shortDate, formatNumber } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

function EventRow({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex items-center gap-3 rounded-lg border border-border/70 bg-background/30 p-3 transition-colors hover:border-primary/45"
    >
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
        <span className="mono text-[9px] uppercase">{shortDate(event.date).split(" ")[1]}</span>
        <span className="font-display text-lg font-bold leading-none">{shortDate(event.date).split(" ")[0]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{event.name}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 size={12} />{event.startTime}
          <span className="text-border">/</span>
          <MapPin size={12} />{event.venue}
        </p>
      </div>
      <span className="hidden mono text-xs text-primary sm:block">+{event.registrationXp} XP</span>
      <ChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

export default function OperationsPage() {
  const [data, setData] = useState<OperationsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();
        setUserName(profile?.full_name ?? "");
        setUserRole(profile?.role ?? "VOLUNTEER");
      }
      const d = await getOperationsSummary();
      setData(d);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <SectionHeading
          eyebrow="Staff systems / operations"
          title="Keep the room moving."
          action={
            <Pill tone="green">
              <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live operations
            </Pill>
          }
        />

        {loading ? (
          <StateCard kind="loading" />
        ) : !data ? (
          <StateCard kind="error" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard label="Checked in today" value={formatNumber(data.checkedInToday)} detail="Across all active events" icon={<CheckCircle2 size={17} />} accent="cyan" />
              <StatCard label="Recent scans" value={String(data.recentScans?.length ?? 0).padStart(2, "0")} detail="This session" icon={<ScanLine size={17} />} accent="orange" />
              <StatCard label="Assigned events" value={String(data.assignedEvents.length).padStart(2, "0")} detail={`Staff: ${data.staffName}`} icon={<CalendarDays size={17} />} accent="violet" />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-xl border border-card-border bg-card p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Your stations</p>
                    <h2 className="mt-1 font-display text-xl font-semibold">Assigned events</h2>
                  </div>
                  <Link
                    href="/scanner"
                    className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                    data-testid="link-operations-scanner"
                  >
                    <ScanLine size={14} /> Open scanner
                  </Link>
                </div>
                <div className="space-y-2">
                  {data.assignedEvents.length ? (
                    data.assignedEvents.map((event) => <EventRow key={event.id} event={event} />)
                  ) : (
                    <StateCard kind="empty" />
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-card-border bg-card p-5">
                <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Latest scans</p>
                <div className="mt-5 space-y-4">
                  {data.recentScans?.length ? (
                    data.recentScans.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
                          <Check size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.event}</p>
                        </div>
                        <span className="mono text-[10px] text-muted-foreground">{item.time}</span>
                      </div>
                    ))
                  ) : (
                    <StateCard kind="empty" />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
