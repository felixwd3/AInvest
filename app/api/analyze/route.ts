import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { GoogleGenAI } from '@google/genai'

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
    } catch (e) {
      // Ingen JSON body
    }

    // MARKEDETS PULS (HELT ENKELT OG PÆDAGOGISK SPROG)
    if (body && body.action === 'pulse') {
      const prompt = `Analyser aktiemarkedet lige nu på en helt almindelig, jordnær måde uden finansjargon. 
      Vælg en status: "ROLIGT", "USIKKERT" eller "UROLIGT".
      Svar KUN i gyldigt JSON-format med følgende felter:
      {
        "status": enten "ROLIGT", "USIKKERT" eller "UROLIGT",
        "headline": "En kort, mundret overskrift på dansk (f.eks. Markedet tager det stille og roligt)",
        "advice": "Et helt enkelt og ærligt råd til en begynder på dansk (maks 2 enkle sætninger, ingen svære ord som makrotal eller volatilitet)"
      }`

      const textResponse = await generateWithFallback(ai, prompt)
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      const pulseData = JSON.parse(cleanJson)

      return NextResponse.json({ success: true, pulse: pulseData })
    }

    // TILFØJ SPECIFIK AKTIE
    if (body && body.action === 'add' && body.symbol) {
      const symbol = body.symbol.toUpperCase().trim()
      const name = body.name ? body.name.trim() : symbol
      const timeframe = body.timeframe || 'LANGSIKTET'

      const prompt = `Analyser aktien ${name} (${symbol}) med fokus på en **${timeframe}** horisont for en nybegynder. 
      Skriv på helt almindeligt dansk uden svære finansord.
      VIGTIGT: Felterne current_price, stop_loss og take_profit SKAL KUN VÆRE RENE TAL (f.eks. 415.5) uden valuta.
      Svar KUN i gyldigt JSON-format med følgende felter:
      {
        "score": et tal mellem 0 og 100,
        "recommendation": "KØB", "HOLD" eller "SÆLG",
        "ai_reasoning": "Kort og ligetil begrundelse på dansk (maks 2 sætninger)",
        "beginner_explanation": "En superlet og tryg forklaring på dansk for en nybegynder",
        "current_price": et rent tal,
        "stop_loss": et rent tal,
        "take_profit": et rent tal
      }`

      const textResponse = await generateWithFallback(ai, prompt)
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      const analysis = JSON.parse(cleanJson)

      const { error: insertError } = await supabase.from('stocks').insert({
        symbol: symbol,
        name: name,
        timeframe: timeframe,
        score: Number(analysis.score) || 50,
        recommendation: analysis.recommendation || 'HOLD',
        ai_reasoning: analysis.ai_reasoning || '',
        beginner_explanation: analysis.beginner_explanation || '',
        current_price: parseNumeric(analysis.current_price),
        stop_loss: parseNumeric(analysis.stop_loss),
        take_profit: parseNumeric(analysis.take_profit),
      })

      if (insertError) throw new Error('Database fejl: ' + insertError.message)

      return NextResponse.json({ success: true, message: `Aktie ${symbol} tilføjet!` })
    }

    // AI OPdag FLERE ANBEFALINGER (TOP 3)
    if (body && body.action === 'discover') {
      const timeframe = body.timeframe || 'LANGSIKTET'
      const prompt = `Foreslå 3 spændende aktier lige nu til en ${timeframe} horisont for en nybegynder på helt almindeligt dansk. 
      VIGTIGT: current_price, stop_loss og take_profit SKAL VÆRE RENE TAL uden valuta.
      Svar KUN i et gyldigt JSON-array med op til 3 objekter i følgende format:
      [
        {
          "symbol": "TICKER",
          "name": "Virksomhedsnavn",
          "score": et tal mellem 75 og 98,
          "recommendation": "KØB",
          "ai_reasoning": "Kort og ligetil begrundelse på dansk",
          "beginner_explanation": "Hvorfor er denne god og tryg for en nybegynder?",
          "current_price": et rent tal,
          "stop_loss": et rent tal,
          "take_profit": et rent tal
        }
      ]`

      const textResponse = await generateWithFallback(ai, prompt)
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      const suggestions = JSON.parse(cleanJson)

      if (Array.isArray(suggestions)) {
        for (const suggestion of suggestions) {
          await supabase.from('stocks').insert({
            symbol: suggestion.symbol,
            name: suggestion.name,
            timeframe: timeframe,
            score: Number(suggestion.score) || 75,
            recommendation: suggestion.recommendation || 'KØB',
            ai_reasoning: suggestion.ai_reasoning || '',
            beginner_explanation: suggestion.beginner_explanation || '',
            current_price: parseNumeric(suggestion.current_price),
            stop_loss: parseNumeric(suggestion.stop_loss),
            take_profit: parseNumeric(suggestion.take_profit),
          })
        }
      }

      return NextResponse.json({ success: true, message: `Fandt og tilføjede flere anbefalinger!` })
    }

    // LYNOPDATÉR ALLE AKTIER
    const { data: stocks, error: fetchError } = await supabase.from('stocks').select('*')
    if (fetchError) throw fetchError

    if (!stocks || stocks.length === 0) {
      return NextResponse.json({ success: true, message: 'Ingen aktier at opdatere endnu.' })
    }

    const updatePromises = stocks.map(async (stock) => {
      const tf = stock.timeframe || 'LANGSIKTET'
      const prompt = `Analyser aktien ${stock.name} (${stock.symbol}) med fokus på en **${tf}** horisont for en nybegynder på let dansk. 
      VIGTIGT: current_price, stop_loss og take_profit SKAL VÆRE RENE TAL uden valuta.
      Svar KUN i gyldigt JSON-format med felterne: score, recommendation, ai_reasoning, beginner_explanation, current_price, stop_loss, take_profit.`

      try {
        const textResponse = await generateWithFallback(ai, prompt)
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
        const analysis = JSON.parse(cleanJson)

        await supabase
          .from('stocks')
          .update({
            score: Number(analysis.score) || stock.score,
            recommendation: analysis.recommendation || stock.recommendation,
            ai_reasoning: analysis.ai_reasoning || stock.ai_reasoning,
            beginner_explanation: analysis.beginner_explanation || stock.beginner_explanation,
            current_price: parseNumeric(analysis.current_price),
            stop_loss: parseNumeric(analysis.stop_loss),
            take_profit: parseNumeric(analysis.take_profit),
          })
          .eq('id', stock.id)
      } catch (err) {
        console.error(`Fejl ved analyse af ${stock.symbol}:`, err)
      }
    })

    await Promise.all(updatePromises)

    return NextResponse.json({ success: true, message: 'Alle aktier lynopdateret!' })
  } catch (error: any) {
    console.error('API Fejl:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}