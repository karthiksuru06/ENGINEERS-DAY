# XpoX Deployment Checklist

## Supabase

* [ ] Dedicated XpoX project created (isolated from `finance-os`)
* [ ] Migration applied (`supabase/migrations/001_xpox_foundation.sql`)
* [ ] Auth configured (Email/Password or preferred providers)
* [ ] RLS verified (Testing constraints against anonymous/authenticated roles)
* [ ] Realtime enabled for `xpasses` (via Supabase Dashboard -> Database -> Replication -> enable for `xpasses`)
* [ ] Realtime enabled for `squads` (via Supabase Dashboard -> Database -> Replication -> enable for `squads`)
* [ ] Production URL configured in Supabase Dashboard (Site URL and Redirect URLs)
* [ ] Required environment variables configured in Supabase (if using edge functions/webhooks in the future)

## Application

* [ ] `NEXT_PUBLIC_SUPABASE_URL` configured in hosting provider (e.g., Vercel)
* [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured in hosting provider
* [ ] Authentication redirect URLs point to the production domain
* [ ] Production domain linked and SSL active
* [ ] Clean production build (`npm run build` exits 0)

## Security

* [ ] No service-role key exposed to browser (Only the Anon Key)
* [ ] No `.env` secrets committed to GitHub
* [ ] No PII exposed through public queries (Verified that `profiles` does not contain `email` or `whatsapp_number`)
* [ ] Admin authorization verified (Admin test account successfully performs restricted actions, normal student account is blocked)
