-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ROLES ENUM
CREATE TYPE app_role AS ENUM ('STUDENT', 'VOLUNTEER', 'EVENT_COORDINATOR', 'ADMIN', 'SUPER_ADMIN', 'DISPLAY');

-- PROFILES (Linked to Supabase Auth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'STUDENT',
    full_name TEXT NOT NULL,
    college_id TEXT UNIQUE,
    branch TEXT,
    year TEXT,
    whatsapp_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- XPASSES (Secure QR tokens for students)
CREATE TABLE xpasses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    xpass_id TEXT UNIQUE NOT NULL, -- e.g., XPD-0428
    qr_token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    identity_tags TEXT[] DEFAULT '{}',
    interests TEXT[] DEFAULT '{}',
    total_points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SQUADS
CREATE TABLE squads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    squad_name TEXT NOT NULL,
    squad_code TEXT UNIQUE NOT NULL,
    captain_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    total_points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SQUAD MEMBERS
CREATE TABLE squad_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
    profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(squad_id, profile_id)
);

-- EVENTS
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    venue TEXT NOT NULL,
    team_size INTEGER NOT NULL DEFAULT 1,
    capacity INTEGER NOT NULL,
    base_points INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, REGISTRATION OPEN, CLOSED, LIVE, COMPLETED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EVENT REGISTRATIONS
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, profile_id)
);

-- CHECK INS
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    checked_in_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, profile_id)
);

-- POINT TRANSACTIONS (Immutable Ledger)
CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    points INTEGER NOT NULL,
    reason TEXT NOT NULL,
    transaction_type TEXT NOT NULL, -- e.g., 'PARTICIPATION', 'WINNER', 'BONUS'
    awarded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EVENT ASSIGNMENTS (For Volunteers and Coordinators)
CREATE TABLE event_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL, -- Must be VOLUNTEER or EVENT_COORDINATOR
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, profile_id)
);

-- RLS POLICIES

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- XPasses
ALTER TABLE xpasses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own xpass." ON xpasses FOR SELECT USING (auth.uid() = profile_id);

-- Events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are viewable by everyone." ON events FOR SELECT USING (true);

-- Event Registrations
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own registrations." ON event_registrations FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can register themselves." ON event_registrations FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Check Ins
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own check-ins." ON check_ins FOR SELECT USING (auth.uid() = profile_id);

-- Point Transactions
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own points." ON point_transactions FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Everyone can view points for leaderboard." ON point_transactions FOR SELECT USING (true);

-- Trigger to update total_points in xpasses and squads when a point_transaction is inserted
CREATE OR REPLACE FUNCTION update_total_points()
RETURNS TRIGGER AS $$
BEGIN
    -- Update individual
    UPDATE xpasses 
    SET total_points = total_points + NEW.points
    WHERE profile_id = NEW.profile_id;
    
    -- Update squad if applicable
    UPDATE squads
    SET total_points = total_points + NEW.points
    FROM squad_members
    WHERE squads.id = squad_members.squad_id AND squad_members.profile_id = NEW.profile_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_points
AFTER INSERT ON point_transactions
FOR EACH ROW EXECUTE FUNCTION update_total_points();
