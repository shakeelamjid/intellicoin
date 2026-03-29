// app/api/admin/create-user/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const { email, password, full_name, role } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email confirmation
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Create public.users row
    const { error: profileError } = await supabaseAdmin.from('users').upsert({
      id:                   authData.user.id,
      email:                email,
      full_name:            full_name || null,
      role:                 role || 'user',
      is_active:            true,
      min_rank_access:      'ALL',
      allowed_ranks:        ['S','A','B','C'],
      allowed_scenarios:    [1,2,3,4,5,6,7,8,9],
      notify_email:         true,
      notify_telegram:      false,
      weekend_signals:      true,
      max_signals_per_day:  100,
      max_signals_per_hour: 20,
      manual_scans_per_day: 3,
    })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, user_id: authData.user.id })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
