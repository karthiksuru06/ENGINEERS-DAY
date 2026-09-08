"use client";

import { useEffect, useState, useCallback } from "react";
import { Brand } from "@/components/brand";
import { Pill } from "@/components/pill";
import { ThemeToggle } from "@/components/theme-toggle";
import { getIndividualLeaderboard, type LeaderboardData } from "@/lib/api";
import { formatNumber, initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

const orange = "#ff7629";

const IDENTITY_EMOJI: Record<string, string> = {
  Builder: "🔨",
  Gamer: "🎮",
  Creator: "🎨",
  Founder: "🚀",
  Speaker: "🎤",
  Explorer: "🔭",
};

export default function LiveDisplayPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [countdown, setCountdown] = useState(10);

  const fetchData = useCallback(async () => {
    const d = await getIndividualLeaderboard({ limit: 10 });
    setData(d);
    setCountdown(10);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const tick = setInterval(
      () => setCountdown((c) => (c > 0 ? c - 1 : 10)),
      1000
    );
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
            <Pill tone="orange">Engineers Day 2026 — XpoX</Pill>
            <h1 className="mt-7 font-display text-6xl font-semibold leading-[.88] tracking-[-.06em] md:text-8xl">
              Who&apos;s
              <br />
              <span className="text-primary">moving?</span>
            </h1>
            <p className="mt-8 max-w-sm text-lg leading-relaxed text-muted-foreground">
              Every check-in is a signal. Every point is momentum. This is the
              board, live from campus.
            </p>
            <div className="mt-14 border-l-2 border-primary pl-5">
              <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Next update
              </div>
              <div className="mt-2 font-display text-3xl">
                00:{String(countdown).padStart(2, "0")}
              </div>
            </div>

            {/* Top 3 podium */}
            {data && data.entries.length >= 3 && (
              <div className="mt-10 flex items-end gap-3">
                {[1, 0, 2].map((i) => {
                  const entry = data.entries[i];
                  if (!entry) return null;
                  const heights = ["h-20", "h-28", "h-16"];
                  return (
                    <div key={entry.profileId} className="flex-1 text-center">
                      <div className="mb-2 font-semibold text-xs truncate">
                        {entry.name.split(" ")[0]}
                      </div>
                      <div
                        className={cn(
                          "flex items-center justify-center rounded-t-lg bg-primary/15 font-display text-2xl font-bold text-primary",
                          heights[i === 0 ? 1 : i === 1 ? 0 : 2]
                        )}
                      >
                        #{entry.rank}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
              data.entries.slice(0, 10).map((entry, index) => {
                const emoji =
                  entry.identityTags?.[0]
                    ? (IDENTITY_EMOJI[entry.identityTags[0]] ?? null)
                    : null;
                return (
                  <div
                    key={entry.profileId}
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
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full font-display font-bold"
                        style={{
                          backgroundColor: `${orange}22`,
                          color: orange,
                        }}
                      >
                        {emoji ?? initials(entry.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-display text-lg font-semibold">
                          {entry.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {entry.branch}
                          {entry.year ? ` · Y${entry.year}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-semibold">
                        {formatNumber(entry.points)}
                      </div>
                      <div className="mono text-[9px] uppercase tracking-wider text-primary">
                        XP
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
