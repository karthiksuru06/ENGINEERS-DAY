import { createClient } from "@/lib/supabase/client";
import type {
  Event,
  EventCategory,
  EventStatus,
  XPass,
  LeaderboardData,
  LeaderboardEntry,
  SquadLeaderboardEntry,
  DashboardSummary,
  ActivityItem,
  OperationsSummary,
  AdminAnalytics,
  Squad,
  SquadMember,
  CheckInResult,
  RedemptionResult,
  EventRegistrationResult,
  DbEvent,
  DbPointTransaction,
  TransactionType,
} from "@/lib/supabase/types";

// ─── Re-export types for consumers ───────────────────────────────────────────

export type {
  Event,
  EventCategory,
  EventStatus,
  XPass,
  LeaderboardData,
  LeaderboardEntry,
  SquadLeaderboardEntry,
  DashboardSummary,
  ActivityItem,
  OperationsSummary,
  AdminAnalytics,
  Squad,
  SquadMember,
  CheckInResult,
  RedemptionResult,
  EventRegistrationResult,
};

// Keep legacy export for admin page
export type AdminSummary = AdminAnalytics;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dbEventToEvent(
  e: DbEvent,
  registeredIds: Set<string>,
  checkedInIds?: Set<string>
): Event {
  const regCount =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e as any).event_registrations?.[0]?.count ?? 0;
  return {
    id: e.id,
    name: e.name,
    slug: e.slug ?? e.id,
    category: e.category,
    description: e.description ?? "",
    date: e.event_date,
    startTime: e.start_time ?? e.event_time,
    endTime: e.end_time ?? null,
    venue: e.venue,
    teamSize: e.team_size === 1 ? "Individual" : `Team of ${e.team_size}`,
    capacity: e.capacity,
    registered: regCount,
    basePoints: e.base_points,
    registrationXp: e.registration_xp ?? 10,
    checkinXp: e.checkin_xp ?? 20,
    completionXp: e.completion_xp ?? 50,
    status: e.status as EventStatus,
    bannerUrl: e.banner_url ?? null,
    instructions: e.instructions ?? null,
    campusId: e.campus_id ?? null,
    isRegistered: registeredIds.has(e.id),
    isCheckedIn: checkedInIds ? checkedInIds.has(e.id) : false,
  };
}

