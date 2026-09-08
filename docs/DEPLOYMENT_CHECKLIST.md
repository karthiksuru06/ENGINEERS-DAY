# XpoX Deployment Checklist

## Environment Variables

The following environment variables are required for production. Never commit real secrets to the repository, and ensure they are added to your hosting provider (e.g., Vercel).

| Variable Name | Purpose | Where Used | Scope |
| ------------- | ------- | ---------- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | The REST URL for the Supabase project. | `src/lib/supabase/client.ts`, `server.ts` | Public / Browser-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anonymous public API key for Supabase. | `src/lib/supabase/client.ts`, `server.ts` | Public / Browser-safe |

*(Note: No `SUPABASE_SERVICE_ROLE_KEY` is required or used in this architecture. Do not expose one to the browser.)*

## Supabase Configuration Checklist

Perform these exact manual steps in your dedicated XpoX Supabase project:

1. Create project.
2. Apply `001_xpox_foundation.sql`.
3. Configure Supabase Auth (Enable Email/Password or preferred providers).
4. Configure authentication redirect URLs (Point to your production domain).
5. Enable Realtime for:
   * `xpasses`
   * `squads`
6. Verify RLS.
7. Verify RPCs.
8. Verify database functions/triggers.
9. Obtain production environment values (URL and Anon Key).

## Test Data Strategy

**Do not put permanent fake data into the production migration.**

To test the application safely without polluting production:

1. **Test Admin/Operator**: Log in with an email/password. In the Supabase Dashboard, manually set your `role` in the `profiles` table to `ADMIN` or `OPERATOR`.
2. **Test Events/Rewards**: Use the `/admin/events` and `/admin/rewards` dashboards (using your Test Admin account) to create dummy events and rewards.
3. **Test Students**: Create normal accounts through `/register`.
4. **Test Squads**: Have your test students create and join squads via the UI.
5. **Cleanup**: Before the actual live event, use the Supabase Dashboard to delete the dummy rows from `events`, `rewards`, `profiles` (for test users), and `point_transactions`.

## Deployment Boundary

*   **Code**: Complete.
*   **Supabase**: Requires dedicated XpoX project and migration.
*   **Vercel**: Requires production environment configuration.
*   **E2E**: Requires live Supabase.

---

# CURRENT STATUS

**CODEBASE: FROZEN FOR INFRASTRUCTURE DEPLOYMENT**

> The application is code-complete and security-hardened. Final production readiness requires deployment against the dedicated XpoX Supabase environment and live end-to-end verification.
