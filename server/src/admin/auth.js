import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create admin client with service role key for admin checks
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * Verify JWT token and get user
 * @param {string} token - JWT token from Authorization header
 * @returns {Promise<Object|null>} User object or null if invalid
 */
export async function verifyToken(token) {
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

/**
 * Check if user is an admin
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>} True if user is admin
 */
export async function isAdmin(userId) {
  try {
    // Direct table query (more reliable than RPC)
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle() // Use maybeSingle instead of single to avoid error on no match

    if (error) {
      console.error('Error checking admin status:', error)
      return false
    }

    const isAdmin = !!data
    console.log(`isAdmin check for ${userId}: ${isAdmin}`)
    return isAdmin
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * Admin authentication middleware
 * Verifies JWT token and checks admin status
 */
export async function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Admin auth: No token provided')
      return res.status(401).json({ error: 'Unauthorized: No token provided' })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token
    const user = await verifyToken(token)
    if (!user) {
      console.log('Admin auth: Invalid token')
      return res.status(401).json({ error: 'Unauthorized: Invalid token' })
    }

    console.log(`Admin auth: Verifying admin status for user ${user.id} (${user.email})`)

    // Check admin status
    const adminStatus = await isAdmin(user.id)
    console.log(`Admin auth: Admin status for ${user.id}: ${adminStatus}`)

    if (!adminStatus) {
      console.log(`Admin auth: User ${user.id} is not an admin`)
      return res.status(403).json({ error: 'Forbidden: Admin access required' })
    }

    // Attach user to request
    req.user = user
    next()
  } catch (error) {
    console.error('Error in adminAuth middleware:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