async function getCurrentUser() {
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function listEvents(params?: {
  search?: string;
  category?: string;
  campusId?: string;
}): Promise<Event[]> {
  const db = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (db as any)
    .from("events")
    .select(
      `id, name, slug, category, description, event_date, event_time, start_time, end_time,
       venue, team_size, capacity, base_points, registration_xp, checkin_xp, completion_xp,
       status, banner_url, instructions, eligibility, campus_id,
       event_registrations(count)`
    )
    .not("status", "eq", "ARCHIVED")
    .order("event_date", { ascending: true });

  if (params?.search) query = query.ilike("name", `%${params.search}%`);
  if (params?.category) query = query.eq("category", params.category);
  if (params?.campusId) query = query.eq("campus_id", params.campusId);

  const { data, error } = await query;
  if (error) throw error;

  const user = await getCurrentUser();
  let registeredIds = new Set<string>();
  let checkedInIds = new Set<string>();

  if (user) {
    const [{ data: regs }, { data: cins }] = await Promise.all([
      db
        .from("event_registrations")
        .select("event_id")
        .eq("profile_id", user.id),
      db.from("check_ins").select("event_id").eq("profile_id", user.id),
    ]);
    registeredIds = new Set(
      (regs ?? []).map((r: { event_id: string }) => r.event_id)
    );
    checkedInIds = new Set(
      (cins ?? []).map((c: { event_id: string }) => c.event_id)
    );
  }

  return ((data ?? []) as DbEvent[]).map((e) =>
    dbEventToEvent(e, registeredIds, checkedInIds)
  );
}

export async function getEvent(eventId: string): Promise<Event | null> {
  const db = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("events")
    .select(
      `id, name, slug, category, description, event_date, event_time, start_time, end_time,
       venue, team_size, capacity, base_points, registration_xp, checkin_xp, completion_xp,
       status, banner_url, instructions, eligibility, campus_id,
       event_registrations(count)`
    )
    .eq("id", eventId)
    .single();
  if (error) return null;

  const user = await getCurrentUser();
  let isRegistered = false;
  let isCheckedIn = false;

  if (user) {
    const [{ data: reg }, { data: cin }] = await Promise.all([
      db
        .from("event_registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("profile_id", user.id)
        .maybeSingle(),
      db
        .from("check_ins")
        .select("id")
        .eq("event_id", eventId)
        .eq("profile_id", user.id)
        .maybeSingle(),
    ]);
    isRegistered = !!reg;
    isCheckedIn = !!cin;
  }

  return dbEventToEvent(
    data as DbEvent,
    isRegistered ? new Set([eventId]) : new Set(),
    isCheckedIn ? new Set([eventId]) : new Set()
  );
}

export async function registerForEvent(
  eventId: string
): Promise<EventRegistrationResult> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("fn_register_for_event", {
    p_profile_id: user.id,
    p_event_id: eventId,
  });

  if (error) throw error;
  return (data as EventRegistrationResult) ?? "ok";
}

// ─── Admin Event Management ───────────────────────────────────────────────────

export async function createEvent(payload: {
  name: string;
  category: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime?: string;
  venue: string;
  teamSize: number;
  capacity: number;
  status: EventStatus;
  registrationXp: number;
  checkinXp: number;
  completionXp: number;
  bannerUrl?: string;
  instructions?: string;
  campusId?: string;
}): Promise<string> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const slug =
    payload.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36);

  const { data, error } = await db
    .from("events")
    .insert({
      name: payload.name,
      slug,
      category: payload.category,
      description: payload.description,
      event_date: payload.eventDate,
      event_time: payload.startTime,
      start_time: payload.startTime,
      end_time: payload.endTime ?? null,
      venue: payload.venue,
      team_size: payload.teamSize,
      capacity: payload.capacity,
      base_points: payload.registrationXp,
      registration_xp: payload.registrationXp,
      checkin_xp: payload.checkinXp,
      completion_xp: payload.completionXp,
      status: payload.status,
      banner_url: payload.bannerUrl ?? null,
      instructions: payload.instructions ?? null,
      campus_id: payload.campusId ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateEventStatus(
  eventId: string,
  status: EventStatus
): Promise<void> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await db
    .from("events")
    .update({ status, updated_by: user.id })
    .eq("id", eventId);
  if (error) throw error;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getIndividualLeaderboard(params?: {
  campusId?: string;
  limit?: number;
  offset?: number;
}): Promise<LeaderboardData> {
  const db = createClient();
  const user = await getCurrentUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("fn_leaderboard_individual", {
    p_campus_id: params?.campusId ?? null,
    p_limit: params?.limit ?? 20,
    p_offset: params?.offset ?? 0,
  });

  if (error) throw error;

  const rows = (data ?? []) as {
    rank: number;
    profile_id: string;
    full_name: string;
    branch: string;
    year: string;
    total_points: number;
    identity_tags: string[];
  }[];

  const entries: LeaderboardEntry[] = rows.map((r) => ({
    rank: r.rank,
    profileId: r.profile_id,
    name: r.full_name,
    branch: r.branch ?? "",
    year: r.year ?? "",
    points: r.total_points,
    identityTags: r.identity_tags ?? [],
  }));

  let myRank = 0;
  let pointsToNextRank = 0;

  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rankData } = await (db as any).rpc("fn_student_rank", {
      p_profile_id: user.id,
    });
    myRank = (rankData as number) ?? 0;
    const myEntry = entries.find((e) => e.profileId === user.id);
    const aboveEntry = entries.find((e) => e.rank === (myEntry?.rank ?? 0) - 1);
    pointsToNextRank = aboveEntry
      ? Math.max(0, aboveEntry.points - (myEntry?.points ?? 0))
      : 0;
  }

  return { entries, myRank, pointsToNextRank };
}

