import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const subscription = await request.json()
    if (!subscription) {
      return NextResponse.json({ error: 'Intet abonnement modtaget' }, { status: 400 })
    }

    // Gem eller opdater i databasen
    const { error } = await supabase.from('push_subscriptions').insert({
      subscription: subscription
    })

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Push-abonnement gemt!' })
  } catch (error: any) {
    console.error('Push fejl:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}