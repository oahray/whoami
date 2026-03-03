import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import type { Request, Response, NextFunction } from 'express'
import type { User } from '@supabase/supabase-js'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return null
    }

    return user
  } catch (error) {
    console.error('Error verifying token:', error)
    return null
  }
}

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error checking admin status:', error)
      return false
    }

    return !!data
  } catch (error) {
    console.error('Error checking admin status:', error)
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
    console.error('Error in adminAuth middleware:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