export async function getSquadLeaderboard(params?: {
  campusId?: string;
  limit?: number;
}): Promise<SquadLeaderboardEntry[]> {
  const db = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("fn_leaderboard_squad", {
    p_campus_id: params?.campusId ?? null,
    p_limit: params?.limit ?? 20,
    p_offset: 0,
  });
  if (error) throw error;

  return ((data ?? []) as {
    rank: number;
    squad_id: string;
    squad_name: string;
    total_points: number;
    member_count: number;
  }[]).map((r) => ({
    rank: r.rank,
    squadId: r.squad_id,
    squadName: r.squad_name,
    points: r.total_points,
    memberCount: Number(r.member_count),
  }));
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const [
    { data: profile },
    { data: xpass },
    { data: regs },
    { data: squadMember },
    { data: activity },
  ] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", user.id).single(),
    db.from("xpasses").select("total_points").eq("profile_id", user.id).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)
      .from("event_registrations")
      .select(
        `event_id, events(id, name, slug, category, event_date, event_time, start_time, end_time,
         venue, base_points, registration_xp, checkin_xp, completion_xp, status, banner_url, campus_id, team_size, capacity)`
      )
      .eq("profile_id", user.id)
      .limit(5),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)
      .from("squad_members")
      .select(
        `squad_id, squads(id, squad_name, squad_code, total_points, captain_id, is_active)`
      )
      .eq("profile_id", user.id)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)
      .from("point_transactions")
      .select("id, reason, points, transaction_type, created_at, events(name)")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  // Rank via DB function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rankData } = await (db as any).rpc("fn_student_rank", {
    p_profile_id: user.id,
  });
  const myRank = (rankData as number) ?? 0;

  // Points to next rank — get the person above
  let pointsToNextRank = 0;
  if (myRank > 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: above } = await (db as any)
      .from("xpasses")
      .select("total_points")
      .order("total_points", { ascending: false })
      .range(myRank - 2, myRank - 2)
      .single();
    const myPoints = (xpass?.total_points as number) ?? 0;
    pointsToNextRank = Math.max(
      0,
      ((above as { total_points: number } | null)?.total_points ?? 0) -
        myPoints
    );
  }

  // Squad
  let squad: Squad | null = null;
  if (squadMember) {
    const squadData = Array.isArray(squadMember.squads)
      ? squadMember.squads[0]
      : squadMember.squads;
    if (squadData) {
      // Get members
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: members } = await (db as any)
        .from("squad_members")
        .select(
          "profile_id, joined_at, profiles(full_name, branch, year), xpasses(total_points)"
        )
        .eq("squad_id", squadData.id);

      squad = {
        id: squadData.id,
        name: squadData.squad_name,
        code: squadData.squad_code,
        captainId: squadData.captain_id,
        totalPoints: squadData.total_points,
        isActive: squadData.is_active,
        rank: 0,
        members: ((members ?? []) as {
          profile_id: string;
          joined_at: string;
          profiles: { full_name: string; branch: string; year: string } | null;
          xpasses: { total_points: number }[] | null;
        }[]).map((m) => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          const xp = Array.isArray(m.xpasses) ? m.xpasses[0] : m.xpasses;
          return {
            profileId: m.profile_id,
            name: p?.full_name ?? "Member",
            branch: p?.branch ?? "",
            year: p?.year ?? "",
            points: xp?.total_points ?? 0,
            joinedAt: m.joined_at,
            isCaptain: m.profile_id === squadData.captain_id,
          };
        }),
      };
    }
  }

  // Upcoming events from registrations
  const upcomingEvents: Event[] = ((regs ?? []) as {
    events: DbEvent | DbEvent[];
  }[])
    .map((r) => (Array.isArray(r.events) ? r.events[0] : r.events))
    .filter(Boolean)
    .map((e) => dbEventToEvent(e, new Set()));

  // Activity
  const recentActivity: ActivityItem[] = ((activity ?? []) as {
    id: string;
    reason: string;
    points: number;
    transaction_type: TransactionType;
    created_at: string;
    events: { name: string } | { name: string }[] | null;
  }[]).map((t) => {
    const evtName = Array.isArray(t.events) ? t.events[0]?.name : t.events?.name;
    return {
      id: t.id,
      action: t.reason,
      event: evtName ?? "",
      time: new Date(t.created_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      points: t.points,
      type: t.transaction_type,
    };
  });

  return {
    studentName: (profile?.full_name as string | null) ?? "Student",
    points: (xpass?.total_points as number | null) ?? 0,
    pointsToNextRank,
    rank: myRank,
    eventsRegistered: (regs as unknown[])?.length ?? 0,
    squad,
    upcomingEvents,
    recentActivity,
  };
}

