import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Use admin client to access auth.users
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * Script to add a user as an admin
 * Usage: node src/scripts/addAdmin.js <user-email>
 */
async function addAdmin() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: node src/scripts/addAdmin.js <user-email>')
    process.exit(1)
  }

  try {
    // Get user by email from auth.users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      throw new Error(`Failed to list users: ${usersError.message}`)
    }

    const user = users.find(u => u.email === email)

    if (!user) {
      console.error(`User with email ${email} not found in auth.users`)
      console.log('Available users:')
      users.forEach(u => console.log(`  - ${u.email} (${u.id})`))
      process.exit(1)
    }

    // Check if already admin
    const { data: existing, error: checkError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      console.log(`User ${email} is already an admin`)
      process.exit(0)
    }

    // Add to admin_users table
    const { data, error } = await supabase
      .from('admin_users')
      .insert({
        user_id: user.id,
        email: user.email
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add admin: ${error.message}`)
    }

    console.log(`✅ Successfully added ${email} as admin`)
    console.log(`   User ID: ${user.id}`)
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

addAdmin()
