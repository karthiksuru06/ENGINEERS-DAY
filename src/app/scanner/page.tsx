"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, Radio, ScanLine, AlertCircle, AlertTriangle, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/ui-primitives";
import { Pill } from "@/components/pill";
import { createCheckIn, listEvents, type Event, type CheckInResult } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight } from "lucide-react";

// ─── Result banner ────────────────────────────────────────────────────────────

function ResultBanner({ result }: { result: CheckInResult }) {
  if (result.status === "ok") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mt-4 rounded-xl border border-emerald-400/35 bg-emerald-400/10 p-5 text-center"
        data-testid="status-checkin-success"
      >
        <CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={28} />
        <p className="font-display text-lg font-semibold text-emerald-200">
          {result.studentName} checked in
        </p>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <Zap size={14} className="text-primary" />
          <span className="font-bold text-primary">
            +{result.pointsAwarded} XP
          </span>
          <span className="text-xs text-muted-foreground">awarded</span>
        </div>
      </motion.div>
    );
  }

  if (result.status === "already_checked_in") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/8 p-5 text-center"
        data-testid="status-already-checked-in"
      >
        <AlertTriangle className="mx-auto mb-2 text-yellow-400" size={24} />
        <p className="font-semibold text-yellow-200">
          {result.studentName} already checked in
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          No XP awarded — idempotent check-in
        </p>
      </motion.div>
    );
  }

  const msgs: Record<string, string> = {
    invalid_token: "Invalid QR token. Make sure the student shows their XPass.",
    not_registered: `${result.studentName ?? "Student"} is not registered for this event.`,
    event_not_found: "Event not found. Select the correct event.",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-4 rounded-xl border border-destructive/30 bg-destructive/8 p-5 text-center"
      data-testid="status-checkin-error"
    >
      <AlertCircle className="mx-auto mb-2 text-destructive" size={24} />
      <p className="font-semibold text-destructive">Check-in failed</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {msgs[result.status] ?? "Unknown error. Try again."}
      </p>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [recentScans, setRecentScans] = useState<
    { name: string; points: number; time: string; status: CheckInResult["status"] }[]
  >([]);
  const tokenRef = useRef<HTMLInputElement>(null);

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
        setUserRole(profile?.role ?? "VOLUNTEER");
      }
      // Only show LIVE and REGISTRATION_OPEN events
      const evts = await listEvents();
      setEvents(
        evts.filter(
          (e) =>
            e.status === "LIVE" ||
            e.status === "REGISTRATION_OPEN" ||
            e.status === "REGISTRATION_CLOSED"
        )
      );
    }
    load();
  }, []);

  const submit = async () => {
    if (!eventId || !token.trim()) return;
    setScanning(true);
    setResult(null);
    try {
      const r = await createCheckIn(eventId, token.trim());
      setResult(r);
      if (r.status === "ok" || r.status === "already_checked_in") {
        setRecentScans((prev) => [
          {
            name: r.studentName ?? "Unknown",
            points: r.pointsAwarded ?? 0,
            time: new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            status: r.status,
          },
          ...prev.slice(0, 9),
        ]);
      }
      setToken("");
      // Re-focus input for rapid scanning
      setTimeout(() => tokenRef.current?.focus(), 100);
    } catch {
      setResult({ status: "invalid_token" });
    } finally {
      setScanning(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === eventId);

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="mx-auto max-w-5xl animate-rise">
        <SectionHeading
          eyebrow="Staff systems / rapid check-in"
          title="Scan the room."
          action={
            <Link
              href="/operations"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              data-testid="link-scanner-operations"
            >
              Operations <ArrowRight className="inline" size={14} />
            </Link>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_.75fr]">
          {/* Scanner panel */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/35 bg-card p-6 md:p-8">
            <div className="absolute inset-0 grid-texture opacity-25" />
            <div className="relative">
              <div className="mb-6 flex items-center justify-between">
                <Pill tone="orange">
                  <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary inline-block animate-pulse" />
                  Scanner active
                </Pill>
                {selectedEvent && (
                  <span className="mono text-[10px] text-muted-foreground">
                    {selectedEvent.name}
                  </span>
                )}
              </div>

              {/* Visual scanner animation */}
              <div className="mx-auto my-8 flex max-w-xs justify-center">
                <div className="relative flex h-52 w-52 items-center justify-center rounded-2xl border border-primary/40 bg-background">
                  {/* Corner accents */}
                  {[
                    "top-0 left-0 border-t-2 border-l-2 rounded-tl-xl",
                    "top-0 right-0 border-t-2 border-r-2 rounded-tr-xl",
                    "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl",
                    "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl",
                  ].map((cls, i) => (
                    <div
                      key={i}
                      className={`absolute h-6 w-6 border-primary ${cls}`}
                    />
                  ))}
                  <div className="absolute inset-6 rounded-lg border border-cyan-300/20" />
                  <div className="absolute left-6 right-6 top-1/2 h-px bg-primary animate-scan" />
                  <ScanLine
                    size={64}
                    strokeWidth={1}
                    className="text-primary/40"
                  />
                </div>
              </div>

              {/* Event selector */}
              <div className="mb-4">
                <label
                  htmlFor="scanner-event"
                  className="mono text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  Active event
                </label>
                <select
                  id="scanner-event"
                  value={eventId}
                  onChange={(e) => {
                    setEventId(e.target.value);
                    setResult(null);
                  }}
                  className="mt-1.5 h-12 w-full rounded-md border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  data-testid="select-scanner-event"
                >
                  <option value="">Select the event for this station</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} — {event.venue}
                    </option>
                  ))}
                </select>
              </div>

              {/* Token input */}
              <div>
                <label
                  htmlFor="scanner-token"
                  className="mono text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  XPass QR token (paste or scan)
                </label>
                <input
                  ref={tokenRef}
                  id="scanner-token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="UUID from student QR…"
                  className="mt-1.5 h-12 w-full rounded-md border border-border bg-background px-4 font-mono text-sm outline-none focus:border-primary"
                  data-testid="input-scanner-token"
                  autoFocus
                />
              </div>

              <button
                onClick={submit}
                disabled={!eventId || !token.trim() || scanning}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50 transition-opacity"
                data-testid="button-submit-scan"
              >
                {scanning ? (
                  "Verifying…"
                ) : (
                  <>
                    <CheckCircle2 size={17} /> Check in student
                  </>
                )}
              </button>

              <AnimatePresence mode="wait">
                {result && (
                  <motion.div
                    key={result.status + token}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <ResultBanner result={result} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Protocol */}
            <div className="rounded-xl border border-card-border bg-card p-6">
              <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Protocol
              </p>
              <div className="mt-5 space-y-5">
                {[
                  [
                    "01",
                    "Select event",
                    "Choose which event this station is checking in.",
                  ],
                  [
                    "02",
                    "Scan XPass",
                    "Student opens their XPass QR. Paste or scan it here.",
                  ],
                  [
                    "03",
                    "Confirm",
                    "System verifies registration, awards XP exactly once.",
                  ],
                ].map(([n, t, c]) => (
                  <div key={n} className="flex gap-3">
                    <span className="mono text-xs text-primary">{n}</span>
                    <div>
                      <p className="text-sm font-semibold">{t}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {c}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent scans */}
            <div className="rounded-xl border border-card-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Recent scans
                </p>
                <Radio size={14} className="text-primary" />
              </div>
              <div className="mt-4 space-y-2">
                {recentScans.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No scans this session.
                  </p>
                ) : (
                  recentScans.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-background px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        {s.status === "ok" ? (
                          <CheckCircle2
                            size={13}
                            className="flex-shrink-0 text-emerald-400"
                          />
                        ) : (
                          <AlertTriangle
                            size={13}
                            className="flex-shrink-0 text-yellow-400"
                          />
                        )}
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.status === "ok" && (
                          <span className="mono text-xs text-primary">
                            +{s.points}
                          </span>
                        )}
                        <span className="mono text-[10px] text-muted-foreground">
                          {s.time}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