// ─── XPass ────────────────────────────────────────────────────────────────────

export async function getXPass(): Promise<XPass | null> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("xpasses")
    .select(
      `xpass_id, qr_token, total_points, created_at, identity_tags, interests,
       profiles(full_name, branch, year),
       squad_members(squads(id, squad_name, squad_code, total_points, captain_id, is_active))`
    )
    .eq("profile_id", user.id)
    .single();
  if (error || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rankData } = await (db as any).rpc("fn_student_rank", {
    p_profile_id: user.id,
  });
  const myRank = (rankData as number) ?? 0;

  const profileRow = Array.isArray(data.profiles)
    ? data.profiles[0]
    : data.profiles;

  const squadMemberRows = Array.isArray(data.squad_members)
    ? data.squad_members
    : [];
  const squadRow = squadMemberRows[0]?.squads;
  const squadData = Array.isArray(squadRow) ? squadRow[0] : squadRow;

  // Squad rank
  let squadRank = 0;
  if (squadData?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sr } = await (db as any).rpc("fn_leaderboard_squad", {
      p_campus_id: null,
      p_limit: 100,
      p_offset: 0,
    });
    const squadEntry = (
      sr as { squad_id: string; rank: number }[] | null
    )?.find((s) => s.squad_id === squadData.id);
    squadRank = squadEntry?.rank ?? 0;
  }

  return {
    id: data.xpass_id as string,
    xpassId: data.xpass_id as string,
    name: (profileRow?.full_name as string | undefined) ?? "Student",
    branch: (profileRow?.branch as string | undefined) ?? "",
    year: (profileRow?.year as string | undefined) ?? "",
    qrToken: data.qr_token as string,
    points: data.total_points as number,
    rank: myRank,
    issuedAt: data.created_at as string,
    identityTags: (data.identity_tags as string[] | null) ?? [],
    interests: (data.interests as string[] | null) ?? [],
    squad: squadData?.squad_name ?? null,
    squadCode: squadData?.squad_code ?? null,
    squadRank,
  };
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export async function getActivity(): Promise<ActivityItem[]> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("point_transactions")
    .select("id, reason, points, transaction_type, created_at, events(name)")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return ((data ?? []) as {
    id: string;
    reason: string;
    points: number;
    transaction_type: TransactionType;
    created_at: string;
    events: { name: string } | { name: string }[] | null;
  }[]).map((t) => {
    const evtName = Array.isArray(t.events) ? t.events[0]?.name : t.events?.name;
    return {
      id: t.id,
      action: t.reason,
      event: evtName ?? "",
      time: new Date(t.created_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      points: t.points,
      type: t.transaction_type,
    };
  });
}

// ─── Check-In (Scanner) ───────────────────────────────────────────────────────

