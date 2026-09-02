import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { GoogleGenAI } from '@google/genai'

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY mangler i miljøvariabler' }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey })

    // 1. Hent alle aktier fra Supabase
    const { data: stocks, error: fetchError } = await supabase.from('stocks').select('*')
    if (fetchError) throw fetchError

    if (!stocks || stocks.length === 0) {
      return NextResponse.json({ message: 'Ingen aktier at analysere' })
    }

    // 2. Loop igennem aktierne og lad Gemini analysere dem
    for (const stock of stocks) {
      const prompt = `Analyser aktien ${stock.name} (${stock.symbol}). 
      Giv en skarp finansiel vurdering på dansk. 
      Svar KUN i gyldigt JSON-format med følgende felter:
      {
        "score": et tal mellem 0 og 100,
        "recommendation": "KØB", "HOLD" eller "SÆLG",
        "ai_reasoning": "Kort skarp begrundelse på dansk (maks 2 sætninger)",
        "current_price": et realistisk nuværende aktiepris-tal som tal (f.eks. 850.5)
      }`

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        })

        const textResponse = response.text || ''
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
        const analysis = JSON.parse(cleanJson)

        // 3. Opdater databasen med Geminis resultater
        await supabase
          .from('stocks')
          .update({
            score: analysis.score,
            recommendation: analysis.recommendation,
            ai_reasoning: analysis.ai_reasoning,
            current_price: analysis.current_price,
          })
          .eq('id', stock.id)
      } catch (err) {
        console.error(`Fejl ved analyse af ${stock.symbol}:`, err)
      }
    }

    return NextResponse.json({ success: true, message: 'Alle aktier er opdateret af Gemini AI!' })
  } catch (error: any) {
    console.error('API Fejl:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}