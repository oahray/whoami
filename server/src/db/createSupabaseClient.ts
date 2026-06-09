import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

/** Server-side Supabase client (REST + auth). Realtime needs `ws` on Node < 22. */
export function createSupabaseClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: ws,
    },
  })
}
