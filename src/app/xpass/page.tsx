"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode, Users, Zap, Trophy, ArrowRight, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import { AppShell } from "@/components/app-shell";
import { StateCard } from "@/components/ui-primitives";
import { getXPass, type XPass } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ─── Identity config ──────────────────────────────────────────────────────────

const IDENTITY_EMOJI: Record<string, string> = {
  Builder: "🔨",
  Gamer: "🎮",
  Creator: "🎨",
  Founder: "🚀",
  Speaker: "🎤",
  Explorer: "🔭",
};

const INTEREST_EMOJI: Record<string, string> = {
  "AI / ML": "🤖",
  "Web / App Development": "💻",
  Cybersecurity: "🛡️",
  "Robotics / IoT": "⚙️",
  Gaming: "🎮",
  "Content / Reels": "🎬",
  Startups: "🚀",
  "Public Speaking": "🎤",
  "Design / UI/UX": "🎨",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${accent ? "border-primary/40 bg-primary/8" : "border-card-border bg-background"}`}
    >
      <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-lg font-semibold ${accent ? "text-primary" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function XPassCard({ xpass }: { xpass: XPass }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = `🎫 My XPoX XPass\nName: ${xpass.name}\nXPass ID: ${xpass.xpassId}\nPoints: ${xpass.points} XP\nRank: #${xpass.rank}`;
    if (navigator.share) {
      await navigator.share({ title: "My XPass", text });
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const identity = xpass.identityTags?.[0];
  const identityEmoji = identity ? (IDENTITY_EMOJI[identity] ?? "⚡") : "⚡";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card"
      style={{
        background:
          "linear-gradient(135deg, hsl(27 100% 57%/.07), transparent 40%, hsl(174 64% 43%/.05))",
      }}
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/8 blur-3xl" />

      <div className="relative p-6 md:p-8">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">
              XpoX / Engineers Day 2026
            </p>
            <h2 className="mt-4 font-display text-2xl font-semibold md:text-3xl">
              {xpass.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {xpass.branch} · Year {xpass.year}
            </p>
          </div>
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/12 text-2xl">
            {identityEmoji}
          </div>
        </div>

        {/* Identity badges */}
        {xpass.identityTags?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {xpass.identityTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
              >
                {IDENTITY_EMOJI[tag] ?? "⚡"} {tag}
              </span>
            ))}
          </div>
        )}

        {/* QR Code */}
        <div className="my-8 flex justify-center">
          <div className="relative">
            {/* Pulse ring */}
            <div className="absolute inset-0 animate-ping rounded-lg bg-primary/15 [animation-duration:2.5s]" />
            <div className="relative rounded-xl bg-white p-4 shadow-[8px_8px_0_hsl(27_100%_57%/.35)]">
              <QRCode
                value={xpass.qrToken}
                size={168}
                bgColor="#ffffff"
                fgColor="#17202a"
                level="M"
              />
            </div>
          </div>
        </div>

        {/* XPass ID */}
        <div className="mb-6 text-center">
          <p className="mono text-xs tracking-[.2em] text-muted-foreground">
            {xpass.xpassId}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill label="XP Total" value={formatNumber(xpass.points)} accent />
          <StatPill label="Rank" value={`#${xpass.rank || "—"}`} />
          <StatPill
            label="Squad"
            value={xpass.squad ?? "No squad"}
          />
          <StatPill
            label="Squad rank"
            value={xpass.squadRank ? `#${xpass.squadRank}` : "—"}
          />
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 rounded-md border border-border bg-background/70 px-4 py-2.5 text-sm font-semibold hover:border-primary/50"
            data-testid="button-share-xpass"
          >
            <Share2 size={15} />
            {copied ? "Copied!" : "Share"}
          </button>
          {!xpass.squad && (
            <Link
              href="/squads"
              className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/8 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/15"
            >
              <Users size={15} /> Join a squad
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function XPassPage() {
  const [xpass, setXpass] = useState<XPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();
        setUserName(profile?.full_name ?? "");
        setUserRole(profile?.role ?? "STUDENT");
      }
      const data = await getXPass();
      setXpass(data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">
              Your event pass
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold">
              My XPass.
            </h1>
          </div>
          <Link
            href="/events"
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:-translate-y-0.5 transition-transform"
          >
            <QrCode size={15} /> Browse events
          </Link>
        </div>

        {loading ? (
          <StateCard kind="loading" />
        ) : !xpass ? (
          <div className="rounded-xl border border-card-border bg-card p-12 text-center">
            <QrCode size={40} className="mx-auto text-muted-foreground" />
            <h2 className="mt-4 font-display text-xl font-semibold">
              No XPass found
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete your registration to get your XPass.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
            >
              Register now <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_.36fr]">
            {/* Main card */}
            <XPassCard xpass={xpass} />

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Interests */}
              {xpass.interests?.length > 0 && (
                <div className="rounded-xl border border-card-border bg-card p-5">
                  <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Interests
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {xpass.interests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full border border-card-border bg-background px-3 py-1 text-xs font-medium"
                      >
                        {INTEREST_EMOJI[interest] ?? "·"} {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Squad card */}
              <div className="rounded-xl border border-card-border bg-card p-5">
                <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Squad
                </p>
                {xpass.squad ? (
                  <div className="mt-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                        <Users size={18} />
                      </div>
                      <div>
                        <div className="font-semibold">{xpass.squad}</div>
                        {xpass.squadCode && (
                          <div className="mono text-[10px] text-muted-foreground">
                            Code: {xpass.squadCode}
                          </div>
                        )}
                      </div>
                    </div>
                    <Link
                      href="/squads"
                      className="mt-3 flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="text-muted-foreground">View squad</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-muted-foreground">
                      You&apos;re not in a squad yet.
                    </p>
                    <Link
                      href="/squads"
                      className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 px-3 py-3 text-sm font-semibold text-primary hover:bg-primary/5"
                    >
                      <Users size={15} /> Create or join
                    </Link>
                  </div>
                )}
              </div>

              {/* Quick links */}
              <div className="rounded-xl border border-card-border bg-card p-5">
                <p className="mono mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Quick access
                </p>
                <div className="space-y-1">
                  {[
                    {
                      href: "/leaderboard",
                      icon: Trophy,
                      label: "Leaderboard",
                    },
                    { href: "/events", icon: QrCode, label: "Browse events" },
                    { href: "/dashboard", icon: Zap, label: "Dashboard" },
                  ].map(({ href, icon: Icon, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Icon size={15} />
                      {label}
                    </Link>
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
