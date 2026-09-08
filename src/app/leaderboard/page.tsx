"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SectionHeading, StateCard } from "@/components/ui-primitives";
import { Pill } from "@/components/pill";
import { getLeaderboard, type LeaderboardData } from "@/lib/api";
import { formatNumber, initials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const orange = "#ff7629";

export default function LeaderboardPage() {
  const [scope, setScope] = useState<"individual" | "squad">("individual");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
        setUserRole(profile?.role ?? "STUDENT");
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        setError(false);
        const d = await getLeaderboard(scope);
        setData(d);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [scope]);

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <SectionHeading
          eyebrow="Points system / live"
          title="The board."
          action={
            <div className="flex rounded-md border border-border bg-card p-1">
              {(["individual", "squad"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setScope(item)}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs font-semibold capitalize",
                    scope === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                  data-testid={`button-scope-${item}`}
                >
                  {item}
                </button>
              ))}
            </div>
          }
        />

        {loading ? (
          <StateCard kind="loading" />
        ) : error || !data ? (
          <StateCard kind="error" onRetry={() => setError(false)} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_.7fr]">
            {/* Table */}
            <div className="rounded-xl border border-card-border bg-card p-3 md:p-5">
              <div className="mb-3 grid grid-cols-[48px_1fr_90px] gap-3 px-3 py-2 mono text-[9px] uppercase tracking-wider text-muted-foreground">
                <span>Rank</span>
                <span>Builder</span>
                <span className="text-right">Points</span>
              </div>
              {data.entries.map((entry, index) => (
                <div
                  key={`${entry.name}-${index}`}
                  className={cn(
                    "grid grid-cols-[48px_1fr_90px] items-center gap-3 rounded-lg px-3 py-4",
                    entry.rank === data.currentRank && "border border-primary/35 bg-primary/[.07]"
                  )}
                  data-testid={`row-leaderboard-${index}`}
                >
                  <span
                    className={cn(
                      "font-display text-xl font-semibold",
                      entry.rank <= 3 ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {String(entry.rank).padStart(2, "0")}
                  </span>
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: `${entry.accent || orange}22`,
                        color: entry.accent || orange,
                      }}
                    >
                      {initials(entry.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{entry.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{entry.subtitle}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="mono text-sm font-semibold">{formatNumber(entry.points)}</div>
                    <div
                      className={cn(
                        "mt-1 inline-flex items-center gap-1 mono text-[9px]",
                        entry.change >= 0 ? "text-emerald-300" : "text-destructive"
                      )}
                    >
                      {entry.change >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                      {Math.abs(entry.change)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/[.07] p-6">
                <Pill tone="orange">Your position</Pill>
                <div className="mt-4 font-display text-6xl font-semibold">#{data.currentRank}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Only{" "}
                  <span className="font-semibold text-foreground">
                    {formatNumber(data.pointsToNextRank)} points
                  </span>{" "}
                  until your next overtake.
                </p>
                <Link
                  href="/events"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                  data-testid="link-leaderboard-events"
                >
                  Find your next points <ArrowRight size={15} />
                </Link>
              </div>
              <div className="rounded-xl border border-card-border bg-card p-6">
                <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  How to climb
                </p>
                <div className="mt-5 space-y-4">
                  {[
                    ["Check in", "Be in the room when it counts"],
                    ["Ship work", "Complete a build event"],
                    ["Bring people", "Grow your squad momentum"],
                  ].map(([a, b], i) => (
                    <div key={a} className="flex gap-3">
                      <span className="mono text-xs text-primary">0{i + 1}</span>
                      <div>
                        <div className="text-sm font-semibold">{a}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{b}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
