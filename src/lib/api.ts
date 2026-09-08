import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EventStatus =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "LIVE"
  | "COMPLETED";

export type EventCategory = "BUILD" | "PLAY" | "CREATE" | "LEAD" | "EXPLORE";

export interface Event {
  id: string;
  name: string;
  category: EventCategory;
  description: string;
  date: string;
  time: string;
  venue: string;
  teamSize: string;
  capacity: number;
  registered: number;
  points: number;
  status: EventStatus;
  isRegistered?: boolean;
  accent?: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  subtitle: string;
  points: number;
  change: number;
  accent?: string;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  currentRank: number;
  pointsToNextRank: number;
}

export interface DashboardSummary {
  studentName: string;
  points: number;
  pointsToNextRank: number;
  leaderboardPosition: number;
  eventsRegistered: number;
  squadRank: number;
  squadName: string;
  upcomingEvents: Event[];
}

export interface ActivityItem {
  id: string;
  action: string;
  event: string;
  time: string;
  points: number;
  accent?: string;
}

export interface XPass {
  id: string;
  name: string;
  branch: string;
  year: string;
  qrToken: string;
  points: number;
  position: number;
  issuedAt: string;
  squad: string;
  identity?: string[];
}

export interface OperationsSummary {
  checkedInToday: number;
  nextScan: string;
  staffName: string;
  assignedEvents: Event[];
  recentScans: { id: string; name: string; event: string; time: string }[];
}

export interface AdminSummary {
  registeredStudents: number;
  checkedIn: number;
  activeEvents: number;
  activeSquads: number;
  totalPoints: number;
  registrationsByDay: { day: string; registrations: number }[];
  categoryMix: { category: string; count: number }[];
}

// ─── Supabase row shapes (returned by queries) ────────────────────────────────

interface DbEvent {
  id: string;
  name: string;
  category: string;
  description: string | null;
  event_date: string;
  event_time: string;
  venue: string;
  team_size: number;
  capacity: number;
  base_points: number;
  status: string;
  event_registrations: { count: number }[];
}

