'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Stock {
  id: string
  symbol: string
  name: string
  current_price: number | null
  score: number
  recommendation: string
  ai_reasoning: string | null
}

const getSaxoLink = () => {
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return isMobile ? 'https://www.home.saxo/en-dk/accounts/saxoinvestor' : 'https://www.home.saxo/accounts/saxoinvestor';
};

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [budget, setBudget] = useState<number>(3000)

  useEffect(() => {
    async function fetchStocks() {
      const { data, error } = await supabase
        .from('stocks')
        .select('*')
        .order('score', { ascending: false })

      if (error) {
        console.error('Fejl ved hentning af aktier:', error)
      } else {
        setStocks(data || [])
      }
      setLoading(false)
    }

    fetchStocks()
  }, [])

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-emerald-400">AInvest</h1>
            <p className="text-sm text-gray-400">Din personlige investeringsassistent og beslutningsstøtte</p>
          </div>
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs px-3 py-1 rounded-full font-medium">
            Live Database Connected
          </span>
        </header>

        {/* Positions-beregner */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-200">Positions-beregner</h2>
              <p className="text-sm text-gray-400">Indtast dit samlede beløb for eksperiment-handlen.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Budget (DKK):</span>
              <input 
                type="number" 
                value={budget} 
                onChange={(e) => setBudget(Number(e.target.value))}
                className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white w-32 font-mono text-right focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </section>

        {/* Sektion med aktier */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-200">Overvågede Aktier & Signaler</h2>
          
          {loading ? (
            <div className="text-center py-12 text-gray-500">Henter data fra Supabase...</div>
          ) : stocks.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400">
              <p>Ingen aktier fundet i databasen endnu.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {stocks.map((stock) => {
                const price = stock.current_price || 0
                const calculatedShares = price > 0 ? Math.floor(budget / price) : 0
                const totalCost = calculatedShares * price

                return (
                  <div 
                    key={stock.id} 
                    className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4 hover:border-gray-700 transition"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold">{stock.name}</h3>
                          <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-mono">{stock.symbol}</span>
                        </div>
                        <p className="text-sm text-gray-400 max-w-xl">{stock.ai_reasoning || "Ingen analyse tilgængelig endnu."}</p>
                      </div>

                      <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-gray-800">
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Score</div>
                          <div className="text-xl font-extrabold text-emerald-400">{stock.score}/100</div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-gray-400">Signal</div>
                          <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${
                            stock.recommendation === 'KØB' ? 'bg-emerald-900 text-emerald-200 border border-emerald-700' :
                            stock.recommendation === 'SÆLG' ? 'bg-rose-900 text-rose-200 border border-rose-700' :
                            'bg-amber-900 text-amber-200 border border-amber-700'
                          }`}>
                            {stock.recommendation}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-3 border-t border-gray-800/60 gap-3">
                      <div>
                        {price > 0 && stock.recommendation === 'KØB' ? (
                          <span className="text-xs text-emerald-400 font-mono">
                            Anbefalet køb: <strong className="text-white">{calculatedShares} stk.</strong> (ca. {totalCost.toLocaleString('da-DK')} DKK)
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 font-mono">Ingen aktiv købsanbefaling på nuværende tidspunkt</span>
                        )}
                      </div>

                      <a 
                        href={getSaxoLink()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg font-medium transition border border-gray-700"
                      >
                        Åbn i SaxoInvestor ↗
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}