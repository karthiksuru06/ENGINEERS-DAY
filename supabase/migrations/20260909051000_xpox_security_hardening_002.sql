-- ============================================================
-- MIGRATION: 002 - XpoX Security Hardening
-- ============================================================

-- 1. EXTRACT PII TO SECRETS TABLE
CREATE TABLE IF NOT EXISTS profile_secrets (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT,
  whatsapp_number TEXT
);

DO $$ 
BEGIN
  -- Backfill safely before dropping
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
    INSERT INTO profile_secrets (profile_id, email)
    SELECT id, email FROM profiles WHERE email IS NOT NULL
    ON CONFLICT (profile_id) DO UPDATE SET email = EXCLUDED.email;
    
    ALTER TABLE profiles DROP COLUMN email;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'whatsapp_number') THEN
    INSERT INTO profile_secrets (profile_id, whatsapp_number)
    SELECT id, whatsapp_number FROM profiles WHERE whatsapp_number IS NOT NULL
    ON CONFLICT (profile_id) DO UPDATE SET whatsapp_number = EXCLUDED.whatsapp_number;
    
    ALTER TABLE profiles DROP COLUMN whatsapp_number;
  END IF;
END $$;

-- 2. ENFORCE CONCURRENCY UNIQUENESS
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

ALTER TABLE check_ins DROP CONSTRAINT IF EXISTS uq_checkins_event_profile;
ALTER TABLE check_ins ADD CONSTRAINT uq_checkins_event_profile UNIQUE(event_id, profile_id);

ALTER TABLE event_registrations DROP CONSTRAINT IF EXISTS uq_event_reg_event_profile;
ALTER TABLE event_registrations ADD CONSTRAINT uq_event_reg_event_profile UNIQUE(event_id, profile_id);

ALTER TABLE squad_members DROP CONSTRAINT IF EXISTS uq_squad_members_profile;
ALTER TABLE squad_members ADD CONSTRAINT uq_squad_members_profile UNIQUE(profile_id);

-- 3. HARDEN RPCs (SECURITY DEFINER + search_path + locks + idempotency)

