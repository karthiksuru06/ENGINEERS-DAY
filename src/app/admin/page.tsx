"use client";

import { useEffect, useState, createElement } from "react";
import { Activity, BarChart3, CheckCircle2, Radio, Users, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SectionHeading, StateCard } from "@/components/ui-primitives";
import { Pill } from "@/components/pill";
import { getAdminSummary, type AdminSummary } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export default function AdminPage() {
  const [data, setData] = useState<AdminSummary | null>(null);
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
        setUserRole(profile?.role ?? "ADMIN");
      }
      const d = await getAdminSummary();
      setData(d);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <SectionHeading
          eyebrow="Admin / command center"
          title="See the whole system."
          action={
            <Pill tone="cyan">
              <Activity size={12} className="mr-1" /> Refreshing live
            </Pill>
          }
        />

        {loading ? (
          <StateCard kind="loading" />
        ) : !data ? (
          <StateCard kind="error" />
        ) : (
          <>
            {/* KPI tiles */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {([
                ["Registered students", data.totalStudents, Users],
                ["Checked in", data.checkedIn, CheckCircle2],
                ["Active events", data.activeEvents, Radio],
                ["Active squads", data.activeSquads, Users],
                ["Total XP", data.totalXpDistributed, Zap],
              ] as const).map(([label, value, Icon], index) => (
                <div key={String(label)} className="rounded-xl border border-card-border bg-card p-5">
                  <div
                    className={cn(
                      "mb-7 flex h-8 w-8 items-center justify-center rounded-md",
                      index === 0 ? "bg-primary/15 text-primary" : "bg-cyan-400/10 text-cyan-300"
                    )}
                  >
                    {createElement(Icon, { size: 17 })}
                  </div>
                  <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {String(label)}
                  </div>
                  <div className="mt-1 font-display text-3xl font-semibold">
                    {formatNumber(Number(value))}
                  </div>
                </div>
              ))}
            </div>

            {/* Chart + category mix */}
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_.7fr]">
              {/* Bar chart */}
              <div className="rounded-xl border border-card-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Registration velocity
                    </p>
                    <h2 className="mt-1 font-display text-xl font-semibold">The signal is climbing.</h2>
                  </div>
                  <BarChart3 className="text-primary" size={19} />
                </div>
                <div className="mt-8 flex h-48 items-end gap-2 border-b border-border">
                  {data.registrationsByDay.map((day) => (
                    <div key={day.day} className="group flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full max-w-10 rounded-t-sm bg-primary transition-all group-hover:bg-cyan-300"
                        style={{
                          height: `${Math.max(
                            8,
                            (day.registrations /
                              Math.max(
                                ...data.registrationsByDay.map((x) => x.registrations),
                                1
                              )) *
                              100
                          )}%`,
                        }}
                        title={`${day.registrations} registrations`}
                      />
                      <span className="mono text-[9px] text-muted-foreground">{day.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category mix */}
              <div className="rounded-xl border border-card-border bg-card p-6">
                <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Category mix
                </p>
                <div className="mt-6 space-y-5">
                  {data.categoryMix.map((item, index) => (
                    <div key={item.category}>
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="font-semibold">{item.category}</span>
                        <span className="mono text-muted-foreground">{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{
                            width: `${Math.min(
                              100,
                              (item.count /
                                Math.max(...data.categoryMix.map((x) => x.count), 1)) *
                                100
                            )}%`,
                            opacity: 1 - index * 0.12,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
