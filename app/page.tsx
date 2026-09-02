'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Stock {
  id: string
  symbol: string
  name: string
  timeframe?: string
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
  const [analyzing, setAnalyzing] = useState(false)

  // Manuel tilføjelse
  const [newSymbol, setNewSymbol] = useState('')
  const [newName, setNewName] = useState('')
  const [newTimeframe, setNewTimeframe] = useState('LANGSIKTET')
  const [adding, setAdding] = useState(false)

  // AI Idéer state
  const [ideas, setIdeas] = useState<any[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)

  // Filter fane
  const [activeTab, setActiveTab] = useState<'ALLE' | 'LANGSIKTET' | 'KORTSIGTET'>('ALLE')

  const fetchStocks = async () => {
    setLoading(true)
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

  useEffect(() => {
    fetchStocks()
  }, [])

  const runAiAnalysis = async () => {
    try {
      setAnalyzing(true)
      const res = await fetch('/api/analyze', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await fetchStocks()
      } else {
        alert('Fejl under analyse: ' + (data.error || 'Ukendt fejl'))
      }
    } catch (err) {
      console.error(err)
      alert('Der opstod en fejl under kommunikation med serveren.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSymbol) return

    try {
      setAdding(true)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add', 
          symbol: newSymbol, 
          name: newName || newSymbol, 
          timeframe: newTimeframe 
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewSymbol('')
        setNewName('')
        await fetchStocks()
      } else {
        alert('Fejl ved tilføjelse: ' + (data.error || 'Ukendt fejl'))
      }
    } catch (err) {
      console.error(err)
      alert('Der opstod en fejl.')
    } finally {
      setAdding(false)
    }
  }

  const fetchAiIdeas = async () => {
    try {
      setLoadingIdeas(true)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ideas' }),
      })
      const data = await res.json()
      if (data.success) {
        setIdeas(data.ideas || [])
      } else {
        alert('Kunne ikke hente idéer.')
      }
    } catch (err) {
      console.error(err)
      alert('Der opstod en fejl.')
    } finally {
      setLoadingIdeas(false)
    }
  }

  const addIdeaToPortfolio = async (idea: any) => {
    try {
      setAdding(true)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add', 
          symbol: idea.symbol, 
          name: idea.name, 
          timeframe: idea.timeframe || 'LANGSIKTET'
        }),
      })
      const data = await res.json()
      if (data.success) {
        // Fjern den fra idé-listen og opdater porteføljen
        setIdeas(ideas.filter(item => item.symbol !== idea.symbol))
        await fetchStocks()
      } else {
        alert('Fejl ved tilføjelse af idé.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAdding(false)
    }
  }

  const filteredStocks = stocks.filter(stock => {
    if (activeTab === 'ALLE') return true
    const tf = stock.timeframe || 'LANGSIKTET'
    return tf === activeTab
  })

  return (
    <main className="min-h-screen bg-[#070b14] text-white p-4 md:p-12">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-8 border-b border-gray-800/80 pb-6 gap-4">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <img 
              src="/logo.png" 
              alt="AInvest Logo" 
              className="w-20 h-20 md:w-24 md:h-24 object-contain" 
            />
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                AINVEST
              </h1>
              <p className="text-xs tracking-wider text-gray-400 uppercase font-mono mt-0.5">AI-Driven Stock Analysis</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runAiAnalysis}
              disabled={analyzing}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-gray-950 font-bold px-4 py-2.5 rounded-xl text-xs tracking-wide transition shadow-lg disabled:opacity-50"
            >
              {analyzing ? 'Gemini analyserer...' : '✨ Kør AI Analyse'}
            </button>
            <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 text-xs px-3 py-2 rounded-full font-medium shadow-inner hidden sm:inline">
              ● Live DB
            </span>
          </div>
        </header>

        {/* AI Idéer / Inspiration Sektion */}
        <section className="bg-gradient-to-br from-[#0b1326] to-[#06101e] border border-cyan-900/50 rounded-2xl p-6 mb-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-cyan-300">💡 AI Inspiration & Idéer</h2>
              <p className="text-sm text-gray-400">Lad Gemini finde spændende nye aktie-anbefalinger til dig.</p>
            </div>
            <button
              onClick={fetchAiIdeas}
              disabled={loadingIdeas}
              className="bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold px-4 py-2 rounded-xl text-xs transition shadow-md disabled:opacity-50 w-full sm:w-auto"
            >
              {loadingIdeas ? 'Foreslår aktier...' : '🤖 Få AI Aktie-idéer'}
            </button>
          </div>

          {ideas.length > 0 && (
            <div className="grid gap-3 mt-4 pt-4 border-t border-gray-800/80">
              {ideas.map((idea, index) => (
                <div key={index} className="bg-[#070b14]/80 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-100">{idea.name}</span>
                      <span className="text-xs bg-cyan-950 text-cyan-300 border border-cyan-900/50 px-2 py-0.5 rounded font-mono">{idea.symbol}</span>
                      <span className="text-[10px] bg-gray-900 text-gray-400 px-2 py-0.5 rounded font-mono uppercase">{idea.timeframe}</span>
                    </div>
                    <p className="text-xs text-gray-400 max-w-md">{idea.ai_reasoning}</p>
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 uppercase">Score</div>
                      <div className="text-sm font-bold text-emerald-400 font-mono">{idea.score}/100</div>
                    </div>
                    <button
                      onClick={() => addIdeaToPortfolio(idea)}
                      disabled={adding}
                      className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow"
                    >
                      + Tilføj
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Manuel Tilføj Formular */}
        <section className="bg-[#0b1326] border border-gray-800/80 rounded-2xl p-6 mb-6 shadow-xl">
          <h2 className="text-lg font-semibold text-gray-200 mb-3">Tilføj specifik aktie</h2>
          <form onSubmit={handleAddStock} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                placeholder="Virksomhedsnavn (f.eks. Apple)" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-[#070b14] border border-gray-700 rounded-xl px-4 py-2 text-white flex-1 text-sm focus:outline-none focus:border-emerald-500"
              />
              <input 
                type="text" 
                placeholder="Ticker (f.eks. AAPL)" 
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="bg-[#070b14] border border-gray-700 rounded-xl px-4 py-2 text-white sm:w-40 text-sm font-mono uppercase focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-gray-400 uppercase font-mono">Horisont:</span>
                <button
                  type="button"
                  onClick={() => setNewTimeframe('LANGSIKTET')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    newTimeframe === 'LANGSIKTET' 
                      ? 'bg-emerald-500 text-gray-950 shadow-md' 
                      : 'bg-gray-900 text-gray-400 border border-gray-800'
                  }`}
                >
                  Langsigtet
                </button>
                <button
                  type="button"
                  onClick={() => setNewTimeframe('KORTSIGTET')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    newTimeframe === 'KORTSIGTET' 
                      ? 'bg-cyan-500 text-gray-950 shadow-md' 
                      : 'bg-gray-900 text-gray-400 border border-gray-800'
                  }`}
                >
                  Kortsigtet (Sving)
                </button>
              </div>

              <button 
                type="submit"
                disabled={adding}
                className="bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-emerald-800/60 font-medium px-5 py-2 rounded-xl text-sm transition disabled:opacity-50 w-full sm:w-auto"
              >
                {adding ? 'Analyserer...' : '+ Tilføj Aktie'}
              </button>
            </div>
          </form>
        </section>

        {/* Positions-beregner */}
        <section className="bg-[#0b1326] border border-gray-800/80 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-200">Positions-beregner</h2>
              <p className="text-sm text-gray-400">Indtast dit samlede beløb for eksperiment-handlen.</p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
              <span className="text-sm text-gray-400">Budget (DKK):</span>
              <input 
                type="number" 
                value={budget} 
                onChange={(e) => setBudget(Number(e.target.value))}
                className="bg-[#070b14] border border-gray-700 rounded-xl px-4 py-2 text-white w-36 font-mono text-right focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>
          </div>
        </section>

        {/* Sektion med aktier & Faner */}
        <section>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-semibold text-gray-200 tracking-wide">Overvågede Aktier & Signaler</h2>
            
            {/* Filter faner */}
            <div className="flex items-center bg-[#0b1326] border border-gray-800/80 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('ALLE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === 'ALLE' ? 'bg-gray-800 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                Alle
              </button>
              <button 
                onClick={() => setActiveTab('LANGSIKTET')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === 'LANGSIKTET' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50 shadow' : 'text-gray-400 hover:text-white'}`}
              >
                Langsigtet
              </button>
              <button 
                onClick={() => setActiveTab('KORTSIGTET')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === 'KORTSIGTET' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/50 shadow' : 'text-gray-400 hover:text-white'}`}
              >
                Kortsigtet
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-12 text-gray-500 font-mono">Henter data...</div>
          ) : filteredStocks.length === 0 ? (
            <div className="bg-[#0b1326] border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
              <p>Ingen aktier fundet under denne visning.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredStocks.map((stock) => {
                const price = stock.current_price || 0
                const calculatedShares = price > 0 ? Math.floor(budget / price) : 0
                const totalCost = calculatedShares * price
                const tf = stock.timeframe || 'LANGSIKTET'

                return (
                  <div 
                    key={stock.id} 
                    className="bg-[#0b1326] border border-gray-800/80 rounded-2xl p-6 flex flex-col gap-4 hover:border-gray-700 transition shadow-lg"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold text-gray-100">{stock.name}</h3>
                          <span className="text-xs bg-gray-900 text-cyan-300 border border-cyan-900/40 px-2.5 py-0.5 rounded-md font-mono">{stock.symbol}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${
                            tf === 'KORTSIGTET' ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/50' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                          }`}>
                            {tf}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 max-w-xl">{stock.ai_reasoning || "Ingen analyse endnu."}</p>
                      </div>

                      <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-gray-800/80">
                        <div className="text-right">
                          <div className="text-xs uppercase tracking-wider text-gray-400">Score</div>
                          <div className="text-xl font-extrabold text-emerald-400 font-mono">{stock.score}/100</div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs uppercase tracking-wider text-gray-400">Signal</div>
                          <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold font-mono tracking-wider ${
                            stock.recommendation === 'KØB' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm' :
                            stock.recommendation === 'SÆLG' ? 'bg-rose-950 text-rose-300 border border-rose-700/60 shadow-sm' :
                            'bg-amber-950 text-amber-300 border border-amber-700/60 shadow-sm'
                          }`}>
                            {stock.recommendation || 'VENT'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-3 border-t border-gray-800/50 gap-3">
                      <div>
                        {price > 0 && stock.recommendation === 'KØB' ? (
                          <span className="text-xs text-emerald-400/90 font-mono">
                            Anbefalet køb: <strong className="text-white font-bold">{calculatedShares} stk.</strong> (ca. {totalCost.toLocaleString('da-DK')} DKK)
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 font-mono">
                            {price > 0 ? `Aktuel pris: ${price} - Ingen købsanbefaling` : 'Ingen prisdata tilgængelig'}
                          </span>
                        )}
                      </div>

                      <a 
                        href={getSaxoLink()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs bg-gray-900 hover:bg-gray-800 text-gray-200 px-3.5 py-2 rounded-xl font-medium transition border border-gray-700/80 shadow-sm"
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