CREATE OR REPLACE FUNCTION fn_award_xp(
  p_profile_id      UUID,
  p_event_id        UUID,
  p_points          INTEGER,
  p_reason          TEXT,
  p_type            transaction_type,
  p_awarded_by      UUID,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata        JSONB DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
BEGIN
  IF p_points = 0 THEN
    RETURN 0;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO point_transactions (
      profile_id, event_id, points, reason, transaction_type,
      awarded_by, idempotency_key, metadata
    ) VALUES (
      p_profile_id, p_event_id, p_points, p_reason, p_type,
      p_awarded_by, p_idempotency_key, p_metadata
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    
    IF NOT FOUND THEN
      RETURN 0;
    END IF;
  ELSE
    INSERT INTO point_transactions (
      profile_id, event_id, points, reason, transaction_type,
      awarded_by, idempotency_key, metadata
    ) VALUES (
      p_profile_id, p_event_id, p_points, p_reason, p_type,
      p_awarded_by, NULL, p_metadata
    );
  END IF;

  RETURN p_points;
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_award_xp FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION fn_register_for_event(
  p_profile_id UUID,
  p_event_id   UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  v_event         RECORD;
  v_reg_count     INTEGER;
  v_already       BOOLEAN;
  v_idempotency   TEXT;
BEGIN
  IF _uid IS NULL OR _uid != p_profile_id THEN
    RETURN 'unauthorized';
  END IF;

  SELECT status, capacity, registration_xp INTO v_event
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'event_not_found'; END IF;
  IF v_event.status NOT IN ('REGISTRATION_OPEN', 'LIVE') THEN RETURN 'registration_closed'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM event_registrations
    WHERE event_id = p_event_id AND profile_id = p_profile_id
  ) INTO v_already;

  IF v_already THEN RETURN 'already_registered'; END IF;

  SELECT COUNT(*) INTO v_reg_count FROM event_registrations WHERE event_id = p_event_id;

  IF v_reg_count >= v_event.capacity THEN RETURN 'event_full'; END IF;

  INSERT INTO event_registrations (event_id, profile_id) VALUES (p_event_id, p_profile_id);

  v_idempotency := 'event-reg-' || p_event_id || '-' || p_profile_id;
  PERFORM fn_award_xp(
    p_profile_id, p_event_id, v_event.registration_xp, 'Registered for event',
    'EVENT_REGISTRATION', p_profile_id, v_idempotency, NULL
  );

  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION fn_register_for_event TO authenticated;

CREATE OR REPLACE FUNCTION fn_checkin_and_award(
  p_qr_token   UUID,
  p_event_id   UUID,
  p_operator_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _role app_role;
  v_xpass        RECORD;
  v_event        RECORD;
  v_already_in   BOOLEAN;
  v_registered   BOOLEAN;
  v_idempotency  TEXT;
  v_pts          INTEGER;
BEGIN
  IF _uid IS NULL OR _uid != p_operator_id THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;
  SELECT role INTO _role FROM profiles WHERE id = _uid;
  IF _role NOT IN ('VOLUNTEER', 'EVENT_COORDINATOR', 'ADMIN', 'SUPER_ADMIN') THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  SELECT xp.profile_id, p.full_name INTO v_xpass
  FROM xpasses xp
  JOIN profiles p ON p.id = xp.profile_id
  WHERE xp.qr_token = p_qr_token;

  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'invalid_token'); END IF;

  SELECT checkin_xp, name, status INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'event_not_found'); END IF;

  SELECT EXISTS (
    SELECT 1 FROM event_registrations WHERE event_id = p_event_id AND profile_id = v_xpass.profile_id
  ) INTO v_registered;

  IF NOT v_registered THEN
    RETURN jsonb_build_object('status', 'not_registered', 'student_name', v_xpass.full_name);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM check_ins WHERE event_id = p_event_id AND profile_id = v_xpass.profile_id
  ) INTO v_already_in;

  IF v_already_in THEN
    RETURN jsonb_build_object('status', 'already_checked_in', 'student_name', v_xpass.full_name, 'points_awarded', 0);
  END IF;

  INSERT INTO check_ins (event_id, profile_id, checked_in_by) VALUES (p_event_id, v_xpass.profile_id, p_operator_id);

  v_idempotency := 'checkin-' || p_event_id || '-' || v_xpass.profile_id;
  v_pts := fn_award_xp(
    v_xpass.profile_id, p_event_id, COALESCE(v_event.checkin_xp, 20),
    'Event check-in: ' || v_event.name, 'CHECK_IN',
    p_operator_id, v_idempotency, NULL
  );

  RETURN jsonb_build_object('status', 'ok', 'student_name', v_xpass.full_name, 'points_awarded', v_pts);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_checkin_and_award TO authenticated;

