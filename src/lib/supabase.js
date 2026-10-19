import { createClient } from '@supabase/supabase-js'

// Public values. The publishable key is meant to ship in client code;
// access to data is enforced by Row Level Security in the database.
export const SUPABASE_URL = 'https://fruozifbduzceuyyqetq.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_xmnISOLbLEaQC603mSWrFA_nbdtzgJf'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export function publicFormUrl(slug) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`
  return `${base}#/f/${slug}`
}
