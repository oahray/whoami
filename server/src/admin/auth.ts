import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import type { Request, Response, NextFunction } from 'express'
import type { User } from '@supabase/supabase-js'
import { logger } from '../utils/logger.js'

dotenv.config()

let cachedAdminClient: SupabaseClient | null = null

/**
 * Lazily build the Supabase admin client. Like `db/supabase.ts`, we defer env
 * validation to first use so importing this module (e.g. via admin route
 * registration) is safe in environments without Supabase env vars (CI, tests
 * that don't need auth).
 */
function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  cachedAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  return cachedAdminClient
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)

    if (error || !user) {
      return null
    }

    return user
  } catch (error) {
    logger.error('Error verifying token', error)
    return null
  }
}

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      logger.error('Error checking admin status', error, { userId })
      return false
    }

    return !!data
  } catch (error) {
    logger.error('Error checking admin status', error, { userId })
    return false
  }
}

export interface AuthRequest extends Request {
  user?: User
}

export async function adminAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' })
    }

    const token = authHeader.substring(7)

    const user = await verifyToken(token)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' })
    }

    const adminStatus = await isAdmin(user.id)

    if (!adminStatus) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' })
    }

    req.user = user
    next()
  } catch (error) {
    logger.error('Error in adminAuth middleware', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