export async function createCheckIn(
  eventId: string,
  qrToken: string
): Promise<CheckInResult> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("fn_checkin_and_award", {
    p_qr_token: qrToken,
    p_event_id: eventId,
    p_operator_id: user.id,
  });

  if (error) throw error;

  const result = data as {
    status: string;
    student_name?: string;
    points_awarded?: number;
  };
  return {
    status: result.status as CheckInResult["status"],
    studentName: result.student_name,
    pointsAwarded: result.points_awarded,
  };
}

// ─── Reward Redemption ────────────────────────────────────────────────────────

export async function redeemReward(
  rewardQrToken: string
): Promise<RedemptionResult> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("fn_redeem_reward", {
    p_qr_token: rewardQrToken,
    p_profile_id: user.id,
  });

  if (error) throw error;

  const result = data as {
    status: string;
    reward_name?: string;
    points_awarded?: number;
  };
  return {
    status: result.status as RedemptionResult["status"],
    rewardName: result.reward_name,
    pointsAwarded: result.points_awarded,
  };
}

// ─── Squads ───────────────────────────────────────────────────────────────────

export async function getMySquad(): Promise<Squad | null> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (db as any)
    .from("squad_members")
    .select(
      "squad_id, squads(id, squad_name, squad_code, total_points, captain_id, is_active)"
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!membership) return null;
  const squadData = Array.isArray(membership.squads)
    ? membership.squads[0]
    : membership.squads;
  if (!squadData || !squadData.is_active) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (db as any)
    .from("squad_members")
    .select(
      "profile_id, joined_at, profiles(full_name, branch, year), xpasses(total_points)"
    )
    .eq("squad_id", squadData.id);

  return {
    id: squadData.id,
    name: squadData.squad_name,
    code: squadData.squad_code,
    captainId: squadData.captain_id,
    totalPoints: squadData.total_points,
    isActive: squadData.is_active,
    rank: 0,
    members: ((members ?? []) as {
      profile_id: string;
      joined_at: string;
      profiles: { full_name: string; branch: string; year: string } | null;
      xpasses: { total_points: number }[] | null;
    }[]).map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const xp = Array.isArray(m.xpasses) ? m.xpasses[0] : m.xpasses;
      return {
        profileId: m.profile_id,
        name: p?.full_name ?? "Member",
        branch: p?.branch ?? "",
        year: p?.year ?? "",
        points: xp?.total_points ?? 0,
        joinedAt: m.joined_at,
        isCaptain: m.profile_id === squadData.captain_id,
      };
    }),
  };
}

export async function createSquad(name: string): Promise<{
  status: string;
  squadCode?: string;
}> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("fn_create_squad", {
    p_captain_id: user.id,
    p_name: name,
    p_campus_id: null,
  });
  if (error) throw error;
  const result = data as { status: string; squad_code?: string };
  return { status: result.status, squadCode: result.squad_code };
}

export async function joinSquad(code: string): Promise<{
  status: string;
  squadName?: string;
}> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("fn_join_squad", {
    p_profile_id: user.id,
    p_squad_code: code,
  });
  if (error) throw error;
  const result = data as { status: string; squad_name?: string };
  return { status: result.status, squadName: result.squad_name };
}

export async function leaveSquad(): Promise<{ status: string }> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("fn_leave_squad", {
    p_profile_id: user.id,
  });
  if (error) throw error;
  return { status: (data as { status: string }).status };
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function getOperationsSummary(): Promise<OperationsSummary | null> {
  const db = createClient();
  const user = await getCurrentUser();
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
      `events(id, name, slug, category, event_date, event_time, start_time, end_time,
       venue, base_points, registration_xp, checkin_xp, completion_xp, status,
       banner_url, campus_id, team_size, capacity)`
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
      .select(
        "id, checked_in_at, profiles(full_name), events(name), point_transactions(points)"
      )
      .in("event_id", eventIds)
      .order("checked_in_at", { ascending: false })
      .limit(10);
    scans = scanData ?? [];
  }

  const { count: checkedInToday } = await db
    .from("check_ins")
    .select("*", { count: "exact", head: true })
    .gte("checked_in_at", new Date().toISOString().split("T")[0]);

  return {
    checkedInToday: checkedInToday ?? 0,
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
        points: 20,
      };
    }),
  };
}

