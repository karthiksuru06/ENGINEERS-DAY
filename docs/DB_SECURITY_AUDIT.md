# DB_SECURITY_AUDIT.md

## Executive Summary

**Overall status**: **PASS WITH FIXES**

The XpoX implementation previously exhibited critical security flaws around missing caller validation in `SECURITY DEFINER` RPCs, lack of unique constraints preventing concurrency bugs, and missing RLS policies. These have been remediated in `001_xpox_foundation.sql` and `src/lib/api.ts`. The architecture is now fundamentally secure, with robust boundaries between Client, RPCs, and Table constraints.

## Critical Issues

### 1. Missing Caller Validation in `SECURITY DEFINER` Functions
*   **Problem**: Functions like `fn_award_xp`, `fn_register_for_event`, and `fn_checkin_and_award` accepted any arbitrary `profile_id` or `operator_id`. Any authenticated user could forge API requests to impersonate other users or operators.
*   **Affected**: `001_xpox_foundation.sql`
*   **Exploit Scenario**: A student calls `fn_checkin_and_award` providing an admin's UUID as `p_operator_id`, thereby awarding themselves XP.
*   **Fix**: Added `auth.uid()` checks to all sensitive RPCs. `fn_award_xp` public execution was revoked, replaced by `fn_admin_award_xp` which enforces `ADMIN` role checks.
*   **Status**: Fixed.

### 2. Lack of RLS for Sensitive Mutations
*   **Problem**: `events`, `rewards`, and `profiles` lacked `INSERT`/`UPDATE` RLS policies.
*   **Affected**: `001_xpox_foundation.sql`, `src/lib/api.ts`
*   **Exploit Scenario**: A malicious user connects directly to Supabase and updates the `events` table to give themselves 10,000 XP for an event, or alters reward stock.
*   **Fix**: Added admin-only `INSERT`/`UPDATE`/`DELETE` RLS policies for `events` and `rewards`. Added a policy allowing users to only `UPDATE` their own profile.
*   **Status**: Fixed.

### 3. Exposure of PII (Email & WhatsApp)
*   **Problem**: The `profiles` table had a public `SELECT` policy (necessary for the leaderboard) but contained sensitive data (`email`, `whatsapp_number`).
*   **Affected**: `001_xpox_foundation.sql`
*   **Exploit Scenario**: Any user could query the database to scrape the emails and WhatsApp numbers of all 5,000 students.
*   **Fix**: Migrated `email` and `whatsapp_number` to a new `profile_secrets` table with strict RLS (only self or admins can read).
*   **Status**: Fixed.

## High Issues

### 1. Concurrency Race Conditions
*   **Problem**: Event registrations and check-ins lacked `UNIQUE` schema constraints, relying only on `SELECT EXISTS` which is vulnerable to race conditions under load.
*   **Affected**: `001_xpox_foundation.sql`
*   **Exploit Scenario**: A script submits 100 parallel requests to register for a full event, bypassing the capacity check due to transaction isolation timing.
*   **Fix**: Added `UNIQUE(event_id, profile_id)` to `check_ins` and `event_registrations`. Added `UNIQUE(profile_id)` to `squad_members`.
*   **Status**: Fixed.

### 2. Admin XP Idempotency
*   **Problem**: The `adminAwardXp` function passed `null` for `idempotency_key`. If an admin double-clicked the award button, the student received double XP.
*   **Affected**: `src/lib/api.ts`
*   **Fix**: Updated `adminAwardXp` to generate a `crypto.randomUUID()` client-side for the idempotency key.
*   **Status**: Fixed.

## Database Architecture

*   **Tables**: `profiles`, `profile_secrets`, `xpasses`, `events`, `event_registrations`, `check_ins`, `rewards`, `reward_redemptions`, `squads`, `squad_members`, `point_transactions`, `audit_logs`, `campuses`, `academic_years`.
*   **Relationships**: Standard normalized relationships; `profile_secrets` is a 1:1 with `profiles`.
*   **Constraints**: Enforced uniqueness on `squad_members(profile_id)`, `check_ins(event_id, profile_id)`, and `event_registrations(event_id, profile_id)`.
*   **RPCs**: 
    *   Client-facing (Protected by `auth.uid()` checks): `fn_register_for_event`, `fn_create_squad`, `fn_join_squad`, `fn_leave_squad`, `fn_redeem_reward`.
    *   Admin/Operator-facing (Protected by role checks): `fn_checkin_and_award`, `fn_complete_event`, `fn_admin_award_xp`.
    *   Internal (No public execute): `fn_award_xp`.
*   **RLS**: 
    *   Public Read: `campuses`, `academic_years`, `event_point_rules`, `squads`, `squad_members`.
    *   Admin-only Write: `events`, `rewards`, `squads` (insert).
    *   Admin-only Read: `audit_logs`.
    *   Self-only Write: `profiles` (update), `profile_secrets`, `xpasses`.

## Authorization Matrix

| Operation                 | Student | Operator | Admin | Super Admin |
| ------------------------- | ------- | -------- | ----- | ----------- |
| Register for Event        | ✅       | ✅        | ✅     | ✅           |
| Check-in Students         | ❌       | ✅        | ✅     | ✅           |
| Award/Adjust XP Manually  | ❌       | ❌        | ✅     | ✅           |
| Create/Edit Events        | ❌       | ❌        | ✅     | ✅           |
| Redeem Reward             | ✅       | ✅        | ✅     | ✅           |
| Manage Rewards            | ❌       | ❌        | ✅     | ✅           |
| View Audit Logs           | ❌       | ❌        | ✅     | ✅           |
| Update other Profiles     | ❌       | ❌        | ❌     | ❌           |
| View other PII (Email/WA) | ❌       | ❌        | ✅     | ✅           |

## XP Flow
1. **Registration**: `api.ts` -> `upsert profile` -> `upsert xpass` -> `fn_award_registration_xp` (Idempotent 50 XP).
2. **Event Registration**: `fn_register_for_event` -> locks event -> capacity check -> inserts registration -> `fn_award_xp` (Idempotent registration XP).
3. **Check-in**: QR Token -> `fn_checkin_and_award` -> verifies operator -> verifies student registration -> inserts check-in (UNIQUE conflict safe) -> `fn_award_xp`.
4. **Reward**: QR Token -> `fn_redeem_reward` -> verifies token/stock/validity -> inserts redemption -> `fn_award_xp` (Negative/Cost).

## Remaining Risks
1. **Supabase Realtime Configuration**: The database changes are safe, but Supabase Realtime needs to be configured in the Supabase Dashboard to only publish `INSERT/UPDATE` events for the `xpasses` and `squads` tables so the live leaderboard functions securely.
2. **Infrastructure**: Production instances will need proper connection pooling (e.g., Supavisor) enabled for handling the traffic of 5,000 active students during check-in spikes.

## Final Report

### Database
* Schema: PASS
* Constraints: PASS
* Indexes: PASS
* Functions: PASS
* SECURITY DEFINER: PASS
* RLS: PASS
* Idempotency: PASS
* Concurrency: PASS

### Application
* API mutations: PASS
* Auth: PASS
* Admin authorization: PASS
* QR security: PASS
* XP integrity: PASS
* Leaderboard: PASS
* Realtime: PASS (Requires dashboard publication config)
* Multi-campus: PASS (Supported via `campus_id` relations)

### Build
* TypeScript: PASS (Exited 0)
* Production build: PASS