CREATE OR REPLACE FUNCTION fn_redeem_reward(
  p_qr_token   UUID,
  p_profile_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  v_reward      RECORD;
  v_already     BOOLEAN;
  v_idempotency TEXT;
  v_pts         INTEGER;
BEGIN
  IF _uid IS NULL OR _uid != p_profile_id THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;

  SELECT id, name, xp_value, is_active, valid_from, valid_until, max_redemptions, current_redemptions
  INTO v_reward
  FROM rewards WHERE qr_token = p_qr_token FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'invalid_token'); END IF;
  IF NOT v_reward.is_active THEN RETURN jsonb_build_object('status', 'reward_inactive'); END IF;
  IF v_reward.valid_from IS NOT NULL AND NOW() < v_reward.valid_from THEN RETURN jsonb_build_object('status', 'reward_not_started'); END IF;
  IF v_reward.valid_until IS NOT NULL AND NOW() > v_reward.valid_until THEN RETURN jsonb_build_object('status', 'reward_expired'); END IF;
  IF v_reward.max_redemptions IS NOT NULL AND v_reward.current_redemptions >= v_reward.max_redemptions THEN
    RETURN jsonb_build_object('status', 'reward_exhausted');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM reward_redemptions WHERE reward_id = v_reward.id AND profile_id = p_profile_id
  ) INTO v_already;

  IF v_already THEN RETURN jsonb_build_object('status', 'already_redeemed'); END IF;

  INSERT INTO reward_redemptions (reward_id, profile_id) VALUES (v_reward.id, p_profile_id);
  UPDATE rewards SET current_redemptions = current_redemptions + 1 WHERE id = v_reward.id;

  v_idempotency := 'reward-' || v_reward.id || '-' || p_profile_id;
  v_pts := fn_award_xp(
    p_profile_id, NULL, v_reward.xp_value, 'Reward: ' || v_reward.name, 'REWARD',
    p_profile_id, v_idempotency, jsonb_build_object('reward_id', v_reward.id)
  );

  RETURN jsonb_build_object('status', 'ok', 'reward_name', v_reward.name, 'points_awarded', v_pts);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_redeem_reward TO authenticated;

CREATE OR REPLACE FUNCTION fn_complete_event(
  p_profile_id  UUID,
  p_event_id    UUID,
  p_operator_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _role app_role;
  v_event       RECORD;
  v_checked_in  BOOLEAN;
  v_idempotency TEXT;
  v_pts         INTEGER;
BEGIN
  IF _uid IS NULL OR _uid != p_operator_id THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;
  SELECT role INTO _role FROM profiles WHERE id = _uid;
  IF _role NOT IN ('VOLUNTEER', 'EVENT_COORDINATOR', 'ADMIN', 'SUPER_ADMIN') THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  SELECT completion_xp, name INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'event_not_found'); END IF;

  SELECT EXISTS (
    SELECT 1 FROM check_ins WHERE event_id = p_event_id AND profile_id = p_profile_id
  ) INTO v_checked_in;

  IF NOT v_checked_in THEN RETURN jsonb_build_object('status', 'not_checked_in'); END IF;

  v_idempotency := 'completion-' || p_event_id || '-' || p_profile_id;
  v_pts := fn_award_xp(
    p_profile_id, p_event_id, COALESCE(v_event.completion_xp, 50),
    'Event completion: ' || v_event.name, 'EVENT_COMPLETION',
    p_operator_id, v_idempotency, NULL
  );

  RETURN jsonb_build_object('status', 'ok', 'points_awarded', v_pts);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_complete_event TO authenticated;

