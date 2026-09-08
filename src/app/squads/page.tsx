"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Crown,
  Plus,
  Hash,
  ArrowRight,
  Copy,
  Check,
  LogOut,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StateCard } from "@/components/ui-primitives";
import { getMySquad, createSquad, joinSquad, leaveSquad } from "@/lib/api";
import type { Squad } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ─── Sub-components ───────────────────────────────────────────────────────────

function MemberCard({
  member,
  isSelf,
}: {
  member: Squad["members"][number];
  isSelf: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-4 ${
        isSelf ? "border-primary/30 bg-primary/5" : "border-card-border bg-card"
      }`}
    >
      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/12 font-display font-semibold text-primary">
        {member.name.charAt(0)}
        {member.isCaptain && (
          <Crown
            size={12}
            className="absolute -right-1 -top-1 text-yellow-400"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-sm">{member.name}</span>
          {isSelf && (
            <span className="mono rounded-full bg-primary/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary">
              You
            </span>
          )}
          {member.isCaptain && (
            <span className="mono rounded-full bg-yellow-400/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-yellow-400">
              Captain
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {member.branch} · Year {member.year}
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-lg font-semibold text-primary">
          {formatNumber(member.points)}
        </div>
        <div className="mono text-[9px] text-muted-foreground">XP</div>
      </div>
    </div>
  );
}

function SquadCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/8 px-4 py-2.5 font-mono text-sm font-semibold text-primary hover:bg-primary/15 transition-colors"
      data-testid="button-copy-squad-code"
    >
      <Hash size={14} />
      {code}
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// ─── Panels ───────────────────────────────────────────────────────────────────

function CreatePanel({
  onCreated,
}: {
  onCreated: (code: string) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await createSquad(name.trim());
      if (res.status === "already_in_squad") {
        setError("You're already in a squad.");
      } else if (res.status === "ok" && res.squadCode) {
        onCreated(res.squadCode);
      } else {
        setError("Something went wrong. Try again.");
      }
    } catch {
      setError("Failed to create squad.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Squad name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Runtime Terror"
          className="auth-input mt-1.5"
          maxLength={30}
          required
          data-testid="input-squad-name"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          2–4 members per squad. You become the captain.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
        data-testid="button-create-squad"
      >
        {loading ? "Creating…" : <><Plus size={16} /> Create squad</>}
      </button>
    </form>
  );
}

function JoinPanel({ onJoined }: { onJoined: (name: string) => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await joinSquad(code.trim().toUpperCase());
      if (res.status === "ok" && res.squadName) {
        onJoined(res.squadName);
      } else if (res.status === "already_in_squad") {
        setError("You're already in a squad.");
      } else if (res.status === "squad_full") {
        setError("That squad is full (max 4 members).");
      } else if (res.status === "squad_not_found") {
        setError("Squad not found. Check the code.");
      } else {
        setError("Could not join. Try again.");
      }
    } catch {
      setError("Failed to join squad.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleJoin} className="space-y-4">
      <div>
        <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Squad code
        </label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. A1B2C3"
          className="auth-input mt-1.5 font-mono tracking-widest"
          maxLength={6}
          required
          data-testid="input-squad-code"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Get the 6-character code from your squad captain.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
        data-testid="button-join-squad"
      >
        {loading ? "Joining…" : <><ArrowRight size={16} /> Join squad</>}
      </button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SquadsPage() {
  const [squad, setSquad] = useState<Squad | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"create" | "join">("create");
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function load() {
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
    const s = await getMySquad();
    setSquad(s);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const handleLeave = async () => {
    if (!confirm("Leave squad? If you're the captain, leadership transfers to the next member."))
      return;
    setLeaving(true);
    setLeaveError("");
    try {
      const res = await leaveSquad();
      if (res.status === "ok") {
        setSquad(null);
        setSuccessMsg("You left the squad.");
      } else {
        setLeaveError("Could not leave squad.");
      }
    } catch {
      setLeaveError("Something went wrong.");
    } finally {
      setLeaving(false);
    }
  };

  const handleCreated = (code: string) => {
    setSuccessMsg(`Squad created! Code: ${code}`);
    load();
  };

  const handleJoined = (name: string) => {
    setSuccessMsg(`Joined ${name}!`);
    load();
  };

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <div className="mb-8">
          <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">
            Squads
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            Build your crew.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            2–4 members per squad. Your XP contributes to squad rankings.
          </p>
        </div>

        {loading ? (
          <StateCard kind="loading" />
        ) : squad ? (
          // ─── Has a squad ───────────────────────────────────────────────────
          <div className="grid gap-6 lg:grid-cols-[1fr_.4fr]">
            <div className="rounded-2xl border border-card-border bg-card p-6">
              {/* Squad header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-2xl">
                      👥
                    </div>
                    <div>
                      <h2 className="font-display text-2xl font-semibold">
                        {squad.name}
                      </h2>
                      <p className="mono text-[10px] text-muted-foreground">
                        {squad.members.length} member
                        {squad.members.length !== 1 ? "s" : ""} · Rank #
                        {squad.rank || "—"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-3xl font-semibold text-primary">
                    {formatNumber(squad.totalPoints)}
                  </div>
                  <div className="mono text-[10px] text-muted-foreground">
                    Squad XP
                  </div>
                </div>
              </div>

              {/* Share code */}
              <div className="mt-5 flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Squad code:
                </span>
                <SquadCodeBadge code={squad.code} />
              </div>

              {/* Members */}
              <div className="mt-6">
                <p className="mono mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Members ({squad.members.length}/4)
                </p>
                <div className="space-y-3">
                  {squad.members.map((m) => (
                    <MemberCard
                      key={m.profileId}
                      member={m}
                      isSelf={m.profileId === myProfileId}
                    />
                  ))}
                  {squad.members.length < 4 && (
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-card-border p-4 text-sm text-muted-foreground">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-card-border">
                        <Plus size={16} />
                      </div>
                      <span>
                        Invite friends with code{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {squad.code}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Leave */}
              <div className="mt-6 border-t border-border pt-4">
                {leaveError && (
                  <p className="mb-2 text-sm text-destructive">{leaveError}</p>
                )}
                <button
                  onClick={handleLeave}
                  disabled={leaving}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors"
                  data-testid="button-leave-squad"
                >
                  <LogOut size={14} />
                  {leaving ? "Leaving…" : "Leave squad"}
                </button>
              </div>
            </div>

            {/* Stats sidebar */}
            <div className="space-y-4">
              <div className="rounded-xl border border-card-border bg-card p-5">
                <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Squad stats
                </p>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/12 text-primary">
                      <Zap size={15} />
                    </div>
                    <div>
                      <div className="font-display text-xl font-semibold">
                        {formatNumber(squad.totalPoints)}
                      </div>
                      <div className="mono text-[10px] text-muted-foreground">
                        Total squad XP
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-400/10 text-cyan-300">
                      <Users size={15} />
                    </div>
                    <div>
                      <div className="font-display text-xl font-semibold">
                        {squad.members.length}/4
                      </div>
                      <div className="mono text-[10px] text-muted-foreground">
                        Members
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top member */}
              {squad.members.length > 0 && (
                <div className="rounded-xl border border-card-border bg-card p-5">
                  <p className="mono mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Top earner
                  </p>
                  {(() => {
                    const top = [...squad.members].sort(
                      (a, b) => b.points - a.points
                    )[0];
                    return (
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-400/10 font-semibold text-yellow-400">
                          {top.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">
                            {top.name}
                          </div>
                          <div className="mono text-[10px] text-muted-foreground">
                            {formatNumber(top.points)} XP
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        ) : (
          // ─── No squad ──────────────────────────────────────────────────────
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Info card */}
            <div className="rounded-2xl border border-card-border bg-card p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-3xl">
                👥
              </div>
              <h2 className="mt-6 font-display text-2xl font-semibold">
                You're not in a squad yet.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Create a squad and invite friends, or join one with a code.
                Squad XP is the combined total of all member XP.
              </p>
              <div className="mt-6 space-y-3 rounded-xl border border-card-border bg-background p-4 text-sm">
                {[
                  "Min 2, max 4 members",
                  "Earn squad XP together",
                  "Compete on squad leaderboard",
                  "Share squad code to invite",
                ].map((rule) => (
                  <div key={rule} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {rule}
                  </div>
                ))}
              </div>
            </div>

            {/* Create / Join */}
            <div className="rounded-2xl border border-card-border bg-card p-8">
              {successMsg && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400"
                  >
                    ✓ {successMsg}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Tab switcher */}
              <div className="mb-6 flex gap-1 rounded-xl border border-card-border bg-background p-1">
                {(["create", "join"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold capitalize transition-colors ${
                      tab === t
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`tab-squad-${t}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {tab === "create" ? (
                    <CreatePanel onCreated={handleCreated} />
                  ) : (
                    <JoinPanel onJoined={handleJoined} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
