-- ============================================================
-- XpoX Foundation Migration — 001
-- Run this in your Supabase SQL editor.
-- This is ADDITIVE — all existing data is preserved.
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS (only create if not exists)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM (
    'STUDENT','VOLUNTEER','EVENT_COORDINATOR','ADMIN','SUPER_ADMIN','DISPLAY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM (
    'REGISTRATION','EVENT_REGISTRATION','CHECK_IN','EVENT_COMPLETION',
    'REWARD','BONUS','MANUAL_ADJUSTMENT','PENALTY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM (
    'DRAFT','REGISTRATION_OPEN','REGISTRATION_CLOSED','LIVE','COMPLETED','ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- NEW TABLE: campuses
-- ============================================================

CREATE TABLE IF NOT EXISTS campuses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  city        TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default campus (idempotent)
INSERT INTO campuses (name, code, city)
VALUES ('KIET - Campus I', 'KIET-I', 'Ghaziabad')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- NEW TABLE: academic_years
-- ============================================================

CREATE TABLE IF NOT EXISTS academic_years (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label       TEXT UNIQUE NOT NULL,        -- e.g. "2026"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one year can be current
CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_year_current
  ON academic_years (is_current) WHERE is_current = true;

-- Seed current academic year (idempotent)
INSERT INTO academic_years (label, start_date, end_date, is_current)
VALUES ('2026', '2026-01-01', '2026-12-31', true)
ON CONFLICT (label) DO NOTHING;

-- ============================================================
-- ALTER: profiles — add new columns
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email          TEXT,
  ADD COLUMN IF NOT EXISTS campus_id      UUID REFERENCES campuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true;

-- NEW TABLE: profile_secrets
CREATE TABLE IF NOT EXISTS profile_secrets (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT,
  whatsapp_number TEXT
);

-- Backfill secrets
INSERT INTO profile_secrets (profile_id, email, whatsapp_number)
SELECT id, email, whatsapp_number FROM profiles
ON CONFLICT DO NOTHING;

-- Optional: we can nullify email/whatsapp in profiles later, but we will protect the rows via RLS view instead or just leave them and use column-level security. Actually, let's just use RLS for profile_secrets and remove the columns from public exposure.


-- Backfill campus_id for existing profiles
UPDATE profiles
SET campus_id = (SELECT id FROM campuses WHERE code = 'KIET-I' LIMIT 1)
WHERE campus_id IS NULL;

-- ============================================================
-- ALTER: events — add all missing XpoX columns
-- ============================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS slug              TEXT,
  ADD COLUMN IF NOT EXISTS start_time        TIME,
  ADD COLUMN IF NOT EXISTS end_time          TIME,
  ADD COLUMN IF NOT EXISTS campus_id         UUID REFERENCES campuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_year_id  UUID REFERENCES academic_years(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registration_xp   INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS checkin_xp        INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS completion_xp     INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS banner_url        TEXT,
  ADD COLUMN IF NOT EXISTS instructions      TEXT,
  ADD COLUMN IF NOT EXISTS eligibility       TEXT,
  ADD COLUMN IF NOT EXISTS created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill campus + year for existing events
UPDATE events
SET
  campus_id        = (SELECT id FROM campuses WHERE code = 'KIET-I' LIMIT 1),
  academic_year_id = (SELECT id FROM academic_years WHERE label = '2026' LIMIT 1)
WHERE campus_id IS NULL;

-- Migrate event_time → start_time if start_time is null
UPDATE events SET start_time = event_time WHERE start_time IS NULL AND event_time IS NOT NULL;

-- Generate slugs for events that don't have one
UPDATE events
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

-- Make slug unique index (after backfill)
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_slug ON events (slug) WHERE slug IS NOT NULL;

-- ============================================================
-- ALTER: squads — add campus_id
-- ============================================================

ALTER TABLE squads
  ADD COLUMN IF NOT EXISTS campus_id  UUID REFERENCES campuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE squads
SET campus_id = (SELECT id FROM campuses WHERE code = 'KIET-I' LIMIT 1)
WHERE campus_id IS NULL;

-- ============================================================
-- ALTER: point_transactions — add idempotency + enum type
-- ============================================================

ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata        JSONB;

-- Unique idempotency key (sparse — only when provided)
CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_idempotency
  ON point_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- NEW TABLE: event_point_rules
-- ============================================================

CREATE TABLE IF NOT EXISTS event_point_rules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rule_key     TEXT NOT NULL,   -- e.g. 'REGISTRATION', 'CHECK_IN', 'COMPLETION', 'WINNER', 'RUNNER_UP'
  points       INTEGER NOT NULL DEFAULT 0,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, rule_key)
);

-- ============================================================
-- NEW TABLE: rewards
-- ============================================================

CREATE TABLE IF NOT EXISTS rewards (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  description       TEXT,
  xp_value          INTEGER NOT NULL DEFAULT 0,
  max_redemptions   INTEGER,           -- NULL = unlimited
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  valid_from        TIMESTAMPTZ,
  valid_until       TIMESTAMPTZ,
  campus_id         UUID REFERENCES campuses(id) ON DELETE SET NULL,
  eligibility       TEXT,              -- JSON or plain text rule
  qr_token          UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NEW TABLE: reward_redemptions
-- ============================================================

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reward_id    UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  campus_id    UUID REFERENCES campuses(id) ON DELETE SET NULL,
  UNIQUE(reward_id, profile_id)    -- one redemption per student per reward
);

-- ============================================================
-- NEW TABLE: audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,        -- e.g. 'UPDATE_EVENT_XP', 'MANUAL_XP_AWARD'
  entity_type  TEXT NOT NULL,        -- e.g. 'event', 'profile', 'reward'
  entity_id    UUID,
  campus_id    UUID REFERENCES campuses(id) ON DELETE SET NULL,
  old_value    JSONB,
  new_value    JSONB,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_campus      ON profiles (campus_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_events_campus        ON events (campus_id);
CREATE INDEX IF NOT EXISTS idx_events_status        ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_academic_year ON events (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_xpasses_points       ON xpasses (total_points DESC);
CREATE INDEX IF NOT EXISTS idx_squads_points        ON squads (total_points DESC);
CREATE INDEX IF NOT EXISTS idx_squads_campus        ON squads (campus_id);
CREATE INDEX IF NOT EXISTS idx_point_tx_profile     ON point_transactions (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_tx_event       ON point_transactions (event_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_event      ON check_ins (event_id, checked_in_at DESC);
-- ADDED BY AUDIT: Unique constraints for concurrency
ALTER TABLE check_ins ADD CONSTRAINT uq_checkins_event_profile UNIQUE(event_id, profile_id);
ALTER TABLE event_registrations ADD CONSTRAINT uq_event_reg_event_profile UNIQUE(event_id, profile_id);
ALTER TABLE squad_members ADD CONSTRAINT uq_squad_members_profile UNIQUE(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor     ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity    ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions   ON reward_redemptions (reward_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations (event_id);

-- ============================================================
-- DATABASE FUNCTION: fn_award_xp
-- Atomic, idempotent XP award. Returns points awarded (0 if duplicate).
-- ============================================================

CREATE OR REPLACE FUNCTION fn_award_xp(
  p_profile_id      UUID,
  p_event_id        UUID,
  p_points          INTEGER,
  p_reason          TEXT,
  p_type            TEXT,
  p_awarded_by      UUID,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata        JSONB DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted BOOLEAN := false;
BEGIN
  -- Skip if zero points
  IF p_points = 0 THEN
    RETURN 0;
  END IF;

  -- Idempotency guard
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM point_transactions WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN 0; -- Already awarded
    END IF;
  END IF;

  -- Insert the transaction
  INSERT INTO point_transactions (
    profile_id, event_id, points, reason, transaction_type,
    awarded_by, idempotency_key, metadata
  ) VALUES (
    p_profile_id, p_event_id, p_points, p_reason, p_type,
    p_awarded_by, p_idempotency_key, p_metadata
  );

  RETURN p_points;
END;
$$;

-- ============================================================
-- DATABASE FUNCTION: fn_register_for_event
-- Atomic event registration with capacity + status guard + XP award.
-- Returns 'ok', 'already_registered', 'event_full', 'registration_closed'
-- ============================================================

CREATE OR REPLACE FUNCTION fn_register_for_event(
  p_profile_id UUID,
  p_event_id   UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  -- AUDIT FIX: Verify caller identity
  _uid UUID := auth.uid();

  v_event         RECORD;
  v_reg_count     INTEGER;
  v_already       BOOLEAN;
  v_idempotency   TEXT;
BEGIN
  IF _uid IS NULL OR _uid != p_profile_id THEN
    RETURN 'unauthorized';
  END IF;

  -- Lock and read event
  SELECT status, capacity, registration_xp
  INTO v_event
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'event_not_found';
  END IF;

  -- Check registration status
  IF v_event.status NOT IN ('REGISTRATION_OPEN', 'LIVE') THEN
    RETURN 'registration_closed';
  END IF;

  -- Check if already registered
  SELECT EXISTS (
    SELECT 1 FROM event_registrations
    WHERE event_id = p_event_id AND profile_id = p_profile_id
  ) INTO v_already;

  IF v_already THEN
    RETURN 'already_registered';
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_reg_count
  FROM event_registrations
  WHERE event_id = p_event_id;

  IF v_reg_count >= v_event.capacity THEN
    RETURN 'event_full';
  END IF;

  -- Insert registration
  INSERT INTO event_registrations (event_id, profile_id)
  VALUES (p_event_id, p_profile_id);

  -- Award registration XP (idempotent)
  v_idempotency := 'event-reg-' || p_event_id || '-' || p_profile_id;
  PERFORM fn_award_xp(
    p_profile_id, p_event_id,
    v_event.registration_xp,
    'Registered for event',
    'EVENT_REGISTRATION',
    p_profile_id,
    v_idempotency,
    NULL
  );

  RETURN 'ok';
END;
$$;

-- ============================================================
-- DATABASE FUNCTION: fn_checkin_and_award
-- Atomic check-in via QR token + XP award.
-- Returns JSON: { status, student_name, points_awarded }
-- ============================================================

CREATE OR REPLACE FUNCTION fn_checkin_and_award(
  p_qr_token   UUID,
  p_event_id   UUID,
  p_operator_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  _uid UUID := auth.uid();
  _role TEXT;

  v_xpass        RECORD;
  v_event        RECORD;
  v_profile      RECORD;
  v_already_in   BOOLEAN;
  v_registered   BOOLEAN;
  v_idempotency  TEXT;
  v_pts          INTEGER;
BEGIN
  IF _uid IS NULL OR _uid != p_operator_id THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  SELECT role INTO _role FROM profiles WHERE id = _uid;
  IF _role NOT IN ('VOLUNTEER', 'EVENT_COORDINATOR', 'ADMIN', 'SUPER_ADMIN') THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  -- Resolve QR token → xpass → profile
  SELECT xp.profile_id, p.full_name
  INTO v_xpass
  FROM xpasses xp
  JOIN profiles p ON p.id = xp.profile_id
  WHERE xp.qr_token = p_qr_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  -- Validate event
  SELECT checkin_xp, name, status
  INTO v_event
  FROM events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'event_not_found');
  END IF;

  -- Check student is registered for the event
  SELECT EXISTS (
    SELECT 1 FROM event_registrations
    WHERE event_id = p_event_id AND profile_id = v_xpass.profile_id
  ) INTO v_registered;

  IF NOT v_registered THEN
    RETURN jsonb_build_object(
      'status', 'not_registered',
      'student_name', v_xpass.full_name
    );
  END IF;

  -- Idempotency: check if already checked in
  SELECT EXISTS (
    SELECT 1 FROM check_ins
    WHERE event_id = p_event_id AND profile_id = v_xpass.profile_id
  ) INTO v_already_in;

  IF v_already_in THEN
    RETURN jsonb_build_object(
      'status', 'already_checked_in',
      'student_name', v_xpass.full_name,
      'points_awarded', 0
    );
  END IF;

  -- Insert check-in
  INSERT INTO check_ins (event_id, profile_id, checked_in_by)
  VALUES (p_event_id, v_xpass.profile_id, p_operator_id);

  -- Award check-in XP (idempotent)
  v_idempotency := 'checkin-' || p_event_id || '-' || v_xpass.profile_id;
  v_pts := fn_award_xp(
    v_xpass.profile_id, p_event_id,
    COALESCE(v_event.checkin_xp, 20),
    'Event check-in: ' || v_event.name,
    'CHECK_IN',
    p_operator_id,
    v_idempotency,
    NULL
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'student_name', v_xpass.full_name,
    'points_awarded', v_pts
  );
END;
$$;

-- ============================================================
-- DATABASE FUNCTION: fn_redeem_reward
-- Atomic reward redemption. Returns status JSON.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_redeem_reward(
  p_qr_token   UUID,
  p_profile_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  _uid UUID := auth.uid();

  v_reward      RECORD;
  v_already     BOOLEAN;
  v_idempotency TEXT;
  v_pts         INTEGER;
BEGIN
  IF _uid IS NULL OR _uid != p_profile_id THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  -- Resolve reward
  SELECT id, name, xp_value, is_active,
         valid_from, valid_until,
         max_redemptions, current_redemptions
  INTO v_reward
  FROM rewards
  WHERE qr_token = p_qr_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  IF NOT v_reward.is_active THEN
    RETURN jsonb_build_object('status', 'reward_inactive');
  END IF;

  -- Validity window
  IF v_reward.valid_from IS NOT NULL AND NOW() < v_reward.valid_from THEN
    RETURN jsonb_build_object('status', 'reward_not_started');
  END IF;

  IF v_reward.valid_until IS NOT NULL AND NOW() > v_reward.valid_until THEN
    RETURN jsonb_build_object('status', 'reward_expired');
  END IF;

  -- Redemption limit
  IF v_reward.max_redemptions IS NOT NULL
     AND v_reward.current_redemptions >= v_reward.max_redemptions THEN
    RETURN jsonb_build_object('status', 'reward_exhausted');
  END IF;

  -- Duplicate redemption guard
  SELECT EXISTS (
    SELECT 1 FROM reward_redemptions
    WHERE reward_id = v_reward.id AND profile_id = p_profile_id
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('status', 'already_redeemed');
  END IF;

  -- Insert redemption
  INSERT INTO reward_redemptions (reward_id, profile_id)
  VALUES (v_reward.id, p_profile_id);

  -- Increment counter
  UPDATE rewards SET current_redemptions = current_redemptions + 1
  WHERE id = v_reward.id;

  -- Award XP
  v_idempotency := 'reward-' || v_reward.id || '-' || p_profile_id;
  v_pts := fn_award_xp(
    p_profile_id, NULL,
    v_reward.xp_value,
    'Reward: ' || v_reward.name,
    'REWARD',
    p_profile_id,
    v_idempotency,
    jsonb_build_object('reward_id', v_reward.id)
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'reward_name', v_reward.name,
    'points_awarded', v_pts
  );
END;
$$;

-- ============================================================
-- DATABASE FUNCTION: fn_complete_event
-- Mark student as event-completed and award completion XP.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_complete_event(
  p_profile_id  UUID,
  p_event_id    UUID,
  p_operator_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  _uid UUID := auth.uid();
  _role TEXT;

  v_event       RECORD;
  v_checked_in  BOOLEAN;
  v_idempotency TEXT;
  v_pts         INTEGER;
BEGIN
  IF _uid IS NULL OR _uid != p_operator_id THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  SELECT role INTO _role FROM profiles WHERE id = _uid;
  IF _role NOT IN ('VOLUNTEER', 'EVENT_COORDINATOR', 'ADMIN', 'SUPER_ADMIN') THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  SELECT completion_xp, name INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'event_not_found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM check_ins WHERE event_id = p_event_id AND profile_id = p_profile_id
  ) INTO v_checked_in;

  IF NOT v_checked_in THEN
    RETURN jsonb_build_object('status', 'not_checked_in');
  END IF;

  v_idempotency := 'completion-' || p_event_id || '-' || p_profile_id;
  v_pts := fn_award_xp(
    p_profile_id, p_event_id,
    COALESCE(v_event.completion_xp, 50),
    'Event completion: ' || v_event.name,
    'EVENT_COMPLETION',
    p_operator_id,
    v_idempotency,
    NULL
  );

  RETURN jsonb_build_object('status', 'ok', 'points_awarded', v_pts);
END;
$$;

-- ============================================================
-- DATABASE FUNCTION: fn_student_rank
-- Returns exact rank for a student without full table scan.
-- Uses window function via subquery.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_student_rank(p_profile_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT rank::INTEGER
  FROM (
    SELECT profile_id, RANK() OVER (ORDER BY total_points DESC) AS rank
    FROM xpasses
  ) ranked
  WHERE profile_id = p_profile_id;
$$;

-- ============================================================
-- DATABASE FUNCTION: fn_leaderboard_individual
-- Efficient leaderboard using window functions.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_leaderboard_individual(
  p_campus_id UUID DEFAULT NULL,
  p_limit     INTEGER DEFAULT 20,
  p_offset    INTEGER DEFAULT 0
) RETURNS TABLE (
  rank        BIGINT,
  profile_id  UUID,
  full_name   TEXT,
  branch      TEXT,
  year        TEXT,
  total_points INTEGER,
  identity_tags TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    RANK() OVER (ORDER BY xp.total_points DESC) AS rank,
    xp.profile_id,
    p.full_name,
    p.branch,
    p.year,
    xp.total_points,
    xp.identity_tags
  FROM xpasses xp
  JOIN profiles p ON p.id = xp.profile_id
  WHERE (p_campus_id IS NULL OR p.campus_id = p_campus_id)
    AND p.is_active = true
  ORDER BY xp.total_points DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================================
-- DATABASE FUNCTION: fn_leaderboard_squad
-- ============================================================

CREATE OR REPLACE FUNCTION fn_leaderboard_squad(
  p_campus_id UUID DEFAULT NULL,
  p_limit     INTEGER DEFAULT 20,
  p_offset    INTEGER DEFAULT 0
) RETURNS TABLE (
  rank         BIGINT,
  squad_id     UUID,
  squad_name   TEXT,
  total_points INTEGER,
  member_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    RANK() OVER (ORDER BY s.total_points DESC) AS rank,
    s.id AS squad_id,
    s.squad_name,
    s.total_points,
    COUNT(sm.profile_id) AS member_count
  FROM squads s
  LEFT JOIN squad_members sm ON sm.squad_id = s.id
  WHERE (p_campus_id IS NULL OR s.campus_id = p_campus_id)
    AND s.is_active = true
  GROUP BY s.id, s.squad_name, s.total_points
  ORDER BY s.total_points DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================================
-- TRIGGER: update_total_points (replace existing with robust version)
-- ============================================================

CREATE OR REPLACE FUNCTION update_total_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Update individual xpass total
  UPDATE xpasses
  SET total_points = (
    SELECT COALESCE(SUM(points), 0)
    FROM point_transactions
    WHERE profile_id = NEW.profile_id
  )
  WHERE profile_id = NEW.profile_id;

  -- Update squad total
  UPDATE squads
  SET total_points = (
    SELECT COALESCE(SUM(xp.total_points), 0)
    FROM squad_members sm
    JOIN xpasses xp ON xp.profile_id = sm.profile_id
    WHERE sm.squad_id = squads.id
  )
  WHERE id IN (
    SELECT squad_id FROM squad_members WHERE profile_id = NEW.profile_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_points ON point_transactions;
CREATE TRIGGER trigger_update_points
AFTER INSERT ON point_transactions
FOR EACH ROW EXECUTE FUNCTION update_total_points();

-- ============================================================
-- DATABASE FUNCTION: fn_create_squad
-- ============================================================

CREATE OR REPLACE FUNCTION fn_create_squad(
  p_captain_id UUID,
  p_name       TEXT,
  p_campus_id  UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  _uid UUID := auth.uid();

  v_already_in BOOLEAN;
  v_squad_code TEXT;
  v_squad_id   UUID;
BEGIN
  IF _uid IS NULL OR _uid != p_captain_id THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  -- Check if already in a squad
  SELECT EXISTS (
    SELECT 1 FROM squad_members sm
    JOIN squads s ON s.id = sm.squad_id
    WHERE sm.profile_id = p_captain_id AND s.is_active = true
  ) INTO v_already_in;

  IF v_already_in THEN
    RETURN jsonb_build_object('status', 'already_in_squad');
  END IF;

  -- Generate unique code
  LOOP
    v_squad_code := upper(substring(md5(random()::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM squads WHERE squad_code = v_squad_code);
  END LOOP;

  -- Resolve campus if not provided
  IF p_campus_id IS NULL THEN
    SELECT campus_id INTO p_campus_id FROM profiles WHERE id = p_captain_id;
  END IF;

  -- Create squad
  INSERT INTO squads (squad_name, squad_code, captain_id, campus_id)
  VALUES (p_name, v_squad_code, p_captain_id, p_campus_id)
  RETURNING id INTO v_squad_id;

  -- Add captain as member
  INSERT INTO squad_members (squad_id, profile_id)
  VALUES (v_squad_id, p_captain_id);

  RETURN jsonb_build_object(
    'status', 'ok',
    'squad_id', v_squad_id,
    'squad_code', v_squad_code
  );
END;
$$;

-- ============================================================
-- DATABASE FUNCTION: fn_join_squad
-- ============================================================

CREATE OR REPLACE FUNCTION fn_join_squad(
  p_profile_id UUID,
  p_squad_code TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  _uid UUID := auth.uid();

  v_squad      RECORD;
  v_already_in BOOLEAN;
  v_count      INTEGER;
BEGIN
  IF _uid IS NULL OR _uid != p_profile_id THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  SELECT id, squad_name, is_active INTO v_squad
  FROM squads WHERE squad_code = upper(p_squad_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'squad_not_found');
  END IF;

  IF NOT v_squad.is_active THEN
    RETURN jsonb_build_object('status', 'squad_inactive');
  END IF;

  -- Check if already in a squad
  SELECT EXISTS (
    SELECT 1 FROM squad_members sm
    JOIN squads s ON s.id = sm.squad_id
    WHERE sm.profile_id = p_profile_id AND s.is_active = true
  ) INTO v_already_in;

  IF v_already_in THEN
    RETURN jsonb_build_object('status', 'already_in_squad');
  END IF;

  -- Check squad size (max 4)
  SELECT COUNT(*) INTO v_count FROM squad_members WHERE squad_id = v_squad.id;
  IF v_count >= 4 THEN
    RETURN jsonb_build_object('status', 'squad_full');
  END IF;

  INSERT INTO squad_members (squad_id, profile_id)
  VALUES (v_squad.id, p_profile_id);

  RETURN jsonb_build_object(
    'status', 'ok',
    'squad_id', v_squad.id,
    'squad_name', v_squad.squad_name
  );
END;
$$;

-- ============================================================
-- DATABASE FUNCTION: fn_leave_squad
-- ============================================================

CREATE OR REPLACE FUNCTION fn_leave_squad(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  _uid UUID := auth.uid();

  v_squad   RECORD;
  v_new_cap UUID;
BEGIN
  IF _uid IS NULL OR _uid != p_profile_id THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  SELECT s.id, s.captain_id INTO v_squad
  FROM squad_members sm
  JOIN squads s ON s.id = sm.squad_id
  WHERE sm.profile_id = p_profile_id AND s.is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_in_squad');
  END IF;

  -- Remove from squad
  DELETE FROM squad_members WHERE squad_id = v_squad.id AND profile_id = p_profile_id;

  -- If was captain, transfer to next member
  IF v_squad.captain_id = p_profile_id THEN
    SELECT profile_id INTO v_new_cap
    FROM squad_members WHERE squad_id = v_squad.id
    ORDER BY joined_at ASC LIMIT 1;

    IF v_new_cap IS NOT NULL THEN
      UPDATE squads SET captain_id = v_new_cap WHERE id = v_squad.id;
    ELSE
      -- Squad is now empty — deactivate
      UPDATE squads SET is_active = false WHERE id = v_squad.id;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

-- ============================================================
-- DATABASE FUNCTION: fn_award_registration_xp
-- Called after profile + xpass creation. Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_award_registration_xp(
  p_profile_id UUID,
  p_bonus      INTEGER DEFAULT 50
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN fn_award_xp(
    p_profile_id, NULL,
    p_bonus,
    'Welcome to XpoX! Registration bonus.',
    'REGISTRATION',
    p_profile_id,
    'registration-' || p_profile_id,
    NULL
  );
END;
$$;

-- ============================================================
-- RLS POLICIES — fill gaps
-- ============================================================

-- campuses: public read
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Campuses viewable by everyone" ON campuses;
CREATE POLICY "Campuses viewable by everyone" ON campuses FOR SELECT USING (true);

-- academic_years: public read
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Academic years viewable by everyone" ON academic_years;
CREATE POLICY "Academic years viewable by everyone" ON academic_years FOR SELECT USING (true);

-- rewards: public read (active only), admin write
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active rewards viewable by all" ON rewards;
CREATE POLICY "Active rewards viewable by all" ON rewards FOR SELECT USING (true);

-- reward_redemptions
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own redemptions" ON reward_redemptions;
CREATE POLICY "Users can view own redemptions" ON reward_redemptions
  FOR SELECT USING (auth.uid() = profile_id);

-- audit_logs: admin read only
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- event_point_rules: public read
ALTER TABLE event_point_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Event point rules viewable by everyone" ON event_point_rules;
CREATE POLICY "Event point rules viewable by everyone" ON event_point_rules FOR SELECT USING (true);

-- squads: public read
ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Squads viewable by everyone" ON squads;
CREATE POLICY "Squads viewable by everyone" ON squads FOR SELECT USING (true);

-- squad_members: public read
ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Squad members viewable by everyone" ON squad_members;
CREATE POLICY "Squad members viewable by everyone" ON squad_members FOR SELECT USING (true);

-- xpasses: allow admins to read all xpasses (for admin panel)
DROP POLICY IF EXISTS "Users can view own xpass" ON xpasses;
CREATE POLICY "Users can view own xpass" ON xpasses
  FOR SELECT USING (
    auth.uid() = profile_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'VOLUNTEER', 'EVENT_COORDINATOR')
    )
  );

-- profiles: admins can read all
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);

-- ============================================================
-- GRANT execute on all functions to authenticated users
-- (RPC calls from client require this)
-- ============================================================

-- GRANT EXECUTE ON FUNCTION fn_award_xp TO authenticated; -- REMOVED BY AUDIT (Private internal function)
GRANT EXECUTE ON FUNCTION fn_register_for_event TO authenticated;
GRANT EXECUTE ON FUNCTION fn_checkin_and_award TO authenticated;
GRANT EXECUTE ON FUNCTION fn_redeem_reward TO authenticated;
GRANT EXECUTE ON FUNCTION fn_complete_event TO authenticated;
GRANT EXECUTE ON FUNCTION fn_student_rank TO authenticated;
GRANT EXECUTE ON FUNCTION fn_leaderboard_individual TO authenticated;
GRANT EXECUTE ON FUNCTION fn_leaderboard_squad TO authenticated;
GRANT EXECUTE ON FUNCTION fn_create_squad TO authenticated;
GRANT EXECUTE ON FUNCTION fn_join_squad TO authenticated;
GRANT EXECUTE ON FUNCTION fn_leave_squad TO authenticated;
GRANT EXECUTE ON FUNCTION fn_award_registration_xp TO authenticated;


-- ============================================================
-- DATABASE FUNCTION: fn_admin_award_xp (ADDED BY AUDIT)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_admin_award_xp(
  p_profile_id      UUID,
  p_event_id        UUID,
  p_points          INTEGER,
  p_reason          TEXT,
  p_type            TEXT,
  p_awarded_by      UUID,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _uid UUID := auth.uid();
  _role TEXT;
  v_pts INTEGER;
BEGIN
  IF _uid IS NULL OR _uid != p_awarded_by THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  SELECT role INTO _role FROM profiles WHERE id = _uid;
  IF _role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  v_pts := fn_award_xp(
    p_profile_id, p_event_id, p_points, p_reason, p_type,
    p_awarded_by, p_idempotency_key, jsonb_build_object('admin_note', p_reason)
  );

  RETURN jsonb_build_object('status', 'ok', 'points_awarded', v_pts);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_admin_award_xp TO authenticated;


-- ============================================================
-- AUDIT RLS FIXES
-- ============================================================

-- profiles: only self can update
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- events: only admin/coordinator can write
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;
CREATE POLICY "Events are viewable by everyone" ON events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage events" ON events;
CREATE POLICY "Admins can manage events" ON events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'EVENT_COORDINATOR'))
  );

-- rewards: only admin can write
DROP POLICY IF EXISTS "Admins can manage rewards" ON rewards;
CREATE POLICY "Admins can manage rewards" ON rewards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
  );

-- xpasses: self update/insert
ALTER TABLE xpasses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own xpass" ON xpasses;
CREATE POLICY "Users can insert own xpass" ON xpasses FOR INSERT WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Users can update own xpass" ON xpasses;
CREATE POLICY "Users can update own xpass" ON xpasses FOR UPDATE USING (auth.uid() = profile_id);

-- profile_secrets
ALTER TABLE profile_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own secrets" ON profile_secrets;
CREATE POLICY "Users can read own secrets" ON profile_secrets FOR SELECT USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Users can update own secrets" ON profile_secrets;
CREATE POLICY "Users can update own secrets" ON profile_secrets FOR ALL USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Admins can read all secrets" ON profile_secrets;
CREATE POLICY "Admins can read all secrets" ON profile_secrets FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- squads: stop arbitrary inserts
ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can insert squads" ON squads;
CREATE POLICY "Admins can insert squads" ON squads FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
); -- (Note: users create squads via SECURITY DEFINER fn_create_squad, so client doesn't need INSERT)

ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can insert squad members" ON squad_members;
CREATE POLICY "Admins can insert squad members" ON squad_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
); -- (Note: users join via SECURITY DEFINER fn_join_squad, so client doesn't need INSERT)
