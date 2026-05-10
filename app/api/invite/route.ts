import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// This route uses the SERVICE ROLE key to send real invite emails
// Add SUPABASE_SERVICE_ROLE_KEY to your Vercel environment variables

export async function POST(req: NextRequest) {
  try {
    const { email, full_name, role } = await req.json()

    if (!email || !full_name || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Invite user via Supabase Auth (sends real email with magic link)
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin')}/auth`,
        data: { full_name, role },
      }
    )

    if (inviteError) {
      // If user already exists in auth, just send password reset
      if (inviteError.message?.includes('already been registered')) {
        const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
        })
        if (resetError) throw resetError
      } else {
        throw inviteError
      }
    }

    // 2. Upsert into Users table
    const userId = authData?.user?.id || crypto.randomUUID()
    const { error: dbError } = await supabaseAdmin.from('Users').upsert({
      id: userId,
      email,
      full_name,
      role,
    }, { onConflict: 'email' })

    if (dbError) throw dbError

    return NextResponse.json({ success: true, userId })
  } catch (error: any) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
