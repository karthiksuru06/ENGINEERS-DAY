"use client";

import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { Pill } from "@/components/pill";
import { ThemeToggle } from "@/components/theme-toggle";
import { getLeaderboard, type LeaderboardData } from "@/lib/api";
import { formatNumber, initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

const orange = "#ff7629";

export default function LiveDisplayPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    async function fetchData() {
      const d = await getLeaderboard("individual");
      setData(d);
      setCountdown(10);
    }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 10)), 1000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="noise min-h-[100dvh] bg-background p-6 md:p-12">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="mono text-[10px] uppercase tracking-[.24em] text-primary">
                Live board / auto refresh
              </span>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          {/* Left: hero text */}
          <div>
            <Pill tone="orange">Engineer&apos;s Day 2026</Pill>
            <h1 className="mt-7 font-display text-6xl font-semibold leading-[.88] tracking-[-.06em] md:text-8xl">
              Who&apos;s
              <br />
              <span className="text-primary">moving?</span>
            </h1>
            <p className="mt-8 max-w-sm text-lg leading-relaxed text-muted-foreground">
              Every check-in is a signal. Every point is momentum. This is the board, live from campus.
            </p>
            <div className="mt-14 border-l-2 border-primary pl-5">
              <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Next update
              </div>
              <div className="mt-2 font-display text-3xl">
                00:{String(countdown).padStart(2, "0")}
              </div>
            </div>
          </div>

          {/* Right: leaderboard table */}
          <div className="rounded-xl border border-card-border bg-card p-3 md:p-5">
            {!data ? (
              <div className="space-y-3 animate-pulse p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted" />
                ))}
              </div>
            ) : (
              data.entries.slice(0, 8).map((entry, index) => (
                <div
                  key={`${entry.name}-${index}`}
                  className={cn(
                    "grid grid-cols-[64px_1fr_120px] items-center gap-4 border-b border-border/70 px-4 py-5 last:border-0 md:grid-cols-[80px_1fr_140px] md:px-6",
                    index === 0 && "bg-primary/[.07]"
                  )}
                >
                  <span
                    className={cn(
                      "font-display text-3xl font-semibold",
                      index < 3 ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {String(entry.rank).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full font-display font-bold"
                      style={{
                        backgroundColor: `${entry.accent || orange}22`,
                        color: entry.accent || orange,
                      }}
                    >
                      {initials(entry.name)}
                    </div>
                    <div>
                      <div className="font-display text-lg font-semibold">{entry.name}</div>
                      <div className="text-xs text-muted-foreground">{entry.subtitle}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold">
                      {formatNumber(entry.points)}
                    </div>
                    <div className="mono text-[9px] uppercase tracking-wider text-primary">points</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
