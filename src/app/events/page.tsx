"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ListFilter, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SectionHeading, StateCard } from "@/components/ui-primitives";
import { Pill } from "@/components/pill";
import { listEvents, type Event } from "@/lib/api";
import { shortDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const orange = "#ff7629";

function EventCard({ event }: { event: Event }) {
  const accent = orange;
  return (
    <Link
      href={`/events/${event.id}`}
      className="group relative overflow-hidden rounded-xl border border-card-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_12px_30px_hsl(219_28%_4%/.35)]"
      data-testid={`card-event-${event.id}`}
    >
      <div
        className="absolute right-0 top-0 h-28 w-28 rounded-bl-full opacity-20"
        style={{ background: `radial-gradient(circle at 70% 20%, ${accent}, transparent 70%)` }}
      />
      <div className="relative flex items-center justify-between">
        <Pill
          tone={event.category === "BUILD" ? "orange" : event.category === "PLAY" ? "cyan" : "muted"}
        >
          {event.category}
        </Pill>
        <span className="mono text-[10px] text-muted-foreground">
          {event.status.replace("_", " ")}
        </span>
      </div>
      <h2 className="relative mt-7 max-w-[14rem] font-display text-2xl font-semibold leading-tight">
        {event.name}
      </h2>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {event.description}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-y-3 border-t border-border pt-4">
        <div>
          <div className="mono text-[9px] uppercase text-muted-foreground">When</div>
          <div className="mt-1 text-xs">{shortDate(event.date)} / {event.startTime}</div>
        </div>
        <div>
          <div className="mono text-[9px] uppercase text-muted-foreground">Venue</div>
          <div className="mt-1 truncate text-xs">{event.venue}</div>
        </div>
        <div>
          <div className="mono text-[9px] uppercase text-muted-foreground">Team</div>
          <div className="mt-1 text-xs">{event.teamSize}</div>
        </div>
        <div>
          <div className="mono text-[9px] uppercase text-muted-foreground">Reward</div>
          <div className="mt-1 text-xs font-semibold text-primary">+{event.registrationXp} XP</div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-sm font-semibold">
        <span className={event.isRegistered ? "text-emerald-300" : "text-foreground"}>
          {event.isRegistered ? "Registered" : "View event"}
        </span>
        <ArrowRight
          className="text-primary transition-transform group-hover:translate-x-1"
          size={16}
        />
      </div>
    </Link>
  );
}

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  const params = useMemo(
    () => ({ ...(search ? { search } : {}), ...(category ? { category } : {}) }),
    [search, category]
  );

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(false);
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
        const data = await listEvents(params);
        setEvents(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params]);

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <SectionHeading
          eyebrow="Events / choose your path"
          title="Find your next event."
          action={
            <Link
              href="/leaderboard"
              className="hidden items-center gap-2 text-sm font-semibold text-primary sm:flex"
              data-testid="link-events-leaderboard"
            >
              Leaderboard <ArrowRight size={15} />
            </Link>
          }
        />

        {/* Filters */}
        <div className="mb-7 flex flex-col gap-3 rounded-xl border border-card-border bg-card p-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event, venue, or topic"
              className="h-11 w-full rounded-md border border-border bg-background pl-10 pr-4 text-sm outline-none focus:border-primary"
              data-testid="input-event-search"
            />
          </div>
          <div className="flex gap-2 overflow-auto">
            {["", "BUILD", "PLAY", "CREATE", "LEAD", "EXPLORE"].map((item) => (
              <button
                key={item || "all"}
                onClick={() => setCategory(item)}
                className={cn(
                  "whitespace-nowrap rounded-md border px-3 py-2 text-xs font-semibold",
                  category === item
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
                data-testid={`button-filter-${item || "all"}`}
              >
                {item || "All events"}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setSearch(""); setCategory(""); }}
            aria-label="Reset event filters"
            title="Reset filters"
            className="hidden items-center justify-center rounded-md border border-border px-3 text-muted-foreground hover:text-foreground md:flex"
            data-testid="button-event-filter"
          >
            <ListFilter size={16} />
          </button>
        </div>

        {loading ? (
          <StateCard kind="loading" />
        ) : error ? (
          <StateCard kind="error" onRetry={() => setError(false)} />
        ) : events.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <StateCard kind="empty" />
        )}
      </div>
    </AppShell>
  );
}
