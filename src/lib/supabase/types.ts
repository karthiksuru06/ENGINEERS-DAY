// ============================================================
// XpoX Supabase TypeScript Types
// Matches schema after migration 001_xpox_foundation.sql
// ============================================================

export type AppRole =
  | "STUDENT"
  | "VOLUNTEER"
  | "EVENT_COORDINATOR"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "DISPLAY";

export type TransactionType =
  | "REGISTRATION"
  | "EVENT_REGISTRATION"
  | "CHECK_IN"
  | "EVENT_COMPLETION"
  | "REWARD"
  | "BONUS"
  | "MANUAL_ADJUSTMENT"
  | "PENALTY";

export type EventStatus =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "LIVE"
  | "COMPLETED"
  | "ARCHIVED";

export type EventCategory = "BUILD" | "PLAY" | "CREATE" | "LEAD" | "EXPLORE";

export type IdentityTag =
  | "Builder"
  | "Gamer"
  | "Creator"
  | "Founder"
  | "Speaker"
  | "Explorer";

export type InterestTag =
  | "AI / ML"
  | "Web / App Development"
  | "Cybersecurity"
  | "Robotics / IoT"
  | "Gaming"
  | "Content / Reels"
  | "Startups"
  | "Public Speaking"
  | "Design / UI/UX";

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface DbCampus {
  id: string;
  name: string;
  code: string;
  city: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DbAcademicYear {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface DbProfile {
  id: string;
  role: AppRole;
  full_name: string;
  college_id: string | null;
  branch: string | null;
  year: string | null;
  email: string | null;
  whatsapp_number: string | null;
  campus_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbXPass {
  id: string;
  profile_id: string;
  xpass_id: string;
  qr_token: string;
  identity_tags: string[];
  interests: string[];
  total_points: number;
  created_at: string;
}

export interface DbSquad {
  id: string;
  squad_name: string;
  squad_code: string;
  captain_id: string | null;
  total_points: number;
  campus_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSquadMember {
  id: string;
  squad_id: string;
  profile_id: string;
  joined_at: string;
}

export interface DbEvent {
  id: string;
  name: string;
  slug: string | null;
  category: EventCategory;
  description: string | null;
  event_date: string;
  event_time: string;
  start_time: string | null;
  end_time: string | null;
  venue: string;
  team_size: number;
  capacity: number;
  base_points: number;
  registration_xp: number;
  checkin_xp: number;
  completion_xp: number;
  status: EventStatus;
  banner_url: string | null;
  instructions: string | null;
  eligibility: string | null;
  campus_id: string | null;
  academic_year_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbEventRegistration {
  id: string;
  event_id: string;
  profile_id: string;
  registered_at: string;
}

export interface DbCheckIn {
  id: string;
  event_id: string;
  profile_id: string;
  checked_in_by: string | null;
  checked_in_at: string;
}

export interface DbPointTransaction {
  id: string;
  profile_id: string;
  event_id: string | null;
  points: number;
  reason: string;
  transaction_type: TransactionType;
  awarded_by: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DbReward {
  id: string;
  name: string;
  description: string | null;
  xp_value: number;
  max_redemptions: number | null;
  current_redemptions: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  campus_id: string | null;
  eligibility: string | null;
  qr_token: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbRewardRedemption {
  id: string;
  reward_id: string;
  profile_id: string;
  redeemed_at: string;
  campus_id: string | null;
}

export interface DbAuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  campus_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
}

export interface DbEventPointRule {
  id: string;
  event_id: string;
  rule_key: string;
  points: number;
  description: string | null;
  created_at: string;
}

export interface DbEventAssignment {
  id: string;
  event_id: string;
  profile_id: string;
  role: AppRole;
  assigned_at: string;
}

// ─── Application-level (domain) types ────────────────────────────────────────

export interface Event {
  id: string;
  name: string;
  slug: string;
  category: EventCategory;
  description: string;
  date: string;
  startTime: string;
  endTime: string | null;
  venue: string;
  teamSize: string;
  capacity: number;
  registered: number;
  basePoints: number;
  registrationXp: number;
  checkinXp: number;
  completionXp: number;
  status: EventStatus;
  bannerUrl: string | null;
  instructions: string | null;
  campusId: string | null;
  isRegistered?: boolean;
  isCheckedIn?: boolean;
}

export interface XPass {
  id: string;
  xpassId: string;
  name: string;
  branch: string;
  year: string;
  qrToken: string;
  points: number;
  rank: number;
  issuedAt: string;
  identityTags: string[];
  interests: string[];
  squad: string | null;
  squadCode: string | null;
  squadRank: number;
}

export interface LeaderboardEntry {
  rank: number;
  profileId: string;
  name: string;
  branch: string;
  year: string;
  points: number;
  identityTags: string[];
}

export interface SquadLeaderboardEntry {
  rank: number;
  squadId: string;
  squadName: string;
  points: number;
  memberCount: number;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  myRank: number;
  pointsToNextRank: number;
}

export interface Squad {
  id: string;
  name: string;
  code: string;
  captainId: string;
  totalPoints: number;
  isActive: boolean;
  members: SquadMember[];
  rank: number;
}

export interface SquadMember {
  profileId: string;
  name: string;
  branch: string;
  year: string;
  points: number;
  joinedAt: string;
  isCaptain: boolean;
}

export interface ActivityItem {
  id: string;
  action: string;
  event: string;
  time: string;
  points: number;
  type: TransactionType;
}

export interface DashboardSummary {
  studentName: string;
  points: number;
  pointsToNextRank: number;
  rank: number;
  eventsRegistered: number;
  squad: Squad | null;
  upcomingEvents: Event[];
  recentActivity: ActivityItem[];
}

export interface AdminAnalytics {
  totalStudents: number;
  checkedIn: number;
  activeEvents: number;
  activeSquads: number;
  totalXpDistributed: number;
  rewardRedemptions: number;
  registrationsByDay: { day: string; registrations: number }[];
  categoryMix: { category: string; count: number }[];
  campusBreakdown: { campus: string; students: number; xp: number }[];
}

export interface OperationsSummary {
  checkedInToday: number;
  staffName: string;
  assignedEvents: Event[];
  recentScans: {
    id: string;
    name: string;
    event: string;
    time: string;
    points: number;
  }[];
}

export interface CheckInResult {
  status:
    | "ok"
    | "already_checked_in"
    | "invalid_token"
    | "not_registered"
    | "event_not_found";
  studentName?: string;
  pointsAwarded?: number;
}

export interface RedemptionResult {
  status:
    | "ok"
    | "invalid_token"
    | "reward_inactive"
    | "reward_expired"
    | "reward_exhausted"
    | "already_redeemed"
    | "reward_not_started";
  rewardName?: string;
  pointsAwarded?: number;
}

export type EventRegistrationResult =
  | "ok"
  | "already_registered"
  | "event_full"
  | "registration_closed"
  | "event_not_found";
