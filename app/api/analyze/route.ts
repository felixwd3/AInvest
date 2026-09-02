import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { GoogleGenAI } from '@google/genai'

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

    // 1. HVIS BRUGEREN VIL HAVE AI AKTIE-IDÉER
    if (body && body.action === 'ideas') {
      const prompt = `Giv 3 aktuelle og spændende aktie-idéer til en investor (bland gerne kortsigtet momentum og langsigtet kvalitet).
      Svar KUN i gyldigt JSON-format som en liste (array) med præcis 3 objekter:
      [
        {
          "symbol": "Ticker (f.eks. AAPL eller NOVO-B)",
          "name": "Virksomhedens fulde navn",
          "timeframe": "LANGSIKTET" eller "KORTSIGTET",
          "score": et tal mellem 75 og 98,
          "recommendation": "KØB",
          "ai_reasoning": "Kort skarp begrundelse på dansk (maks 2 sætninger)",
          "current_price": et realistisk nuværende aktiepris-tal (f.eks. 850.5)
        }
      ]`

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      })

      const textResponse = response.text || ''
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      const ideas = JSON.parse(cleanJson)

      return NextResponse.json({ success: true, ideas })
    }

    // 2. HVIS BRUGEREN VIL TILFØJE EN NY AKTIE MANUELT
    if (body && body.action === 'add' && body.symbol) {
      const symbol = body.symbol.toUpperCase().trim()
      const name = body.name ? body.name.trim() : symbol
      const timeframe = body.timeframe || 'LANGSIKTET'

      const prompt = `Analyser aktien ${name} (${symbol}) med fokus på en **${timeframe}** investeringshorisont. 
      Giv en skarp finansiel vurdering på dansk. 
      Svar KUN i gyldigt JSON-format med følgende felter:
      {
        "score": et tal mellem 0 og 100,
        "recommendation": "KØB", "HOLD" eller "SÆLG",
        "ai_reasoning": "Kort skarp begrundelse på dansk tilpasset horisonten (maks 2 sætninger)",
        "current_price": et realistisk nuværende aktiepris-tal som tal (f.eks. 850.5)
      }`

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      })

      const textResponse = response.text || ''
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
      const analysis = JSON.parse(cleanJson)

      const { error: insertError } = await supabase.from('stocks').insert({
        symbol: symbol,
        name: name,
        timeframe: timeframe,
        score: analysis.score,
        recommendation: analysis.recommendation,
        ai_reasoning: analysis.ai_reasoning,
        current_price: analysis.current_price,
      })

      if (insertError) throw insertError

      return NextResponse.json({ success: true, message: `Aktie ${symbol} tilføjet med ${timeframe} horisont!` })
    }

    // 3. OPDATER ALLE EKSISTERENDE AKTIER
    const { data: stocks, error: fetchError } = await supabase.from('stocks').select('*')
    if (fetchError) throw fetchError

    if (!stocks || stocks.length === 0) {
      return NextResponse.json({ message: 'Ingen aktier at analysere' })
    }

    for (const stock of stocks) {
      const tf = stock.timeframe || 'LANGSIKTET'
      const prompt = `Analyser aktien ${stock.name} (${stock.symbol}) med fokus på en **${tf}** investeringshorisont. 
      Giv en skarp finansiel vurdering på dansk. 
      Svar KUN i gyldigt JSON-format med følgende felter:
      {
        "score": et tal mellem 0 og 100,
        "recommendation": "KØB", "HOLD" eller "SÆLG",
        "ai_reasoning": "Kort skarp begrundelse på dansk tilpasset horisonten (maks 2 sætninger)",
        "current_price": et realistisk nuværende aktiepris-tal som tal (f.eks. 850.5)
      }`

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
        })

        const textResponse = response.text || ''
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
        const analysis = JSON.parse(cleanJson)

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