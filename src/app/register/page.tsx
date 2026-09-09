"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Sparkles, Users, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { createStudentRegistration } from "@/lib/api";
import { Brand } from "@/components/brand";
import type { IdentityTag, InterestTag } from "@/lib/supabase/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const IDENTITIES: { tag: IdentityTag; emoji: string; desc: string }[] = [
  { tag: "Builder", emoji: "🔨", desc: "I build things that work" },
  { tag: "Gamer", emoji: "🎮", desc: "I compete and conquer" },
  { tag: "Creator", emoji: "🎨", desc: "I make things look beautiful" },
  { tag: "Founder", emoji: "🚀", desc: "I turn ideas into products" },
  { tag: "Speaker", emoji: "🎤", desc: "I inspire through words" },
  { tag: "Explorer", emoji: "🔭", desc: "I learn everything I can" },
];

const INTERESTS: { tag: InterestTag; icon: string }[] = [
  { tag: "AI / ML", icon: "🤖" },
  { tag: "Web / App Development", icon: "💻" },
  { tag: "Cybersecurity", icon: "🛡️" },
  { tag: "Robotics / IoT", icon: "🤖" },
  { tag: "Gaming", icon: "🎮" },
  { tag: "Content / Reels", icon: "🎬" },
  { tag: "Startups", icon: "🚀" },
  { tag: "Public Speaking", icon: "🎤" },
  { tag: "Design / UI/UX", icon: "🎨" },
];

const BRANCHES = [
  "Computer Science",
  "Information Technology",
  "Electronics & Communication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Chemical Engineering",
  "Biotechnology",
  "Other",
];

