import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { GoogleGenAI } from '@google/genai'

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

    // TILFØJ SPECIFIK AKTIE
    if (body && body.action === 'add' && body.symbol) {
      const symbol = body.symbol.toUpperCase().trim()
      const name = body.name ? body.name.trim() : symbol
      const timeframe = body.timeframe || 'LANGSIKTET'

      const prompt = `Analyser aktien ${name} (${symbol}) med fokus på en **${timeframe}** horisont for en nybegynder. 
      Giv en skarp finansiel vurdering på dansk. Inkluder Stop-Loss, Take-Profit og en helt pædagogisk, letforståelig forklaring til en nybegynder om hvorfor denne aktie er interessant.
      Svar KUN i gyldigt JSON-format med følgende felter:
      {
        "score": et tal mellem 0 og 100,
        "recommendation": "KØB", "HOLD" eller "SÆLG",
        "ai_reasoning": "Kort finansiel begrundelse på dansk (maks 2 sætninger)",
        "beginner_explanation": "En superlet og tryg forklaring på dansk for en nybegynder",
        "current_price": et realistisk nuværende aktiepris-tal som tal (f.eks. 850.5),
        "stop_loss": et tal,
        "take_profit": et tal
      }`

      const textResponse = await generateWithFallback(ai, prompt)
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      const analysis = JSON.parse(cleanJson)

      const { error: insertError } = await supabase.from('stocks').insert({
        symbol: symbol,
        name: name,
        timeframe: timeframe,
        score: analysis.score,
        recommendation: analysis.recommendation,
        ai_reasoning: analysis.ai_reasoning,
        beginner_explanation: analysis.beginner_explanation,
        current_price: analysis.current_price,
        stop_loss: analysis.stop_loss,
        take_profit: analysis.take_profit,
      })

      if (insertError) {
        console.error('Supabase insert fejl:', insertError)
        return NextResponse.json({ error: 'Database fejl: ' + insertError.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: `Aktie ${symbol} tilføjet!` })
    }

    // AI DISCOVER NYHED / ANBEFALING
    if (body && body.action === 'discover') {
      const timeframe = body.timeframe || 'LANGSIKTET'
      const prompt = `Foreslå 1 aktie der er spændende lige nu til en ${timeframe} horisont for en nybegynder.
      Svar KUN i gyldigt JSON-format med felterne: symbol, name, score, recommendation, ai_reasoning, beginner_explanation, current_price, stop_loss, take_profit.`

      const textResponse = await generateWithFallback(ai, prompt)
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      const suggestion = JSON.parse(cleanJson)

      const { error: discoverError } = await supabase.from('stocks').insert({
        symbol: suggestion.symbol,
        name: suggestion.name,
        timeframe: timeframe,
        score: suggestion.score,
        recommendation: suggestion.recommendation,
        ai_reasoning: suggestion.ai_reasoning,
        beginner_explanation: suggestion.beginner_explanation,
        current_price: suggestion.current_price,
        stop_loss: suggestion.stop_loss,
        take_profit: suggestion.take_profit,
      })

      if (discoverError) {
        console.error('Supabase discover insert fejl:', discoverError)
        return NextResponse.json({ error: 'Database fejl ved oprettelse: ' + discoverError.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: `Fandt og tilføjede ${suggestion.name}!` })
    }

    // LYNOPDATÉR ALLE AKTIER
    const { data: stocks, error: fetchError } = await supabase.from('stocks').select('*')
    if (fetchError) throw fetchError

    if (!stocks || stocks.length === 0) {
      return NextResponse.json({ message: 'Ingen aktier at analysere' })
    }

    const updatePromises = stocks.map(async (stock) => {
      const tf = stock.timeframe || 'LANGSIKTET'
      const prompt = `Analyser aktien ${stock.name} (${stock.symbol}) med fokus på en **${tf}** horisont for en nybegynder. 
      Svar KUN i gyldigt JSON-format med felterne: score, recommendation, ai_reasoning, beginner_explanation, current_price, stop_loss, take_profit.`

      try {
        const textResponse = await generateWithFallback(ai, prompt)
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
        const analysis = JSON.parse(cleanJson)

        await supabase
          .from('stocks')
          .update({
            score: analysis.score,
            recommendation: analysis.recommendation,
            ai_reasoning: analysis.ai_reasoning,
            beginner_explanation: analysis.beginner_explanation,
            current_price: analysis.current_price,
            stop_loss: analysis.stop_loss,
            take_profit: analysis.take_profit,
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