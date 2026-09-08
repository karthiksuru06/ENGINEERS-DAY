"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Radio, ScanLine } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/ui-primitives";
import { Pill } from "@/components/pill";
import { createCheckIn, listEvents, type Event } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight } from "lucide-react";

export default function ScannerPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ studentName: string; points: number } | null>(null);
  const [scanError, setScanError] = useState("");
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
        setUserRole(profile?.role ?? "VOLUNTEER");
      }
      const evts = await listEvents();
      setEvents(evts);
    }
    load();
  }, []);

  const submit = async () => {
    if (!eventId || !token.trim()) return;
    setScanning(true);
    setScanError("");
    setResult(null);
    try {
      const r = await createCheckIn(eventId, token.trim());
      setResult(r);
      setToken("");
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : "Token rejected");
    } finally {
      setScanning(false);
    }
  };

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="mx-auto max-w-5xl animate-rise">
        <SectionHeading
          eyebrow="Staff systems / rapid check-in"
          title="Scan the room."
          action={
            <Link
              href="/operations"
              className="text-sm text-primary hover:underline"
              data-testid="link-scanner-operations"
            >
              Operations overview <ArrowRight className="ml-1 inline" size={14} />
            </Link>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
          {/* Scanner panel */}
          <div className="relative overflow-hidden rounded-xl border border-primary/35 bg-card p-6 md:p-10">
            <div className="absolute inset-0 grid-texture opacity-30" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <Pill tone="orange">Scanner armed</Pill>
                <span className="mono text-[10px] text-muted-foreground">INPUT / QR TOKEN</span>
              </div>
              <div className="mx-auto my-12 flex max-w-sm justify-center">
                <div className="relative flex h-56 w-56 items-center justify-center rounded-2xl border border-primary/50 bg-background">
                  <div className="absolute inset-5 rounded-lg border border-cyan-300/25" />
                  <div className="absolute left-5 right-5 top-1/2 h-px bg-primary animate-scan" />
                  <ScanLine size={72} strokeWidth={1} className="text-primary/50" />
                </div>
              </div>
              <label
                className="mono text-[10px] uppercase tracking-wider text-muted-foreground"
                htmlFor="scanner-token"
              >
                Paste token for manual scan
              </label>
              <input
                id="scanner-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="ED26-XPASS-TOKEN"
                className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 font-mono text-sm outline-none focus:border-primary"
                data-testid="input-scanner-token"
              />
              <label
                className="mt-4 block mono text-[10px] uppercase tracking-wider text-muted-foreground"
                htmlFor="scanner-event"
              >
                Station event
              </label>
              <select
                id="scanner-event"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                data-testid="select-scanner-event"
              >
                <option value="">Select the active event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              <button
                onClick={submit}
                disabled={!eventId || !token.trim() || scanning}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
                data-testid="button-submit-scan"
              >
                {scanning ? (
                  "Verifying token…"
                ) : (
                  <>
                    <CheckCircle2 size={17} /> Verify and check in
                  </>
                )}
              </button>
              {scanError && (
                <p className="mt-3 text-center text-sm text-destructive" data-testid="status-scanner-error">
                  {scanError}. Check the event and try again.
                </p>
              )}
              {result && (
                <div className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-4 text-center">
                  <CheckCircle2 className="mx-auto mb-2 text-emerald-300" size={22} />
                  <p className="font-semibold text-emerald-200">{result.studentName} checked in</p>
                  <p className="mt-1 text-xs text-muted-foreground">+{result.points} points awarded</p>
                </div>
              )}
            </div>
          </div>

          {/* Protocol side panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-card-border bg-card p-6">
              <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Protocol</p>
              <div className="mt-5 space-y-5">
                {[
                  ["01", "Select station", "Choose the event this device is monitoring."],
                  ["02", "Read XPass", "Scan the QR or paste the token manually."],
                  ["03", "Confirm entry", "The student gets points immediately."],
                ].map(([n, t, c]) => (
                  <div key={n} className="flex gap-3">
                    <span className="mono text-xs text-primary">{n}</span>
                    <div>
                      <p className="text-sm font-semibold">{t}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[.06] p-6">
              <Radio size={20} className="text-cyan-300" />
              <p className="mt-4 font-display text-lg font-semibold">No queue is a good queue.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Keep this station open. The control room is watching the pulse.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
