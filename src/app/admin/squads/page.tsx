"use client";

import { useEffect, useState } from "react";
import { Users, Crown } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StateCard } from "@/components/ui-primitives";
import { getSquadLeaderboard, type SquadLeaderboardEntry } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export default function AdminSquadsPage() {
  const [squads, setSquads] = useState<SquadLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
        setUserName(p?.full_name ?? "");
        setUserRole(p?.role ?? "ADMIN");
      }
      const data = await getSquadLeaderboard({ limit: 50 });
      setSquads(data);
      setLoading(false);
    }
    init();
  }, []);

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <div className="mb-6">
          <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">Admin / Squads</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">All squads.</h1>
        </div>
        {loading ? (
          <StateCard kind="loading" />
        ) : squads.length === 0 ? (
          <StateCard kind="empty" />
        ) : (
          <div className="rounded-xl border border-card-border bg-card overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 border-b border-border px-5 py-3 text-[10px] mono uppercase tracking-wider text-muted-foreground">
              <span>Rank</span>
              <span>Squad</span>
              <span>Members</span>
              <span>XP</span>
            </div>
            {squads.map((s) => (
              <div
                key={s.squadId}
                className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center border-b border-border/50 px-5 py-3.5 last:border-0"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-display text-sm font-semibold text-muted-foreground">
                  {s.rank}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <Crown size={13} className="flex-shrink-0 text-yellow-400" />
                  <span className="truncate font-semibold text-sm">{s.squadName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users size={12} />
                  {s.memberCount}
                </div>
                <div className="font-display font-semibold text-primary">
                  {formatNumber(s.points)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