// ─── Admin Analytics ──────────────────────────────────────────────────────────

export async function getAdminSummary(): Promise<AdminAnalytics> {
  const db = createClient();
  const [
    { count: totalStudents },
    { count: checkedIn },
    { count: activeEvents },
    { count: activeSquads },
    { count: rewardRedemptions },
    { data: pointsData },
    { data: regsData },
    { data: catData },
  ] = await Promise.all([
    db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "STUDENT"),
    db.from("check_ins").select("*", { count: "exact", head: true }),
    db
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("status", "LIVE"),
    db
      .from("squads")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    db.from("reward_redemptions").select("*", { count: "exact", head: true }),
    db.from("xpasses").select("total_points"),
    db
      .from("profiles")
      .select("created_at")
      .eq("role", "STUDENT")
      .order("created_at", { ascending: true })
      .limit(200),
    db.from("events").select("category").not("status", "eq", "ARCHIVED"),
  ]);

  const totalXpDistributed = (
    (pointsData ?? []) as { total_points: number }[]
  ).reduce((sum, x) => sum + (x.total_points ?? 0), 0);

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
    totalStudents: totalStudents ?? 0,
    registeredStudents: totalStudents ?? 0,
    checkedIn: checkedIn ?? 0,
    activeEvents: activeEvents ?? 0,
    activeSquads: activeSquads ?? 0,
    totalXpDistributed,
    totalPoints: totalXpDistributed,
    rewardRedemptions: rewardRedemptions ?? 0,
    registrationsByDay,
    categoryMix,
    campusBreakdown: [],
  } as AdminAnalytics & { registeredStudents: number; totalPoints: number };
}

// ─── Registration ─────────────────────────────────────────────────────────────

export async function createStudentRegistration(data: {
  fullName: string;
  collegeId: string;
  branch: string;
  year: string;
  whatsapp: string;
  email?: string;
  identity: string[];
  interests: string[];
}): Promise<void> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // Upsert profile
  await db.from("profiles").upsert({
    id: user.id,
    full_name: data.fullName,
    college_id: data.collegeId,
    branch: data.branch,
    year: data.year,
    whatsapp_number: data.whatsapp,
    email: data.email ?? user.email ?? null,
    role: "STUDENT",
  });

  // Upsert xpass (idempotent — preserve existing qr_token)
  const xpassId =
    "XPX-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  await db.from("xpasses").upsert(
    {
      profile_id: user.id,
      xpass_id: xpassId,
      identity_tags: data.identity,
      interests: data.interests,
    },
    { onConflict: "profile_id", ignoreDuplicates: false }
  );

  // Award registration XP (idempotent — won't double-award)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).rpc("fn_award_registration_xp", {
    p_profile_id: user.id,
    p_bonus: 50,
  });
}

// ─── Admin: XP ledger ─────────────────────────────────────────────────────────

export async function getXpLedger(params?: {
  profileId?: string;
  eventId?: string;
  limit?: number;
  offset?: number;
}): Promise<DbPointTransaction[]> {
  const db = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (db as any)
    .from("point_transactions")
    .select(
      "id, profile_id, event_id, points, reason, transaction_type, awarded_by, idempotency_key, metadata, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(params?.limit ?? 50);

  if (params?.profileId) query = query.eq("profile_id", params.profileId);
  if (params?.eventId) query = query.eq("event_id", params.eventId);
  if (params?.offset) query = query.range(params.offset, params.offset + (params?.limit ?? 50) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DbPointTransaction[];
}

export async function adminAwardXp(params: {
  profileId: string;
  points: number;
  reason: string;
  eventId?: string;
}): Promise<void> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).rpc("fn_award_xp", {
    p_profile_id: params.profileId,
    p_event_id: params.eventId ?? null,
    p_points: params.points,
    p_reason: params.reason,
    p_type: params.points >= 0 ? "MANUAL_ADJUSTMENT" : "PENALTY",
    p_awarded_by: user.id,
    p_idempotency_key: null, // Admin manual adjustments are not idempotent by design
    p_metadata: { admin_note: params.reason },
  });
}

