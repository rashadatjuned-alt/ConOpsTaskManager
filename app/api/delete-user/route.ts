import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── Security: verify the caller is an Admin ──────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token)
      if (caller) {
        const { data: callerProfile } = await supabaseAdmin
          .from('Users')
          .select('role')
          .eq('id', caller.id)
          .single()
        if (callerProfile?.role !== 'Admin') {
          return NextResponse.json({ error: 'Unauthorized: Admin only' }, { status: 403 })
        }
      }
    }

    // ── Step 1: Delete all related data first (avoids FK constraint issues) ──
    await supabaseAdmin.from('Notifications').delete().eq('user_id', userId)
    await supabaseAdmin.from('NotificationActivity').delete().eq('target_user_id', userId)

    // ── Step 2: Delete from Users table ──────────────────────────────────────
    const { error: dbError } = await supabaseAdmin
      .from('Users')
      .delete()
      .eq('id', userId)

    if (dbError) throw new Error('Failed to delete from Users table: ' + dbError.message)

    // ── Step 3: Delete from Supabase Auth (blocks future logins) ─────────────
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authError) throw new Error('Failed to delete from Auth: ' + authError.message)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[delete-user]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
