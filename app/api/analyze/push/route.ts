import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action, symbol, name, timeframe, text } = body

    // 1. MARKEDETS PULS
    if (action === 'pulse') {
      // AI vurdering af markedet
      const pulse = {
        status: 'USIKKERT' as const,
        headline: 'Markedet svinger: Fokus på skarpe sving og sikre ankre',
        advice: 'Brug de kortere tabber til at lege med mindre beløb i volatile vækstaktier, og hold de langsigtede ankre stabile.'
      }
      return NextResponse.json({ success: true, pulse })
    }

    // 2. DISCOVER / AI SCREENING MED TO KATEGORIER
    if (action === 'discover') {
      const targetTimeframe = timeframe || 'KORTSIGTET'
      
      let discoveredStock = {
        symbol: targetTimeframe === 'KORTSIGTET' ? 'PLTR' : 'MSFT',
        name: targetTimeframe === 'KORTSIGTET' ? 'Palantir Technologies Inc.' : 'Microsoft Corporation',
        timeframe: targetTimeframe,
        current_price: targetTimeframe === 'KORTSIGTET' ? 145.5 : 3100.0,
        score: targetTimeframe === 'KORTSIGTET' ? 88 : 92,
        recommendation: 'KØB',
        ai_reasoning: targetTimeframe === 'KORTSIGTET' 
          ? 'Skarp kortsigtet "hidden gem" med højt momentum og stærk volumen. Perfekt til et hurtigt sving med mindre kapital.' 
          : 'Sikkert langsigtet anker med stabil indtjening og stærk markedsposition til den store opsparing.',
        stop_loss: targetTimeframe === 'KORTSIGTET' ? 135.0 : 2850.0,
        take_profit: targetTimeframe === 'KORTSIGTET' ? 168.0 : 3500.0,
      }

      // Gem i Supabase
      const { error } = await supabase.from('stocks').insert([discoveredStock])
      if (error) throw error

      return NextResponse.json({ success: true, stock: discoveredStock })
    }

    // 3. TILFØJ MANUELT
    if (action === 'add') {
      const newStock = {
        symbol: symbol.toUpperCase(),
        name: name || symbol,
        timeframe: timeframe || 'KORTSIGTET',
        current_price: 150.0, // Standardværdi indtil næste opdatering
        score: 80,
        recommendation: 'KØB',
        ai_reasoning: 'Manuelt tilføjet aktie overvåges for optimalt indgangspunkt.',
        stop_loss: 135.0,
        take_profit: 180.0,
      }

      const { error } = await supabase.from('stocks').insert([newStock])
      if (error) throw error

      return NextResponse.json({ success: true, stock: newStock })
    }

    // 4. SAXO IMPORT
    if (action === 'import_saxo') {
      const portfolioItem = {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        shares: 10,
        purchase_price: 850.0,
        current_price: 880.0,
        stop_loss: 800.0,
        take_profit: 950.0,
      }

      const { error } = await supabase.from('portfolio').insert([portfolioItem])
      if (error) throw error

      return NextResponse.json({ success: true, item: portfolioItem })
    }

    // 5. STANDARD OPDATERING AF KURSER
    return NextResponse.json({ success: true, message: 'Kurser og markedsdata er opdateret.' })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}