// ─── Admin: Rewards ───────────────────────────────────────────────────────────

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  xpValue: number;
  maxRedemptions: number | null;
  currentRedemptions: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  qrToken: string;
  createdAt: string;
}

export async function listRewards(): Promise<Reward[]> {
  const db = createClient();
  const { data, error } = await db
    .from("rewards")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as {
    id: string;
    name: string;
    description: string | null;
    xp_value: number;
    max_redemptions: number | null;
    current_redemptions: number;
    is_active: boolean;
    valid_from: string | null;
    valid_until: string | null;
    qr_token: string;
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    xpValue: r.xp_value,
    maxRedemptions: r.max_redemptions,
    currentRedemptions: r.current_redemptions,
    isActive: r.is_active,
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    qrToken: r.qr_token,
    createdAt: r.created_at,
  }));
}

export async function createReward(payload: {
  name: string;
  description?: string;
  xpValue: number;
  maxRedemptions?: number;
  validFrom?: string;
  validUntil?: string;
  campusId?: string;
}): Promise<string> {
  const db = createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await db
    .from("rewards")
    .insert({
      name: payload.name,
      description: payload.description ?? null,
      xp_value: payload.xpValue,
      max_redemptions: payload.maxRedemptions ?? null,
      valid_from: payload.validFrom ?? null,
      valid_until: payload.validUntil ?? null,
      campus_id: payload.campusId ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function toggleReward(
  rewardId: string,
  isActive: boolean
): Promise<void> {
  const db = createClient();
  const { error } = await db
    .from("rewards")
    .update({ is_active: isActive })
    .eq("id", rewardId);
  if (error) throw error;
}

// ─── Admin: Students ──────────────────────────────────────────────────────────

export async function listStudents(params?: {
  search?: string;
  branch?: string;
  year?: string;
  campusId?: string;
  limit?: number;
  offset?: number;
}) {
  const db = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (db as any)
    .from("profiles")
    .select(
      "id, full_name, college_id, branch, year, email, whatsapp_number, campus_id, is_active, created_at, xpasses(total_points, xpass_id, identity_tags)"
    )
    .eq("role", "STUDENT")
    .order("created_at", { ascending: false })
    .limit(params?.limit ?? 50);

  if (params?.search) query = query.ilike("full_name", `%${params.search}%`);
  if (params?.branch) query = query.eq("branch", params.branch);
  if (params?.year) query = query.eq("year", params.year);
  if (params?.campusId) query = query.eq("campus_id", params.campusId);
  if (params?.offset) query = query.range(params.offset, params.offset + (params?.limit ?? 50) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export async function getAuditLogs(params?: {
  limit?: number;
  offset?: number;
}) {
  const db = createClient();
  const { data, error } = await db
    .from("audit_logs")
    .select(
      "id, actor_id, action, entity_type, entity_id, old_value, new_value, note, created_at, profiles(full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(params?.limit ?? 50);
  if (error) throw error;
  return data ?? [];
}

// ─── Campuses ─────────────────────────────────────────────────────────────────

export async function listCampuses() {
  const db = createClient();
  const { data, error } = await db
    .from("campuses")
    .select("id, name, code, city, is_active")
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; code: string; city: string | null; is_active: boolean }[];
}

// ─── Utils ────────────────────────────────────────────────────────────────────

export { formatNumber } from "@/lib/utils";
