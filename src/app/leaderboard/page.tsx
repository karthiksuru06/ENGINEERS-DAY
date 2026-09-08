"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Zap, Crown, ArrowUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StateCard } from "@/components/ui-primitives";
import {
  getIndividualLeaderboard,
  getSquadLeaderboard,
  type LeaderboardData,
  type SquadLeaderboardEntry,
  formatNumber,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const IDENTITY_EMOJI: Record<string, string> = {
  Builder: "🔨",
  Gamer: "🎮",
  Creator: "🎨",
  Founder: "🚀",
  Speaker: "🎤",
  Explorer: "🔭",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400/15 text-lg">
        🥇
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-400/15 text-lg">
        🥈
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600/15 text-lg">
        🥉
      </div>
    );
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-display text-sm font-semibold text-muted-foreground">
      {rank}
    </div>
  );
}

function IndividualRow({
  entry,
  isMe,
  index,
}: {
  entry: LeaderboardData["entries"][number];
  isMe: boolean;
  index: number;
}) {
  const emoji =
    entry.identityTags?.[0] ? (IDENTITY_EMOJI[entry.identityTags[0]] ?? "⚡") : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-colors ${
        isMe
          ? "border-primary/40 bg-primary/8 shadow-[0_0_0_1px_hsl(27_100%_57%/.2)]"
          : entry.rank <= 3
          ? "border-card-border bg-card"
          : "border-card-border bg-card/60"
      }`}
      data-testid={isMe ? "row-leaderboard-self" : undefined}
    >
      <RankBadge rank={entry.rank} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {emoji && <span className="text-sm">{emoji}</span>}
          <span className={`truncate font-semibold text-sm ${isMe ? "text-primary" : ""}`}>
            {entry.name}
          </span>
          {isMe && (
            <span className="mono flex-shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary">
              You
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {entry.branch}
          {entry.year ? ` · Year ${entry.year}` : ""}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Zap size={13} className="text-primary flex-shrink-0" />
        <span className="font-display text-lg font-semibold">
          {formatNumber(entry.points)}
        </span>
      </div>
    </motion.div>
  );
}

function SquadRow({
  entry,
  index,
}: {
  entry: SquadLeaderboardEntry;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-4 rounded-xl border border-card-border bg-card px-4 py-3.5"
    >
      <RankBadge rank={entry.rank} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Crown size={13} className="flex-shrink-0 text-yellow-400" />
          <span className="truncate font-semibold text-sm">
            {entry.squadName}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {entry.memberCount} member{entry.memberCount !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Zap size={13} className="text-primary flex-shrink-0" />
        <span className="font-display text-lg font-semibold">
          {formatNumber(entry.points)}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"individual" | "squad">("individual");
  const [individual, setIndividual] = useState<LeaderboardData | null>(null);
  const [squads, setSquads] = useState<SquadLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  const loadLeaderboard = useCallback(async () => {
    const [ind, sq] = await Promise.all([
      getIndividualLeaderboard({ limit: 20 }),
      getSquadLeaderboard({ limit: 20 }),
    ]);
    setIndividual(ind);
    setSquads(sq);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setMyProfileId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();
        setUserName(profile?.full_name ?? "");
        setUserRole(profile?.role ?? "STUDENT");
      }
      await loadLeaderboard();

      // Realtime subscription on xpasses for live updates
      const channel = supabase
        .channel("leaderboard-realtime")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "xpasses" },
          () => {
            loadLeaderboard();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
    init();
  }, [loadLeaderboard]);

  const myRank = individual?.myRank ?? 0;
  const pointsToNext = individual?.pointsToNextRank ?? 0;

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">
              Live leaderboard
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold">
              The board.
            </h1>
          </div>
          <div className="flex h-8 items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/8 px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="mono text-[10px] text-emerald-300">Live</span>
          </div>
        </div>

        {/* My rank banner */}
        {!loading && myRank > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/8 p-4"
          >
            <Trophy size={22} className="flex-shrink-0 text-primary" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Your rank: #{myRank}</div>
              {pointsToNext > 0 && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {formatNumber(pointsToNext)} XP to next rank
                </div>
              )}
            </div>
            {pointsToNext > 0 && (
              <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                <ArrowUp size={14} /> {formatNumber(pointsToNext)} XP
              </div>
            )}
          </motion.div>
        )}

        {/* Tab switcher */}
        <div className="mb-5 flex gap-1 rounded-xl border border-card-border bg-card p-1">
          {([
            { value: "individual", label: "Individual", icon: Trophy },
            { value: "squad", label: "Squad", icon: Users },
          ] as const).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                tab === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-leaderboard-${value}`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <StateCard kind="loading" />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="space-y-2">
                {tab === "individual" &&
                  (individual?.entries ?? []).map((entry, i) => (
                    <IndividualRow
                      key={entry.profileId}
                      entry={entry}
                      isMe={entry.profileId === myProfileId}
                      index={i}
                    />
                  ))}
                {tab === "individual" &&
                  (individual?.entries ?? []).length === 0 && (
                    <StateCard kind="empty" />
                  )}
                {tab === "squad" &&
                  squads.map((entry, i) => (
                    <SquadRow key={entry.squadId} entry={entry} index={i} />
                  ))}
                {tab === "squad" && squads.length === 0 && (
                  <StateCard kind="empty" />
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </AppShell>
  );
}