const TOTAL_STEPS = 4;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i < current
              ? "bg-primary w-6"
              : i === current
              ? "bg-primary w-8"
              : "bg-muted w-4"
          }`}
        />
      ))}
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
  }),
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [auth, setAuth] = useState({ email: "", password: "" });
  const [profile, setProfile] = useState({
    fullName: "",
    collegeId: "",
    branch: "Computer Science",
    year: "2",
    whatsapp: "",
  });
  const [identity, setIdentity] = useState<IdentityTag | null>(null);
  const [interests, setInterests] = useState<Set<InterestTag>>(new Set());

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };
  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
    setError("");
  };

  const toggleInterest = (tag: InterestTag) => {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleAuthStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      // Try sign up first
      const { error: signUpError, data } = await supabase.auth.signUp({
        email: auth.email,
        password: auth.password,
      });
      if (signUpError) {
        // If user exists, try sign in instead
        if (
          signUpError.message.includes("already registered") ||
          signUpError.message.includes("already exists")
        ) {
          const { error: signInError } = await supabase.auth.signInWithPassword(
            { email: auth.email, password: auth.password }
          );
          if (signInError) throw signInError;
        } else {
          throw signUpError;
        }
      }
      if (data?.user && !data.session) {
        // Email confirmation required — skip for now with OTP disabled
      }
      goNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.fullName.trim() || !profile.collegeId.trim()) {
      setError("Please fill in all required fields");
      return;
    }
    setError("");
    goNext();
  };

  const handleIdentityStep = () => {
    if (!identity) {
      setError("Please choose your identity");
      return;
    }
    setError("");
    goNext();
  };

  const handleFinalSubmit = async () => {
    if (interests.size === 0) {
      setError("Pick at least one interest");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await createStudentRegistration({
        fullName: profile.fullName,
        collegeId: profile.collegeId,
        branch: profile.branch,
        year: profile.year,
        whatsapp: profile.whatsapp,
        email: auth.email,
        identity: identity ? [identity] : [],
        interests: Array.from(interests),
      });
      goNext(); // go to success step
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="noise min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5">
        <Brand />
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
      </header>

      <main className="mx-auto max-w-lg px-6 pb-16 pt-6">
        {/* Progress */}
        {step < TOTAL_STEPS && (
          <div className="mb-8 flex items-center justify-between">
            <StepIndicator current={step} total={TOTAL_STEPS} />
            <span className="mono text-[10px] text-muted-foreground">
              Step {step + 1} of {TOTAL_STEPS}
            </span>
          </div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            {/* ─── Step 0: Auth ──────────────────────────────────── */}
            {step === 0 && (
              <div>
                <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">
                  01 / Account
                </p>
                <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">
                  Get your{" "}
                  <span className="text-primary">XPass.</span>
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  One registration. Every event at Engineers Day 2026.
                </p>
                <form onSubmit={handleAuthStep} className="mt-8 space-y-4">
                  <Field label="Email address">
                    <input
                      required
                      type="email"
                      value={auth.email}
                      onChange={(e) =>
                        setAuth((a) => ({ ...a, email: e.target.value }))
                      }
                      placeholder="you@college.edu"
                      className="auth-input"
                      data-testid="input-register-email"
                    />
                  </Field>
                  <Field
                    label="Password"
                    hint="Minimum 6 characters. You'll use this to log in later."
                  >
                    <input
                      required
                      type="password"
                      minLength={6}
                      value={auth.password}
                      onChange={(e) =>
                        setAuth((a) => ({ ...a, password: e.target.value }))
                      }
                      placeholder="min 6 characters"
                      className="auth-input"
                      data-testid="input-register-password"
                    />
                  </Field>
                  {error && (
                    <p className="text-sm text-destructive" data-testid="status-registration-form-error">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
                    data-testid="button-submit-auth"
                  >
                    {loading ? "Checking…" : <>Continue <ArrowRight size={16} /></>}
                  </button>
                  <p className="text-center text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login" className="font-semibold text-primary">
                      Sign in
                    </Link>
                  </p>
                </form>
              </div>
            )}

            {/* ─── Step 1: Profile Info ──────────────────────────── */}
            {step === 1 && (
              <div>
                <button
                  onClick={goBack}
                  className="mb-5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">
                  02 / Your details
                </p>
                <h2 className="mt-4 font-display text-3xl font-semibold">
                  Who are you?
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  This appears on your XPass and leaderboard.
                </p>
                <form onSubmit={handleProfileStep} className="mt-8 space-y-4">
                  <Field label="Full name">
                    <input
                      required
                      minLength={2}
                      value={profile.fullName}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, fullName: e.target.value }))
                      }
                      placeholder="Your name as on ID card"
                      className="auth-input"
                      data-testid="input-register-name"
                    />
                  </Field>
                  <Field label="College ID">
                    <input
                      required
                      minLength={2}
                      value={profile.collegeId}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, collegeId: e.target.value }))
                      }
                      placeholder="e.g. 24CSE041"
                      className="auth-input"
                      data-testid="input-register-college"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Branch">
                      <select
                        value={profile.branch}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, branch: e.target.value }))
                        }
                        className="auth-input"
                        data-testid="select-register-branch"
                      >
                        {BRANCHES.map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Year">
                      <select
                        value={profile.year}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, year: e.target.value }))
                        }
                        className="auth-input"
                        data-testid="select-register-year"
                      >
                        {["1", "2", "3", "4"].map((y) => (
                          <option key={y}>Year {y}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field
                    label="WhatsApp number"
                    hint="For event updates and reminders."
                  >
                    <input
                      required
                      type="tel"
                      value={profile.whatsapp}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, whatsapp: e.target.value }))
                      }
                      placeholder="+91 98765 43210"
                      className="auth-input"
                      data-testid="input-register-whatsapp"
                    />
                  </Field>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  <button
                    type="submit"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground"
                    data-testid="button-submit-profile"
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            )}

            {/* ─── Step 2: Identity ──────────────────────────────── */}
            {step === 2 && (
              <div>
                <button
                  onClick={goBack}
                  className="mb-5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">
                  03 / Your identity
                </p>
                <h2 className="mt-4 font-display text-3xl font-semibold">
                  Who do you{" "}
                  <span className="text-primary">roll as?</span>
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Pick the one that fits best. This shows on your XPass badge.
                </p>
                <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {IDENTITIES.map(({ tag, emoji, desc }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setIdentity(tag)}
                      className={`group relative rounded-xl border p-4 text-left transition-all duration-150 ${
                        identity === tag
                          ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(27_100%_57%/.5)]"
                          : "border-card-border bg-card hover:border-primary/40"
                      }`}
                      data-testid={`button-identity-${tag.toLowerCase()}`}
                    >
                      {identity === tag && (
                        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                          <Check size={11} className="text-primary-foreground" />
                        </div>
                      )}
                      <div className="text-2xl">{emoji}</div>
                      <div className="mt-2 font-semibold text-sm">{tag}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                        {desc}
                      </div>
                    </button>
                  ))}
                </div>
                {error && (
                  <p className="mt-4 text-sm text-destructive">{error}</p>
                )}
                <button
                  type="button"
                  onClick={handleIdentityStep}
                  className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground"
                  data-testid="button-submit-identity"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* ─── Step 3: Interests ─────────────────────────────── */}
            {step === 3 && (
              <div>
                <button
                  onClick={goBack}
                  className="mb-5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">
                  04 / Interests
                </p>
                <h2 className="mt-4 font-display text-3xl font-semibold">
                  What gets you{" "}
                  <span className="text-primary">excited?</span>
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Pick as many as you like. We&apos;ll use this to recommend events.
                </p>
                <div className="mt-7 flex flex-wrap gap-2.5">
                  {INTERESTS.map(({ tag, icon }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                        interests.has(tag)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-card-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                      data-testid={`button-interest-${tag.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                    >
                      <span>{icon}</span>
                      {tag}
                      {interests.has(tag) && (
                        <Check size={12} className="text-primary" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-right">
                  <span className="mono text-[10px] text-muted-foreground">
                    {interests.size} selected
                  </span>
                </div>
                {error && (
                  <p className="mt-4 text-sm text-destructive">{error}</p>
                )}
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={loading}
                  className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
                  data-testid="button-submit-registration"
                >
                  {loading ? (
                    "Creating your XPass…"
                  ) : (
                    <>
                      <Sparkles size={16} /> Issue my XPass
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ─── Step 4: Success ───────────────────────────────── */}
            {step === 4 && (
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Sparkles size={36} />
                </div>
                <h2 className="mt-6 font-display text-3xl font-semibold">
                  XPass issued!
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Welcome to Engineers Day 2026, {profile.fullName.split(" ")[0]}.
                  You&apos;ve earned{" "}
                  <span className="font-bold text-primary">50 XP</span> for
                  registering. Your XPass is ready.
                </p>

                <div className="mt-6 rounded-xl border border-card-border bg-card p-5 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">
                      {IDENTITIES.find((i) => i.tag === identity)?.emoji ?? "⚡"}
                    </div>
                    <div>
                      <div className="font-semibold">{profile.fullName}</div>
                      <div className="mono text-[10px] text-muted-foreground">
                        {identity} · {profile.branch} Y{profile.year}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      50 XP
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                      Registration complete
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => router.push("/xpass")}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground"
                    data-testid="button-go-to-xpass"
                  >
                    View my XPass <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => router.push("/events")}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-semibold hover:border-primary/50"
                  >
                    <Users size={16} /> Browse events
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
