"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, CalendarDays, Flame, QrCode, ArrowRight, Trophy, Users, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard, StateCard, SectionHeading } from "@/components/ui-primitives";
import { getDashboardSummary, getActivity, type DashboardSummary, type ActivityItem, type Event } from "@/lib/api";
import { shortDate, formatNumber } from "@/lib/utils";
import { Pill } from "@/components/pill";
import { Clock3, MapPin, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const orange = "#ff7629";

function EventRow({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex items-center gap-3 rounded-lg border border-border/70 bg-background/30 p-3 transition-colors hover:border-primary/45"
      data-testid={`link-upcoming-event-${event.id}`}
    >
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
        <span className="mono text-[9px] uppercase">{shortDate(event.date).split(" ")[1]}</span>
        <span className="font-display text-lg font-bold leading-none">{shortDate(event.date).split(" ")[0]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{event.name}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 size={12} />
          {event.time}
          <span className="text-border">/</span>
          <MapPin size={12} />
          {event.venue}
        </p>
      </div>
      <span className="hidden mono text-xs text-primary sm:block">+{event.points} XP</span>
      <ChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

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
        setUserRole(profile?.role ?? "STUDENT");
      }
      const [sum, act] = await Promise.all([getDashboardSummary(), getActivity()]);
      setSummary(sum);
      setActivity(act);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">Student dashboard</p>
            <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              Good morning, <span className="text-primary">{summary?.studentName?.split(" ")[0] ?? "there"}.</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Here&apos;s what&apos;s next for you.</p>
          </div>
          <Link
            href="/xpass"
            className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/15"
            data-testid="link-dashboard-xpass"
          >
            <QrCode size={16} /> Open XPass
          </Link>
        </div>

        {loading ? (
          <div className="mt-8"><StateCard kind="loading" /></div>
        ) : !summary ? (
          <div className="mt-8"><StateCard kind="error" /></div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <StatCard label="Total points" value={formatNumber(summary.points)} detail={`+${formatNumber(summary.pointsToNextRank)} to next rank`} icon={<Zap size={17} />} accent="orange" />
              <StatCard label="Individual rank" value={`#${summary.leaderboardPosition}`} detail="Across all builders" icon={<Trophy size={17} />} accent="cyan" />
              <StatCard label="Events registered" value={String(summary.eventsRegistered).padStart(2, "0")} detail="Your festival route" icon={<CalendarDays size={17} />} accent="violet" />
              <StatCard label="Squad position" value={`#${summary.squadRank}`} detail={summary.squadName} icon={<Users size={17} />} accent="yellow" />
            </div>

            {/* Events + activity */}
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.9fr]">
              <div className="rounded-xl border border-card-border bg-card p-5 md:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Your route</p>
                    <h2 className="mt-1 font-display text-xl font-semibold">Upcoming events</h2>
                  </div>
                  <Link href="/events" className="text-xs font-semibold text-primary hover:underline" data-testid="link-dashboard-all-events">
                    View all <ArrowRight className="ml-1 inline" size={13} />
                  </Link>
                </div>
                {summary.upcomingEvents?.length ? (
                  <div className="space-y-2">
                    {summary.upcomingEvents.map((event) => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </div>
                ) : (
                  <StateCard kind="empty" />
                )}
              </div>

              <div className="rounded-xl border border-card-border bg-card p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Momentum</p>
                    <h2 className="mt-1 font-display text-xl font-semibold">Recent activity</h2>
                  </div>
                  <Activity size={18} className="text-primary" />
                </div>
                {activity.length ? (
                  <div className="mt-5 space-y-4">
                    {activity.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.accent || orange }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-semibold">{item.action}</span>{" "}
                            <span className="text-muted-foreground">{item.event}</span>
                          </p>
                          <p className="mono mt-1 text-[10px] text-muted-foreground">{item.time}</p>
                        </div>
                        {item.points > 0 && <span className="mono text-xs text-primary">+{item.points}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <StateCard kind="empty" />
                )}
              </div>
            </div>

            {/* Squad CTA + quote */}
            <div className="mt-6 grid gap-6 md:grid-cols-[1fr_.72fr]">
              <div className="rounded-xl border border-primary/30 bg-primary/[.07] p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <Pill tone="orange">Squad / {summary.squadName}</Pill>
                    <h2 className="mt-4 font-display text-2xl font-semibold">The board is moving.</h2>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                      You are <span className="font-semibold text-foreground">{summary.pointsToNextRank} points</span> away from
                      the next rank. Check into one more event to close the gap.
                    </p>
                  </div>
                  <Flame className="text-primary" />
                </div>
                <Link href="/leaderboard" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline" data-testid="link-dashboard-leaderboard">
                  See leaderboard <ArrowRight size={15} />
                </Link>
              </div>
              <div className="rounded-xl border border-card-border bg-card p-6">
                <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Field note</p>
                <p className="mt-4 font-display text-lg leading-snug">&ldquo;Precision is just enthusiasm with a plan.&rdquo;</p>
                <p className="mt-3 text-xs text-muted-foreground">— ED26 operations desk</p>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
