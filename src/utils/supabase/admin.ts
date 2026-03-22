import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Server-only client with the service role key. Never import from client components.
 * Set SUPABASE_SERVICE_ROLE_KEY in the deployment environment (not NEXT_PUBLIC_*).
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL mancanti')
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
