import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    // Return a stub when env vars are not configured so pages render without crashing.
    // Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ error: new Error('Supabase not configured') }),
        signUp: async () => ({ error: new Error('Supabase not configured') }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }), limit: () => ({ data: null, error: null }) }), order: () => ({ ascending: true, limit: () => ({ data: [], error: null }) }), in: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }), gte: () => ({ data: [], error: null }) }),
        insert: async () => ({ error: new Error('Supabase not configured') }),
        upsert: async () => ({ error: null }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }
  return createBrowserClient(url, key)
}
