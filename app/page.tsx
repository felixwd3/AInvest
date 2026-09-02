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
  stop_loss?: number | null
  take_profit?: number | null
}

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [budget, setBudget] = useState<number>(3000)
  const [analyzing, setAnalyzing] = useState(false)

  const [newSymbol, setNewSymbol] = useState('')
  const [newName, setNewName] = useState('')
  const [newTimeframe, setNewTimeframe] = useState('LANGSIKTET')
  const [adding, setAdding] = useState(false)

  const [expandedCards, setExpandedCards] = useState<{ [key: string]: boolean }>({})
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

  const deleteStock = async (id: string, symbol: string) => {
    const confirmDelete = window.confirm(`Er du sikker på, at du vil fjerne ${symbol} fra overvågningen?`)
    if (!confirmDelete) return

    const { error } = await supabase.from('stocks').delete().eq('id', id)
    
    if (error) {
      alert('Fejl ved sletning: ' + error.message)
    } else {
      setStocks(stocks.filter(stock => stock.id !== id))
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleCopyTicker = (symbol: string, name: string) => {
    navigator.clipboard.writeText(symbol).then(() => {
      alert(`📋 Kopiér lykkedes!\n\nTicker "${symbol}" (${name}) er nu kopieret til dit udklipsholder.\n\nÅbn blot din Saxo-app og indsæt den i søgefeltet.`);
    }).catch(() => {
      alert(`Kunne ikke kopiere automatisk. Symbol er: ${symbol}`);
    });
  }

  const filteredStocks = stocks.filter(stock => {
    if (activeTab === 'ALLE') return true
    const tf = stock.timeframe || 'LANGSIKTET'
    return tf === activeTab
  })

  return (
    <main className="min-h-screen bg-[#070b14] text-white p-4 md:p-12">
      <div className="max-w-4xl mx-auto">
        
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

        <section className="bg-[#0b1326] border border-gray-800/80 rounded-2xl p-6 mb-6 shadow-xl">
          <h2 className="text-lg font-semibold text-gray-200 mb-3">Tilføj ny aktie med AI-analyse</h2>
          <form onSubmit={handleAddStock} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                placeholder="Virksomhedsnavn (f.eks. Novo Nordisk)" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-[#070b14] border border-gray-700 rounded-xl px-4 py-2 text-white flex-1 text-sm focus:outline-none focus:border-emerald-500"
              />
              <input 
                type="text" 
                placeholder="Ticker (f.eks. NOVO-B)" 
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

        <section>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-semibold text-gray-200 tracking-wide">Overvågede Aktier & Signaler</h2>
            
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
                const isExpanded = expandedCards[stock.id] || false
                const reasoningText = stock.ai_reasoning || "Ingen analyse endnu."

                return (
                  <div 
                    key={stock.id} 
                    className="bg-[#0b1326] border border-gray-800/80 rounded-2xl p-6 flex flex-col gap-4 hover:border-gray-700 transition shadow-lg relative group"
                  >
                    <button 
                      onClick={() => deleteStock(stock.id, stock.symbol)}
                      className="absolute top-4 right-4 text-gray-600 hover:text-rose-400 transition z-10"
                      title="Fjern fra overvågning"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pr-10">
                      <div className="space-y-1.5 w-full">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold text-gray-100">{stock.name}</h3>
                          <span className="text-xs bg-gray-900 text-cyan-300 border border-cyan-900/40 px-2.5 py-0.5 rounded-md font-mono">{stock.symbol}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${
                            tf === 'KORTSIGTET' ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/50' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                          }`}>
                            {tf}
                          </span>
                        </div>

                        <div>
                          <p className={`text-sm text-gray-400 max-w-xl transition-all ${!isExpanded ? 'line-clamp-1' : ''}`}>
                            {reasoningText}
                          </p>
                          {reasoningText.length > 60 && (
                            <button 
                              onClick={() => toggleExpand(stock.id)}
                              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium mt-1 inline-flex items-center gap-1 focus:outline-none"
                            >
                              {isExpanded ? '▲ Vis mindre' : '▼ Vis mere om AI-analyse'}
                            </button>
                          )}
                        </div>

                        {/* RISIKOSTYRING / EXIT NIVEAUER */}
                        {(stock.stop_loss || stock.take_profit) && (
                          <div className="flex items-center gap-4 pt-2 text-xs font-mono">
                            <span className="text-rose-400 bg-rose-950/40 border border-rose-900/40 px-2.5 py-1 rounded-lg">
                              🛑 Stop-Loss: <strong>{stock.stop_loss}</strong>
                            </span>
                            <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-1 rounded-lg">
                              🎯 Take-Profit: <strong>{stock.take_profit}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-gray-800/80 shrink-0">
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

                      <button 
                        onClick={() => handleCopyTicker(stock.symbol, stock.name)}
                        className="inline-flex items-center gap-1.5 text-xs bg-gray-900 hover:bg-gray-800 text-gray-200 px-3.5 py-2 rounded-xl font-medium transition border border-gray-700/80 shadow-sm cursor-pointer"
                      >
                        📋 Kopiér Ticker til Saxo
                      </button>
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