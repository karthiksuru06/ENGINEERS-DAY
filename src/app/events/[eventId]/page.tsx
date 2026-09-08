"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { AppShell } from "@/components/app-shell";
import { StateCard } from "@/components/ui-primitives";
import { Pill } from "@/components/pill";
import { getEvent, registerForEvent, type Event } from "@/lib/api";
import { shortDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState(false);
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
        setUserRole(profile?.role ?? "STUDENT");
      }
      const e = await getEvent(eventId);
      setEvent(e);
      setLoading(false);
    }
    load();
  }, [eventId]);

  const handleRegister = async () => {
    setRegistering(true);
    setRegError(false);
    try {
      await registerForEvent(eventId);
      setEvent((prev) => prev ? { ...prev, isRegistered: true } : prev);
    } catch {
      setRegError(true);
    } finally {
      setRegistering(false);
    }
  };

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="mx-auto max-w-4xl animate-rise">
        {loading ? (
          <StateCard kind="loading" />
        ) : !event ? (
          <StateCard kind="error" />
        ) : (
          <>
            <Link
              href="/events"
              className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              data-testid="link-back-events"
            >
              ← Event grid
            </Link>
            <div className="relative overflow-hidden rounded-xl border border-card-border bg-card p-6 md:p-10">
              <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-3">
                  <Pill tone="orange">{event.category}</Pill>
                  <Pill tone={event.status === "REGISTRATION_OPEN" ? "green" : "muted"}>
                    {event.status.replace("_", " ")}
                  </Pill>
                </div>
                <h1 className="mt-7 max-w-2xl font-display text-4xl font-semibold leading-[.98] md:text-6xl">
                  {event.name}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
                  {event.description}
                </p>
                <div className="mt-8 grid gap-4 border-y border-border py-5 sm:grid-cols-4">
                  <Meta label="Date" value={shortDate(event.date)} />
                  <Meta label="Time" value={event.startTime} />
                  <Meta label="Venue" value={event.venue} />
                  <Meta label="Capacity" value={`${event.registered} / ${event.capacity}`} />
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Reward</span>
                    <div className="mt-1 font-display text-3xl font-semibold text-primary">
                      +{event.registrationXp} XP
                    </div>
                  </div>
                  <button
                    disabled={event.isRegistered || registering || event.status !== "REGISTRATION_OPEN"}
                    onClick={handleRegister}
                    className={cn(
                      "rounded-md px-6 py-3.5 text-sm font-bold",
                      event.isRegistered
                        ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : "bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-70"
                    )}
                    data-testid="button-register-event"
                  >
                    {registering
                      ? "Registering…"
                      : event.isRegistered
                      ? "Registered ✓"
                      : event.status === "REGISTRATION_OPEN"
                      ? "Register for event"
                      : "Registration closed"}
                  </button>
                </div>
                {regError && (
                  <p className="mt-4 text-sm text-destructive" data-testid="status-registration-error">
                    Registration did not complete. Try again.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
