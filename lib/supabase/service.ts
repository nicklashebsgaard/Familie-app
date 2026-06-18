import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// Bypasses RLS — use only in internal API routes (Aula sync, admin tasks)
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
