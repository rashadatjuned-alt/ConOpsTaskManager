import { createClient } from '@supabase/supabase-js'

/**
 * DIAGNOSTIC Supabase client - shows exactly what env vars Next.js sees
 * (helps debug "supabaseUrl is required" forever)
 */
console.log('🔍 [Supabase Init] Checking environment variables...')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('📌 NEXT_PUBLIC_SUPABASE_URL     =', supabaseUrl ? `"${supabaseUrl}"` : '❌ EMPTY / UNDEFINED')
console.log('📌 NEXT_PUBLIC_SUPABASE_ANON_KEY =', supabaseAnonKey ? `"${supabaseAnonKey.substring(0, 8)}...${supabaseAnonKey.substring(supabaseAnonKey.length - 8)}"` : '❌ EMPTY / UNDEFINED')

if (!supabaseUrl) {
  throw new Error(
    `❌ CRITICAL: NEXT_PUBLIC_SUPABASE_URL is missing or empty.\n` +
    `   • Value seen by Next.js: ${JSON.stringify(supabaseUrl)}\n` +
    `   • Fix: Create/edit .env.local in project root with:\n` +
    `     NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co\n` +
    `   • Then STOP and RESTART the dev server (Ctrl+C then npm run dev)`
  )
}

if (!supabaseAnonKey) {
  throw new Error(
    `❌ CRITICAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or empty.\n` +
    `   • Value seen by Next.js: ${JSON.stringify(supabaseAnonKey)}\n` +
    `   • Fix: Add it to .env.local and restart the dev server.`
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

console.log('✅ Supabase client created successfully')