"use client";

import { useEffect, useState } from "react";
import { Zap, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StateCard } from "@/components/ui-primitives";
import { getXpLedger, adminAwardXp } from "@/lib/api";
import type { DbPointTransaction } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  REGISTRATION: "text-emerald-400",
  EVENT_REGISTRATION: "text-cyan-400",
  CHECK_IN: "text-primary",
  EVENT_COMPLETION: "text-violet-400",
  REWARD: "text-yellow-400",
  BONUS: "text-emerald-300",
  MANUAL_ADJUSTMENT: "text-orange-400",
  PENALTY: "text-destructive",
};

export default function AdminXPPage() {
  const [ledger, setLedger] = useState<DbPointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [showAward, setShowAward] = useState(false);
  const [awardForm, setAwardForm] = useState({ profileId: "", points: 0, reason: "", eventId: "" });
  const [awardLoading, setAwardLoading] = useState(false);
  const [awardError, setAwardError] = useState("");
  const [awardSuccess, setAwardSuccess] = useState(false);

  async function load() {
    const data = await getXpLedger({ limit: 100 });
    setLedger(data);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
        setUserName(p?.full_name ?? "");
        setUserRole(p?.role ?? "ADMIN");
      }
      load();
    }
    init();
  }, []);

  const handleAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardForm.profileId || !awardForm.reason) return;
    setAwardLoading(true);
    setAwardError("");
    try {
      await adminAwardXp({
        profileId: awardForm.profileId,
        points: awardForm.points,
        reason: awardForm.reason,
        eventId: awardForm.eventId || undefined,
      });
      setAwardSuccess(true);
      setShowAward(false);
      setAwardForm({ profileId: "", points: 0, reason: "", eventId: "" });
      load();
    } catch (err) {
      setAwardError(err instanceof Error ? err.message : "Failed to award XP");
    } finally {
      setAwardLoading(false);
    }
  };

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">Admin / XP Ledger</p>
            <h1 className="mt-2 font-display text-3xl font-semibold">XP ledger.</h1>
          </div>
          <button
            onClick={() => setShowAward(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
            data-testid="button-manual-xp"
          >
            <Plus size={15} /> Manual adjustment
          </button>
        </div>

        {awardSuccess && (
          <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
            ✓ XP adjustment recorded in ledger.
          </div>
        )}

        {showAward && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-card p-5">
            <h2 className="mb-4 font-semibold">Manual XP adjustment</h2>
            <form onSubmit={handleAward} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Student profile ID</label>
                <input required value={awardForm.profileId} onChange={(e) => setAwardForm((f) => ({ ...f, profileId: e.target.value }))} className="auth-input mt-1.5 font-mono text-xs" placeholder="UUID" data-testid="input-xp-profile-id" />
              </div>
              <div>
                <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Points (negative for penalty)</label>
                <input type="number" required value={awardForm.points} onChange={(e) => setAwardForm((f) => ({ ...f, points: +e.target.value }))} className="auth-input mt-1.5" data-testid="input-xp-points" />
              </div>
              <div>
                <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Event ID (optional)</label>
                <input value={awardForm.eventId} onChange={(e) => setAwardForm((f) => ({ ...f, eventId: e.target.value }))} className="auth-input mt-1.5 font-mono text-xs" placeholder="UUID (leave blank if N/A)" />
              </div>
              <div className="sm:col-span-2">
                <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Reason (mandatory)</label>
                <input required value={awardForm.reason} onChange={(e) => setAwardForm((f) => ({ ...f, reason: e.target.value }))} className="auth-input mt-1.5" placeholder="Explain why this adjustment is being made…" data-testid="input-xp-reason" />
              </div>
              {awardError && <p className="sm:col-span-2 text-sm text-destructive">{awardError}</p>}
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={awardLoading} className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
                  {awardLoading ? "Saving…" : "Record adjustment"}
                </button>
                <button type="button" onClick={() => setShowAward(false)} className="h-10 rounded-md border border-border px-4 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <StateCard kind="loading" />
        ) : ledger.length === 0 ? (
          <StateCard kind="empty" />
        ) : (
          <div className="rounded-xl border border-card-border bg-card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3 text-[10px] mono uppercase tracking-wider text-muted-foreground">
              <span>Reason</span>
              <span>Type</span>
              <span>Points</span>
              <span>When</span>
            </div>
            {ledger.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border/50 px-5 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{tx.reason}</div>
                  <div className="mono text-[10px] text-muted-foreground">{tx.profile_id.slice(0, 8)}…</div>
                </div>
                <span className={`mono text-[10px] ${TYPE_COLORS[tx.transaction_type] ?? "text-muted-foreground"}`}>
                  {tx.transaction_type}
                </span>
                <div className="flex items-center gap-1">
                  <Zap size={12} className={tx.points >= 0 ? "text-primary" : "text-destructive"} />
                  <span className={`font-display font-semibold ${tx.points >= 0 ? "text-primary" : "text-destructive"}`}>
                    {tx.points >= 0 ? "+" : ""}{formatNumber(tx.points)}
                  </span>
                </div>
                <span className="mono text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(tx.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
