import { createClient, SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

let cached: SupabaseClient | null = null

/**
 * Lazily build the Supabase client. Construction (and env validation) is
 * deferred until the first time the exported `supabase` proxy is touched so
 * that importing this module has no side effects — modules that transitively
 * pull this in (e.g. game/roundState.ts → db/entities.ts → here) can be
 * loaded in tests without a real Supabase configuration. Calling code that
 * actually needs the client (e.g. `supabase.from('entities')…`) will still
 * fail loudly if env vars are missing, which is what we want at runtime.
 */
function getClient(): SupabaseClient {
  if (cached) return cached

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  cached = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  return cached
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient()
    const value = Reflect.get(client as object, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  }
}) as SupabaseClient
