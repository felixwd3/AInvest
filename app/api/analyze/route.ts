import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { GoogleGenAI } from '@google/genai'
import webpush from 'web-push'

// Opsæt web-push med en gyldig 32-tegns nøgle til test/brug
try {
  webpush.setVapidDetails(
    'mailto:support@ainvest.app',
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYPE5NjhFk',
    '12345678901234567890123456789012' // Præcis 32 tegn lang gyldig privat nøgle
  )
} catch (e) {
  console.error('Vapid setup fejl:', e)
}

function parseNumeric(val: any): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/[^0-9.,]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

async function generateWithFallback(ai: GoogleGenAI, prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    })
    if (response.text) return response.text
  } catch (err: any) {
    console.warn('Gemini-3.7-flash havde travlhed, prøver 3.5-flash...', err)
  }

  const fallbackResponse = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
  })
  return fallbackResponse.text || ''
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY mangler i miljøvariabler' }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey })
    let body: any = {}
    try {
      body = await request.json()
    } catch (e) {}

    // SAXO LYN-IMPORT
    if (body && body.action === 'import_saxo') {
      const rawText = body.text || ''
      const prompt = `Du er en intelligent assistent der udlæser handelsdata fra Saxo-tekster eller noter. 
      Brugeren har indtastet følgende tekst om et aktiekøb: "${rawText}".
      Svara KUN i gyldigt JSON-format:
      {
        "symbol": "Ticker symbol (f.eks. TSLA eller AAPL)",
        "name": "Virksomhedens fulde navn",
        "shares": antal aktier som tal,
        "purchase_price": købspris pr aktie som rent tal,
        "stop_loss": et foreslået stop-loss rent tal,
        "take_profit": et foreslået take-profit rent tal
      }`

      const textResponse = await generateWithFallback(ai, prompt)
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleanJson)

      const { error: insertError } = await supabase.from('portfolio').insert({
        symbol: String(parsed.symbol).toUpperCase().trim(),
        name: parsed.name || parsed.symbol,
        shares: Number(parsed.shares) || 1,
        purchase_price: parseNumeric(parsed.purchase_price) || 0,
        current_price: parseNumeric(parsed.purchase_price) || 0,
        stop_loss: parseNumeric(parsed.stop_loss),
        take_profit: parseNumeric(parsed.take_profit),
      })

      if (insertError) throw new Error('Database fejl ved import: ' + insertError.message)
      return NextResponse.json({ success: true, message: `Tilføjet ${parsed.symbol} til portefølje!` })
    }

    // MARKEDETS PULS
    if (body && body.action === 'pulse') {
      const prompt = `Analyser aktiemarkedet lige nu på en helt almindelig, jordnær måde. 
      Vælg en status: "ROLIGT", "USIKKERT" eller "UROLIGT".
      Svar KUN i gyldigt JSON-format:
      {
        "status": enten "ROLIGT", "USIKKERT" eller "UROLIGT",
        "headline": "En kort, mundret overskrift på dansk",
        "advice": "Et enkelt råd til en investor på dansk (maks 2 sætninger)"
      }`

      const textResponse = await generateWithFallback(ai, prompt)
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      return NextResponse.json({ success: true, pulse: JSON.parse(cleanJson) })
    }

    // TILFØJ AKTIE TIL OVERVÅGNING
    if (body && body.action === 'add' && body.symbol) {
      const symbol = body.symbol.toUpperCase().trim()
      const name = body.name ? body.name.trim() : symbol
      const timeframe = body.timeframe || 'LANGSIKTET'

      const prompt = `Analyser aktien ${name} (${symbol}) med fokus på en **${timeframe}** horisont. 
      Svar KUN i gyldigt JSON-format:
      {
        "score": et tal mellem 0 og 100,
        "recommendation": "KØB", "HOLD" eller "SÆLG",
        "ai_reasoning": "Kort begrundelse på dansk",
        "beginner_explanation": "Let forklaring for en nybegynder",
        "current_price": et rent tal,
        "stop_loss": et rent tal,
        "take_profit": et rent tal
      }`

      const textResponse = await generateWithFallback(ai, prompt)
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      const analysis = JSON.parse(cleanJson)

      await supabase.from('stocks').insert({
        symbol, name, timeframe,
        score: Number(analysis.score) || 50,
        recommendation: analysis.recommendation || 'HOLD',
        ai_reasoning: analysis.ai_reasoning || '',
        beginner_explanation: analysis.beginner_explanation || '',
        current_price: parseNumeric(analysis.current_price),
        stop_loss: parseNumeric(analysis.stop_loss),
        take_profit: parseNumeric(analysis.take_profit),
      })

      return NextResponse.json({ success: true, message: `Aktie ${symbol} tilføjet!` })
    }

    // AI DISCOVER TOP 3
    if (body && body.action === 'discover') {
      const timeframe = body.timeframe || 'LANGSIKTET'
      const prompt = `Foreslå 3 spændende aktier til en ${timeframe} horisont. Én af dem skal have "is_top_pick": true.
      Svar KUN i et gyldigt JSON-array:
      [
        {
          "symbol": "TICKER",
          "name": "Virksomhedsnavn",
          "score": et tal mellem 75 og 98,
          "recommendation": "KØB",
          "ai_reasoning": "Kort begrundelse",
          "beginner_explanation": "Hvorfor god for nybegynder",
          "current_price": et rent tal,
          "stop_loss": et rent tal,
          "take_profit": et rent tal,
          "is_top_pick": true eller false
        }
      ]`

      const textResponse = await generateWithFallback(ai, prompt)
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      const suggestions = JSON.parse(cleanJson)

      if (Array.isArray(suggestions)) {
        for (const s of suggestions) {
          await supabase.from('stocks').insert({
            symbol: s.symbol, name: s.name, timeframe,
            score: Number(s.score) || 75,
            recommendation: s.recommendation || 'KØB',
            ai_reasoning: s.ai_reasoning || '',
            beginner_explanation: s.beginner_explanation || '',
            current_price: parseNumeric(s.current_price),
            stop_loss: parseNumeric(s.stop_loss),
            take_profit: parseNumeric(s.take_profit),
          })
        }
      }
      return NextResponse.json({ success: true, message: 'Anbefalinger tilføjet!' })
    }

    // OPDATÉR KURSER OG TJEK STOP-LOSS FOR PORTEFØLJE
    const { data: portfolio } = await supabase.from('portfolio').select('*')
    if (portfolio && portfolio.length > 0) {
      await Promise.all(portfolio.map(async (item) => {
        const prompt = `Giv mig udelukkende den nuværende aktiepris for ${item.name} (${item.symbol}) som et rent tal uden tekst.`
        try {
          const priceStr = await generateWithFallback(ai, prompt)
          const curPrice = parseNumeric(priceStr)
          if (curPrice) {
            await supabase.from('portfolio').update({ current_price: curPrice }).eq('id', item.id)

            if (item.stop_loss && curPrice <= item.stop_loss) {
              const { data: subs } = await supabase.from('push_subscriptions').select('*')
              if (subs) {
                const payload = JSON.stringify({
                  title: `🚨 STOP-LOSS UDLØST: ${item.symbol}`,
                  body: `Aktuel kurs (${curPrice}) har ramt eller er under dit stop-loss (${item.stop_loss}). Overvej at sælge!`
                })
                subs.forEach(sub => {
                  webpush.sendNotification(sub.subscription, payload).catch(() => {})
                })
              }
            }
          }
        } catch (e) {}
      }))
    }

    return NextResponse.json({ success: true, message: 'Alt opdateret og tjekket for stop-loss!' })
  } catch (error: any) {
    console.error('API Fejl:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}