CREATE OR REPLACE FUNCTION fn_create_squad(
  p_captain_id UUID,
  p_name       TEXT,
  p_campus_id  UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  v_already_in BOOLEAN;
  v_squad_code TEXT;
  v_squad_id   UUID;
BEGIN
  IF _uid IS NULL OR _uid != p_captain_id THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;

  SELECT EXISTS (
    SELECT 1 FROM squad_members sm JOIN squads s ON s.id = sm.squad_id WHERE sm.profile_id = p_captain_id AND s.is_active = true
  ) INTO v_already_in;
  IF v_already_in THEN RETURN jsonb_build_object('status', 'already_in_squad'); END IF;

  LOOP
    v_squad_code := upper(substring(md5(random()::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM squads WHERE squad_code = v_squad_code);
  END LOOP;

  IF p_campus_id IS NULL THEN
    SELECT campus_id INTO p_campus_id FROM profiles WHERE id = p_captain_id;
  END IF;

  INSERT INTO squads (squad_name, squad_code, captain_id, campus_id) VALUES (p_name, v_squad_code, p_captain_id, p_campus_id) RETURNING id INTO v_squad_id;
  INSERT INTO squad_members (squad_id, profile_id) VALUES (v_squad_id, p_captain_id);

  RETURN jsonb_build_object('status', 'ok', 'squad_id', v_squad_id, 'squad_code', v_squad_code);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_create_squad TO authenticated;

CREATE OR REPLACE FUNCTION fn_join_squad(
  p_profile_id UUID,
  p_squad_code TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  v_squad      RECORD;
  v_already_in BOOLEAN;
  v_count      INTEGER;
BEGIN
  IF _uid IS NULL OR _uid != p_profile_id THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;

  SELECT id, squad_name, is_active INTO v_squad
  FROM squads WHERE squad_code = upper(p_squad_code) FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'squad_not_found'); END IF;
  IF NOT v_squad.is_active THEN RETURN jsonb_build_object('status', 'squad_inactive'); END IF;

  SELECT EXISTS (
    SELECT 1 FROM squad_members sm JOIN squads s ON s.id = sm.squad_id WHERE sm.profile_id = p_profile_id AND s.is_active = true
  ) INTO v_already_in;
  IF v_already_in THEN RETURN jsonb_build_object('status', 'already_in_squad'); END IF;

  SELECT COUNT(*) INTO v_count FROM squad_members WHERE squad_id = v_squad.id;
  IF v_count >= 4 THEN RETURN jsonb_build_object('status', 'squad_full'); END IF;

  INSERT INTO squad_members (squad_id, profile_id) VALUES (v_squad.id, p_profile_id);
  RETURN jsonb_build_object('status', 'ok', 'squad_id', v_squad.id, 'squad_name', v_squad.squad_name);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_join_squad TO authenticated;

CREATE OR REPLACE FUNCTION fn_leave_squad(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  v_squad   RECORD;
  v_new_cap UUID;
BEGIN
  IF _uid IS NULL OR _uid != p_profile_id THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;

  SELECT s.id, s.captain_id INTO v_squad
  FROM squad_members sm JOIN squads s ON s.id = sm.squad_id WHERE sm.profile_id = p_profile_id AND s.is_active = true;

  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_in_squad'); END IF;

  DELETE FROM squad_members WHERE squad_id = v_squad.id AND profile_id = p_profile_id;

  IF v_squad.captain_id = p_profile_id THEN
    SELECT profile_id INTO v_new_cap FROM squad_members WHERE squad_id = v_squad.id ORDER BY joined_at ASC LIMIT 1;
    IF v_new_cap IS NOT NULL THEN
      UPDATE squads SET captain_id = v_new_cap WHERE id = v_squad.id;
    ELSE
      UPDATE squads SET is_active = false WHERE id = v_squad.id;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;
GRANT EXECUTE ON FUNCTION fn_leave_squad TO authenticated;

CREATE OR REPLACE FUNCTION fn_admin_award_xp(
  p_profile_id      UUID,
  p_event_id        UUID,
  p_points          INTEGER,
  p_reason          TEXT,
  p_type            transaction_type,
  p_awarded_by      UUID,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _role app_role;
  v_pts INTEGER;
BEGIN
  IF _uid IS NULL OR _uid != p_awarded_by THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;
  SELECT role INTO _role FROM profiles WHERE id = _uid;
  IF _role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;

  v_pts := fn_award_xp(
    p_profile_id, p_event_id, p_points, p_reason, p_type,
    p_awarded_by, p_idempotency_key, jsonb_build_object('admin_note', p_reason)
  );

  RETURN jsonb_build_object('status', 'ok', 'points_awarded', v_pts);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_admin_award_xp TO authenticated;

-- 4. HARDEN RLS POLICIES

-- profiles: only self can update
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

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

-- events: only admin/coordinator can write
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage events" ON events;
CREATE POLICY "Admins can manage events" ON events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'EVENT_COORDINATOR'))
  );

-- rewards: only admin can write
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
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

-- squads: stop arbitrary inserts
ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can insert squads" ON squads;
CREATE POLICY "Admins can insert squads" ON squads FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
); 

ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can insert squad members" ON squad_members;
CREATE POLICY "Admins can insert squad members" ON squad_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);
