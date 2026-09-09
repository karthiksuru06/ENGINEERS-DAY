"use client";

import { useEffect, useState } from "react";
import { Plus, Zap, CheckCircle2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StateCard } from "@/components/ui-primitives";
import {
  listEvents,
  createEvent,
  updateEventStatus,
  type Event,
  type EventStatus,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const STATUS_COLORS: Record<EventStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  REGISTRATION_OPEN: "bg-emerald-500/15 text-emerald-400",
  REGISTRATION_CLOSED: "bg-yellow-500/15 text-yellow-400",
  LIVE: "bg-primary/15 text-primary",
  COMPLETED: "bg-cyan-400/15 text-cyan-300",
  ARCHIVED: "bg-zinc-500/15 text-zinc-400",
};

const STATUS_FLOW: Record<EventStatus, EventStatus | null> = {
  DRAFT: "REGISTRATION_OPEN",
  REGISTRATION_OPEN: "REGISTRATION_CLOSED",
  REGISTRATION_CLOSED: "LIVE",
  LIVE: "COMPLETED",
  COMPLETED: "ARCHIVED",
  ARCHIVED: null,
};

function EventRow({
  event,
  onStatusChange,
}: {
  event: Event;
  onStatusChange: (id: string, status: EventStatus) => void;
}) {
  const next = STATUS_FLOW[event.status];
  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`mono rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold ${STATUS_COLORS[event.status]}`}
            >
              {event.status.replace("_", " ")}
            </span>
            <span className="mono text-[10px] uppercase text-muted-foreground">
              {event.category}
            </span>
          </div>
          <h3 className="mt-2 font-semibold">{event.name}</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {event.date} · {event.venue} · {event.registered}/{event.capacity}
          </div>
          {/* XP breakdown */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "Reg", value: event.registrationXp },
              { label: "Check-in", value: event.checkinXp },
              { label: "Completion", value: event.completionXp },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
              >
                <Zap size={11} className="text-primary" />
                <span className="font-semibold text-primary">{value}</span>
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {next && (
            <button
              onClick={() => onStatusChange(event.id, next)}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/8 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
              data-testid={`button-event-advance-${event.id}`}
            >
              <CheckCircle2 size={13} />
              → {next.replace("_", " ")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateEventModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "BUILD",
    description: "",
    eventDate: "",
    startTime: "09:00",
    endTime: "17:00",
    venue: "",
    teamSize: 1,
    capacity: 100,
    registrationXp: 10,
    checkinXp: 20,
    completionXp: 50,
    status: "REGISTRATION_OPEN" as EventStatus,
  });

  const upd = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createEvent({
        ...form,
        instructions: undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-card-border bg-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Create event</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Event name</label>
              <input required value={form.name} onChange={(e) => upd("name", e.target.value)} className="auth-input mt-1.5" placeholder="eg. Hackathon 2026" />
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Category</label>
              <select value={form.category} onChange={(e) => upd("category", e.target.value)} className="auth-input mt-1.5">
                {["BUILD","PLAY","CREATE","LEAD","EXPLORE"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</label>
              <select value={form.status} onChange={(e) => upd("status", e.target.value as EventStatus)} className="auth-input mt-1.5">
                {["DRAFT","REGISTRATION_OPEN","REGISTRATION_CLOSED","LIVE"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Date</label>
              <input required type="date" value={form.eventDate} onChange={(e) => upd("eventDate", e.target.value)} className="auth-input mt-1.5" />
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Venue</label>
              <input required value={form.venue} onChange={(e) => upd("venue", e.target.value)} className="auth-input mt-1.5" placeholder="Main Auditorium" />
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Start time</label>
              <input type="time" value={form.startTime} onChange={(e) => upd("startTime", e.target.value)} className="auth-input mt-1.5" />
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">End time</label>
              <input type="time" value={form.endTime} onChange={(e) => upd("endTime", e.target.value)} className="auth-input mt-1.5" />
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Capacity</label>
              <input type="number" min={1} value={form.capacity} onChange={(e) => upd("capacity", +e.target.value)} className="auth-input mt-1.5" />
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Team size</label>
              <input type="number" min={1} max={10} value={form.teamSize} onChange={(e) => upd("teamSize", +e.target.value)} className="auth-input mt-1.5" />
            </div>
          </div>
          {/* XP rules */}
          <div className="rounded-xl border border-card-border bg-background p-4">
            <p className="mono mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">XP rules</p>
            <div className="grid grid-cols-3 gap-3">
              {([["registrationXp","Registration XP"],["checkinXp","Check-in XP"],["completionXp","Completion XP"]] as const).map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <input type="number" min={0} value={form[k]} onChange={(e) => upd(k, +e.target.value)} className="auth-input mt-1" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={(e) => upd("description", e.target.value)} rows={3} className="auth-input mt-1.5 h-auto resize-none py-2" placeholder="Brief event description…" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">
            {loading ? "Creating…" : <><Plus size={16} /> Create event</>}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  async function load() {
    const data = await listEvents();
    setEvents(data);
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
      await load();
    }
    init();
  }, []);

  const handleStatusChange = async (id: string, status: EventStatus) => {
    await updateEventStatus(id, status);
    load();
  };

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">Admin / Events</p>
            <h1 className="mt-2 font-display text-3xl font-semibold">Events.</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
            data-testid="button-create-event"
          >
            <Plus size={15} /> Create event
          </button>
        </div>

        {loading ? (
          <StateCard kind="loading" />
        ) : events.length === 0 ? (
          <StateCard kind="empty" />
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </AppShell>
  );
}
