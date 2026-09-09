-- ============================================================
-- MIGRATION: 003 - Critical Vertical Slice & Security Patch
-- ============================================================

-- 1. Fix CRITICAL VULNERABILITY in fn_award_registration_xp
DROP FUNCTION IF EXISTS fn_award_registration_xp(UUID, INTEGER);

CREATE OR REPLACE FUNCTION fn_award_registration_xp(
  p_profile_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL OR _uid != p_profile_id THEN
    RETURN 0;
  END IF;

  RETURN fn_award_xp(
    p_profile_id, NULL,
    50, -- Hardcode 50 XP internally
    'Welcome to XpoX! Registration bonus.',
    'REGISTRATION',
    p_profile_id,
    'registration-' || p_profile_id,
    NULL
  );
END;
$$;
GRANT EXECUTE ON FUNCTION fn_award_registration_xp TO authenticated;

-- 2. Prevent role and campus tampering via standard UPDATE requests
CREATE OR REPLACE FUNCTION tg_protect_profile_fields() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _is_admin BOOLEAN := false;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = _uid AND role IN ('ADMIN', 'SUPER_ADMIN')) INTO _is_admin;
    IF NOT _is_admin THEN
      NEW.role := OLD.role;
      NEW.campus_id := OLD.campus_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_profiles ON profiles;
CREATE TRIGGER trigger_protect_profiles
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION tg_protect_profile_fields();


-- 3. Prevent total_points and qr_token tampering via standard UPDATE requests
CREATE OR REPLACE FUNCTION tg_protect_xpass_fields() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _is_admin BOOLEAN := false;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = _uid AND role IN ('ADMIN', 'SUPER_ADMIN')) INTO _is_admin;
    IF NOT _is_admin THEN
      NEW.total_points := OLD.total_points;
      NEW.qr_token := OLD.qr_token;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_xpasses ON xpasses;
CREATE TRIGGER trigger_protect_xpasses
BEFORE UPDATE ON xpasses
FOR EACH ROW EXECUTE FUNCTION tg_protect_xpass_fields();


-- 4. Secure Reward QR Tokens via View
CREATE OR REPLACE VIEW vw_public_rewards AS
SELECT id, name, description, xp_value, max_redemptions, current_redemptions, is_active, valid_from, valid_until, campus_id, created_at, updated_at
FROM rewards;

GRANT SELECT ON vw_public_rewards TO PUBLIC, authenticated;

DROP POLICY IF EXISTS "Active rewards viewable by all" ON rewards;
CREATE POLICY "Admins can read rewards" ON rewards FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- 5. Add search_path to Leaderboard Functions for security
CREATE OR REPLACE FUNCTION fn_student_rank(p_profile_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rank::INTEGER
  FROM (
    SELECT profile_id, RANK() OVER (ORDER BY total_points DESC) AS rank
    FROM xpasses
  ) ranked
  WHERE profile_id = p_profile_id;
$$;

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
SET search_path = public
AS $$
  SELECT
    RANK() OVER (ORDER BY xp.total_points DESC) AS rank,
    xp.profile_id, p.full_name, p.branch, p.year, xp.total_points, xp.identity_tags
  FROM xpasses xp
  JOIN profiles p ON p.id = xp.profile_id
  WHERE (p_campus_id IS NULL OR p.campus_id = p_campus_id) AND p.is_active = true
  ORDER BY xp.total_points DESC
  LIMIT p_limit OFFSET p_offset;
$$;

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
SET search_path = public
AS $$
  SELECT
    RANK() OVER (ORDER BY s.total_points DESC) AS rank,
    s.id AS squad_id, s.squad_name, s.total_points, COUNT(sm.profile_id) AS member_count
  FROM squads s
  LEFT JOIN squad_members sm ON sm.squad_id = s.id
  WHERE (p_campus_id IS NULL OR s.campus_id = p_campus_id) AND s.is_active = true
  GROUP BY s.id, s.squad_name, s.total_points
  ORDER BY s.total_points DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- 6. Prevent squad campus spoofing
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
  _real_campus UUID;
  _is_admin BOOLEAN := false;
  v_already_in BOOLEAN;
  v_squad_code TEXT;
  v_squad_id   UUID;
BEGIN
  IF _uid IS NULL OR _uid != p_captain_id THEN 
    RETURN jsonb_build_object('status', 'unauthorized'); 
  END IF;
  
  -- Resolve user's actual campus and role
  SELECT campus_id, EXISTS(SELECT 1 WHERE role IN ('ADMIN', 'SUPER_ADMIN')) 
  INTO _real_campus, _is_admin 
  FROM profiles WHERE id = _uid;

  -- Only admins can pass a spoofed campus_id
  IF p_campus_id IS NOT NULL AND NOT _is_admin THEN
    p_campus_id := _real_campus;
  ELSIF p_campus_id IS NULL THEN
    p_campus_id := _real_campus;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM squad_members sm JOIN squads s ON s.id = sm.squad_id WHERE sm.profile_id = p_captain_id AND s.is_active = true
  ) INTO v_already_in;
  IF v_already_in THEN RETURN jsonb_build_object('status', 'already_in_squad'); END IF;

  LOOP
    v_squad_code := upper(substring(md5(random()::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM squads WHERE squad_code = v_squad_code);
  END LOOP;

  INSERT INTO squads (squad_name, squad_code, captain_id, campus_id) VALUES (p_name, v_squad_code, p_captain_id, p_campus_id) RETURNING id INTO v_squad_id;
  INSERT INTO squad_members (squad_id, profile_id) VALUES (v_squad_id, p_captain_id);

  RETURN jsonb_build_object('status', 'ok', 'squad_id', v_squad_id, 'squad_code', v_squad_code);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_create_squad TO authenticated;