function dbEventToEvent(e: DbEvent, registeredIds: Set<string>): Event {
  return {
    id: e.id,
    name: e.name,
    category: e.category as EventCategory,
    description: e.description ?? "",
    date: e.event_date,
    time: e.event_time,
    venue: e.venue,
    teamSize: `Team of ${e.team_size}`,
    capacity: e.capacity,
    registered: e.event_registrations?.[0]?.count ?? 0,
    points: e.base_points,
    status: e.status as EventStatus,
    isRegistered: registeredIds.has(e.id),
  };
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function listEvents(params?: {
  search?: string;
  category?: string;
}): Promise<Event[]> {
  const db = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (db as any)
    .from("events")
    .select(
      `id, name, category, description, event_date, event_time, venue,
       team_size, capacity, base_points, status,
       event_registrations(count)`
    )
    .order("event_date", { ascending: true });

  if (params?.search) query = query.ilike("name", `%${params.search}%`);
  if (params?.category) query = query.eq("category", params.category);

  const { data, error } = await query;
  if (error) throw error;

  const {
    data: { user },
  } = await db.auth.getUser();
  let userRegistrations = new Set<string>();
  if (user) {
    const { data: regs } = await db
      .from("event_registrations")
      .select("event_id")
      .eq("profile_id", user.id);
    userRegistrations = new Set(
      (regs ?? []).map((r: { event_id: string }) => r.event_id)
    );
  }

  return ((data ?? []) as DbEvent[]).map((e) =>
    dbEventToEvent(e, userRegistrations)
  );
}

export async function getEvent(eventId: string): Promise<Event | null> {
  const db = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("events")
    .select(
      `id, name, category, description, event_date, event_time, venue,
       team_size, capacity, base_points, status,
       event_registrations(count)`
    )
    .eq("id", eventId)
    .single();
  if (error) return null;

  const {
    data: { user },
  } = await db.auth.getUser();
  let isRegistered = false;
  if (user) {
    const { data: reg } = await db
      .from("event_registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("profile_id", user.id)
      .maybeSingle();
    isRegistered = !!reg;
  }

  return dbEventToEvent(data as DbEvent, isRegistered ? new Set([eventId]) : new Set());
}

export async function registerForEvent(eventId: string): Promise<void> {
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await db
    .from("event_registrations")
    .insert({ event_id: eventId, profile_id: user.id });
  if (error) throw error;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard(
  scope: "individual" | "squad"
): Promise<LeaderboardData> {
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (scope === "squad") {
    const { data, error } = await db
      .from("squads")
      .select("id, squad_name, total_points")
      .order("total_points", { ascending: false })
      .limit(20);
    if (error) throw error;
    const entries: LeaderboardEntry[] = ((data ?? []) as {
      id: string;
      squad_name: string;
      total_points: number;
    }[]).map((s, i) => ({
      rank: i + 1,
      name: s.squad_name,
      subtitle: "Squad",
      points: s.total_points,
      change: 0,
    }));
    return { entries, currentRank: 0, pointsToNextRank: 0 };
  }

  // Individual — use explicit join via foreign table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("xpasses")
    .select("id, profile_id, total_points, profiles(full_name, branch)")
    .order("total_points", { ascending: false })
    .limit(20);
  if (error) throw error;

  let currentRank = 0;
  let pointsToNextRank = 0;
  const rows = (data ?? []) as {
    profile_id: string;
    total_points: number;
    profiles: { full_name: string; branch: string } | { full_name: string; branch: string }[];
  }[];
  const entries: LeaderboardEntry[] = rows.map((x, i) => {
    const profile = Array.isArray(x.profiles) ? x.profiles[0] : x.profiles;
    if (user && x.profile_id === user.id) {
      currentRank = i + 1;
      if (i > 0) pointsToNextRank = rows[i - 1].total_points - x.total_points;
    }
    return {
      rank: i + 1,
      name: profile?.full_name ?? "Unknown",
      subtitle: profile?.branch ?? "",
      points: x.total_points,
      change: 0,
    };
  });
  return { entries, currentRank, pointsToNextRank };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: xpass } = await db
    .from("xpasses")
    .select("total_points")
    .eq("profile_id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: regs } = await (db as any)
    .from("event_registrations")
    .select(
      `event_id, events(id, name, category, event_date, event_time, venue, base_points, status)`
    )
    .eq("profile_id", user.id)
    .limit(5);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: squadMember } = await (db as any)
    .from("squad_members")
    .select("squad_id, squads(squad_name, total_points)")
    .eq("profile_id", user.id)
    .maybeSingle();

  // Simple rank calculation
  const { data: ranked } = await db
    .from("xpasses")
    .select("profile_id, total_points")
    .order("total_points", { ascending: false });
  const myRank = ranked
    ? (ranked as { profile_id: string }[]).findIndex(
        (x) => x.profile_id === user.id
      ) + 1
    : 0;
  const topPoints =
    myRank > 1
      ? ((ranked as { total_points: number }[])[myRank - 2]?.total_points ?? 0)
      : 0;

  // Squad rank
  const { data: squadRanked } = await db
    .from("squads")
    .select("id")
    .order("total_points", { ascending: false });
  const squadId = squadMember?.squad_id as string | undefined;
  const squadRank = squadRanked
    ? (squadRanked as { id: string }[]).findIndex((s) => s.id === squadId) + 1
    : 0;

  const upcomingEvents: Event[] = ((regs ?? []) as {
    events: DbEvent | DbEvent[];
  }[])
    .map((r) => (Array.isArray(r.events) ? r.events[0] : r.events))
    .filter(Boolean)
    .map((e) => dbEventToEvent(e, new Set()));

  // Squad name
  const squadsData = squadMember?.squads;
  const squadName = Array.isArray(squadsData)
    ? (squadsData[0]?.squad_name as string | undefined) ?? "No Squad"
    : ((squadsData as { squad_name: string } | undefined)?.squad_name ?? "No Squad");

  return {
    studentName: (profile?.full_name as string | null) ?? "Student",
    points: (xpass?.total_points as number | null) ?? 0,
    pointsToNextRank: Math.max(0, topPoints - ((xpass?.total_points as number | null) ?? 0)),
    leaderboardPosition: myRank,
    eventsRegistered: (regs as unknown[])?.length ?? 0,
    squadRank,
    squadName,
    upcomingEvents,
  };
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export async function getActivity(): Promise<ActivityItem[]> {
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("point_transactions")
    .select("id, reason, points, created_at, events(name)")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return [];
  return ((data ?? []) as {
    id: string;
    reason: string;
    points: number;
    created_at: string;
    events: { name: string } | { name: string }[] | null;
  }[]).map((t) => {
    const evtName = Array.isArray(t.events)
      ? t.events[0]?.name
      : t.events?.name;
    return {
      id: t.id,
      action: t.reason,
      event: evtName ?? "",
      time: new Date(t.created_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      points: t.points,
    };
  });
}

// ─── XPass ────────────────────────────────────────────────────────────────────

export async function getXPass(): Promise<XPass | null> {
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("xpasses")
    .select(
      `xpass_id, qr_token, total_points, created_at, identity_tags,
       profiles(full_name, branch, year),
       squad_members(squads(squad_name))`
    )
    .eq("profile_id", user.id)
    .single();
  if (error || !data) return null;

  // rank
  const { data: ranked } = await db
    .from("xpasses")
    .select("profile_id")
    .order("total_points", { ascending: false });
  const myRank = ranked
    ? (ranked as { profile_id: string }[]).findIndex(
        (x) => x.profile_id === user.id
      ) + 1
    : 0;

  const profileRow = Array.isArray(data.profiles)
    ? data.profiles[0]
    : data.profiles;
  const squadMemberRows = Array.isArray(data.squad_members)
    ? data.squad_members
    : [];
  const squadRow = squadMemberRows[0]?.squads;
  const squadName = Array.isArray(squadRow)
    ? squadRow[0]?.squad_name
    : squadRow?.squad_name;

  return {
    id: data.xpass_id as string,
    name: (profileRow?.full_name as string | undefined) ?? "Student",
    branch: (profileRow?.branch as string | undefined) ?? "",
    year: (profileRow?.year as string | undefined) ?? "",
    qrToken: data.qr_token as string,
    points: data.total_points as number,
    position: myRank,
    issuedAt: data.created_at as string,
    squad: (squadName as string | undefined) ?? "No squad",
    identity: (data.identity_tags as string[] | null) ?? [],
  };
}

// ─── Check-In (Scanner) ───────────────────────────────────────────────────────

export async function createCheckIn(
  eventId: string,
  qrToken: string
): Promise<{ studentName: string; points: number }> {
  const db = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: xpass, error: xpassError } = await (db as any)
    .from("xpasses")
    .select("profile_id, profiles(full_name)")
    .eq("qr_token", qrToken)
    .single();
  if (xpassError || !xpass) throw new Error("Invalid token");

  const { data: event } = await db
    .from("events")
    .select("base_points")
    .eq("id", eventId)
    .single();

  const {
    data: { user },
  } = await db.auth.getUser();

  const { error: ciError } = await db.from("check_ins").insert({
    event_id: eventId,
    profile_id: xpass.profile_id as string,
    checked_in_by: user?.id,
  });
  if (ciError) throw new Error("Already checked in or error");

  const pts = (event?.base_points as number | null) ?? 50;
  await db.from("point_transactions").insert({
    profile_id: xpass.profile_id as string,
    event_id: eventId,
    points: pts,
    reason: "Event participation check-in",
    transaction_type: "PARTICIPATION",
    awarded_by: user?.id,
  });

  const profileRow = Array.isArray(xpass.profiles)
    ? xpass.profiles[0]
    : xpass.profiles;
  return {
    studentName: (profileRow?.full_name as string | undefined) ?? "Student",
    points: pts,
  };
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function getOperationsSummary(): Promise<OperationsSummary | null> {
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assignments } = await (db as any)
    .from("event_assignments")
    .select(
      `events(id, name, category, event_date, event_time, venue, base_points, status)`
    )
    .eq("profile_id", user.id);

  const assignedEvents: Event[] = ((assignments ?? []) as {
    events: DbEvent | DbEvent[];
  }[])
    .map((a) => (Array.isArray(a.events) ? a.events[0] : a.events))
    .filter(Boolean)
    .map((e) => dbEventToEvent(e, new Set()));

  const eventIds = assignedEvents.map((e) => e.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scans: any[] = [];
  if (eventIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: scanData } = await (db as any)
      .from("check_ins")
      .select("id, checked_in_at, profiles(full_name), events(name)")
      .in("event_id", eventIds)
      .order("checked_in_at", { ascending: false })
      .limit(5);
    scans = scanData ?? [];
  }

  const { count: checkedInToday } = await db
    .from("check_ins")
    .select("*", { count: "exact", head: true })
    .gte("checked_in_at", new Date().toISOString().split("T")[0]);

  return {
    checkedInToday: checkedInToday ?? 0,
    nextScan: assignedEvents[0]?.name ?? "None assigned",
    staffName: (profile?.full_name as string | null) ?? "Staff",
    assignedEvents,
    recentScans: scans.map((s) => {
      const profileRow = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
      const evtRow = Array.isArray(s.events) ? s.events[0] : s.events;
      return {
        id: s.id as string,
        name: (profileRow?.full_name as string | undefined) ?? "Unknown",
        event: (evtRow?.name as string | undefined) ?? "",
        time: new Date(s.checked_in_at as string).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    }),
  };
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getAdminSummary(): Promise<AdminSummary> {
  const db = createClient();
  const [
    { count: regStudents },
    { count: checkedIn },
    { count: activeEvents },
    { count: activeSquads },
    { data: pointsData },
    { data: regsData },
    { data: catData },
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }).eq("role", "STUDENT"),
    db.from("check_ins").select("*", { count: "exact", head: true }),
    db.from("events").select("*", { count: "exact", head: true }).eq("status", "LIVE"),
    db.from("squads").select("*", { count: "exact", head: true }),
    db.from("xpasses").select("total_points"),
    db.from("profiles").select("created_at").order("created_at", { ascending: true }).limit(100),
    db.from("events").select("category"),
  ]);

  const totalPoints = ((pointsData ?? []) as { total_points: number }[]).reduce(
    (sum, x) => sum + (x.total_points ?? 0),
    0
  );

  const days: Record<string, number> = {};
  ((regsData ?? []) as { created_at: string }[]).forEach((r) => {
    const d = new Date(r.created_at).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
    days[d] = (days[d] ?? 0) + 1;
  });
  const registrationsByDay = Object.entries(days)
    .slice(-7)
    .map(([day, registrations]) => ({ day, registrations }));

  const cats: Record<string, number> = {};
  ((catData ?? []) as { category: string }[]).forEach((e) => {
    cats[e.category] = (cats[e.category] ?? 0) + 1;
  });
  const categoryMix = Object.entries(cats).map(([category, count]) => ({
    category,
    count,
  }));

  return {
    registeredStudents: regStudents ?? 0,
    checkedIn: checkedIn ?? 0,
    activeEvents: activeEvents ?? 0,
    activeSquads: activeSquads ?? 0,
    totalPoints,
    registrationsByDay,
    categoryMix,
  };
}

// ─── Registration ─────────────────────────────────────────────────────────────

export async function createStudentRegistration(data: {
  fullName: string;
  collegeId: string;
  branch: string;
  year: string;
  whatsapp: string;
  identity: string[];
  interests: string[];
  squadChoice: "create" | "join" | "skip";
}): Promise<void> {
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await db.from("profiles").upsert({
    id: user.id,
    full_name: data.fullName,
    college_id: data.collegeId,
    branch: data.branch,
    year: data.year,
    whatsapp_number: data.whatsapp,
    role: "STUDENT",
  });

  const xpassId =
    "XPD-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  await db.from("xpasses").upsert({
    profile_id: user.id,
    xpass_id: xpassId,
    identity_tags: data.identity,
    interests: data.interests,
  });
}
