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
  beginner_explanation?: string | null
  stop_loss?: number | null
  take_profit?: number | null
}

interface MarketPulse {
  status: 'ROLIGT' | 'USIKKERT' | 'UROLIGT'
  headline: string
  advice: string
}

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [budget, setBudget] = useState<number>(3000)
  const [analyzing, setAnalyzing] = useState(false)
  const [discovering, setDiscovering] = useState(false)

  const [newSymbol, setNewSymbol] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const [expandedCards, setExpandedCards] = useState<{ [key: string]: boolean }>({})
  const [activeTab, setActiveTab] = useState<'ALLE' | 'LANGSIKTET' | 'KORTSIGTET'>('KORTSIGTET')

  const [marketPulse, setMarketPulse] = useState<MarketPulse>({
    status: 'ROLIGT',
    headline: 'Tager temperaturen på markedet...',
    advice: "Vent et øjeblik mens AI'en tjekker stemningen."
  })

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

  const fetchMarketPulse = async () => {
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pulse' }),
      })
      const data = await res.json()
      if (data.success && data.pulse) {
        setMarketPulse(data.pulse)
      }
    } catch (err) {
      console.error('Kunne ikke hente markeds-puls', err)
    }
  }

  useEffect(() => {
    fetchStocks()
    fetchMarketPulse()
  }, [])

  const runAiAnalysis = async () => {
    try {
      setAnalyzing(true)
      await fetchMarketPulse()
      const res = await fetch('/api/analyze', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await fetchStocks()
      } else {
        alert('Fejl under analyse: ' + (data.error || 'Ukendt fejl'))
      }
    } catch (err) {
      console.error(err)
      alert('Der opstod en fejl.')
    } finally {
      setAnalyzing(false)
    }
  }

  const discoverNewStock = async () => {
    try {
      setDiscovering(true)
      const targetTimeframe = activeTab === 'ALLE' ? 'KORTSIGTET' : activeTab
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discover', timeframe: targetTimeframe }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchStocks()
      } else {
        alert('Fejl ved AI-screening: ' + (data.error || 'Ukendt fejl'))
      }
    } catch (err) {
      console.error(err)
      alert('Der opstod en fejl.')
    } finally {
      setDiscovering(false)
    }
  }

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSymbol) return

    const targetTimeframe = activeTab === 'ALLE' ? 'KORTSIGTET' : activeTab

    try {
      setAdding(true)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add', 
          symbol: newSymbol, 
          name: newName || newSymbol, 
          timeframe: targetTimeframe 
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

  // Pædagogisk råd om spredning baseret på budget
  const getPortfolioAdvice = (budg: number) => {
    if (budg < 2000) {
      return "💡 Med et budget under 2.000 kr. er det klogest at satse på **én enkelt aktie ad gangen**, da gebyrer ellers kan æde for meget af afkastet."
    } else if (budg <= 6000) {
      return "💡 Med dit budget på " + budg.toLocaleString('da-DK') + " kr. anbefaler vi at **dele beløbet i 2** (f.eks. 2 forskellige aktier), så du spreder din risiko pænt."
    } else {
      return "💡 Med et større budget kan du med fordel **fordele pengene på 3 forskellige aktier** fra vores Top 3-liste for at beskytte dig mod uforudsete svingninger."
    }
  }

  const pulseColor = 
    marketPulse.status === 'ROLIGT' ? 'border-emerald-500/50 from-emerald-950/50 to-cyan-950/50 text-emerald-400' :
    marketPulse.status === 'UROLIGT' ? 'border-rose-500/50 from-rose-950/50 to-amber-950/50 text-rose-400' :
    'border-amber-500/50 from-amber-950/50 to-yellow-950/50 text-amber-400'

  const pulseIcon = 
    marketPulse.status === 'ROLIGT' ? '🟢' :
    marketPulse.status === 'UROLIGT' ? '🔴' : '🟡'

  return (
    <main className="min-h-screen bg-[#070b14] text-white p-4 md:p-12 pb-28">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b border-gray-800/80 pb-6 gap-4">
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
              <p className="text-xs tracking-wider text-gray-400 uppercase font-mono mt-0.5">
                {activeTab === 'KORTSIGTET' ? '⚡ Sving & Daytrade Rådgiver' : activeTab === 'LANGSIKTET' ? '🛡️ Langsigtet Rådgiver' : 'Din Personlige AI Aktierådgiver'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={discoverNewStock}
              disabled={discovering}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold px-3 py-2.5 rounded-xl text-xs tracking-wide transition shadow-lg disabled:opacity-50"
            >
              {discovering ? 'AI scanner flere...' : '🔍 Få AI Anbefalinger (Top 3)'}
            </button>
            <button
              onClick={runAiAnalysis}
              disabled={analyzing}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-gray-950 font-bold px-3 py-2.5 rounded-xl text-xs tracking-wide transition shadow-lg disabled:opacity-50"
            >
              {analyzing ? 'Opdaterer...' : '✨ Opdater Kurser'}
            </button>
          </div>
        </header>

        {/* MARKEDETS PULS */}
        <section className={`bg-gradient-to-r border rounded-2xl p-5 mb-6 shadow-xl flex items-start gap-3.5 ${pulseColor}`}>
          <span className="text-2xl mt-0.5">{pulseIcon}</span>
          <div className="w-full">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-sm font-bold uppercase font-mono tracking-wide">
                Markedets Status: {marketPulse.status}
              </h3>
              <span className="text-[10px] bg-gray-950/60 px-2.5 py-0.5 rounded-full font-mono text-gray-300 border border-gray-800">
                Rådgiverens Dagsoverblik
              </span>
            </div>
            <p className="text-sm font-semibold text-white mt-1">
              {marketPulse.headline}
            </p>
            <p className="text-xs text-gray-300 mt-1 leading-relaxed">
              {marketPulse.advice}
            </p>
          </div>
        </section>

        {/* Positions-beregner & Smart Fordeler */}
        <section className="bg-[#0b1326] border border-gray-800/80 rounded-2xl p-6 mb-6 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-200">Positions- & Kapitalberegner</h2>
              <p className="text-sm text-gray-400">Indtast dit samlede beløb for at se, hvordan du bærer dig ad.</p>
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
          {/* Dynamisk råd om spredning */}
          <div className="p-3 bg-cyan-950/30 border border-cyan-900/40 rounded-xl text-xs text-cyan-200 leading-relaxed font-sans">
            {getPortfolioAdvice(budget)}
          </div>
        </section>

        {/* Tilføj ny aktie formular */}
        <section className="bg-[#0b1326] border border-gray-800/80 rounded-2xl p-6 mb-8 shadow-xl">
          <h2 className="text-lg font-semibold text-gray-200 mb-3">
            Tilføj manuelt til {activeTab === 'KORTSIGTET' ? 'Kortsigtet (Sving)' : activeTab === 'LANGSIKTET' ? 'Langsigtet' : 'overvågning'}
          </h2>
          <form onSubmit={handleAddStock} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Virksomhedsnavn (f.eks. Tesla)" 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-[#070b14] border border-gray-700 rounded-xl px-4 py-2 text-white flex-1 text-sm focus:outline-none focus:border-emerald-500"
            />
            <input 
              type="text" 
              placeholder="Ticker (f.eks. TSLA)" 
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              className="bg-[#070b14] border border-gray-700 rounded-xl px-4 py-2 text-white sm:w-40 text-sm font-mono uppercase focus:outline-none focus:border-emerald-500"
              required
            />
            <button 
              type="submit"
              disabled={adding}
              className={`font-medium px-5 py-2 rounded-xl text-sm transition disabled:opacity-50 ${
                activeTab === 'KORTSIGTET' 
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-gray-950 font-bold' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-bold'
              }`}
            >
              {adding ? 'Analyserer...' : '+ Tilføj Aktie'}
            </button>
          </form>
        </section>

        {/* Sektion med aktier */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-200 tracking-wide">
              {activeTab === 'ALLE' && 'Overvågede Aktier (Alle)'}
              {activeTab === 'LANGSIKTET' && '🛡️ Langsigtede Ankre'}
              {activeTab === 'KORTSIGTET' && '⚡ Korte Sving & Momentum'}
            </h2>
            <span className="text-xs font-mono text-gray-400">
              {filteredStocks.length} stk. fundet
            </span>
          </div>
          
          {loading ? (
            <div className="text-center py-12 text-gray-500 font-mono">Henter data...</div>
          ) : filteredStocks.length === 0 ? (
            <div className="bg-[#0b1326] border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
              <p>Ingen aktier i dette univers endnu. Klik på "Få AI Anbefalinger (Top 3)" ovenfor!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredStocks.map((stock, index) => {
                const price = stock.current_price || 0
                // Hvis brugeren har delt budgettet op i 2, viser vi f.eks. hvad halvdelen rækker til
                const splitFactor = budget > 5000 ? 3 : budget >= 2000 ? 2 : 1
                const recommendedBudgetForThis = Math.round(budget / splitFactor)
                const calculatedShares = price > 0 ? Math.floor(recommendedBudgetForThis / price) : 0
                const totalCost = calculatedShares * price

                const tf = stock.timeframe || 'LANGSIKTET'
                const isExpanded = expandedCards[stock.id] || false
                const reasoningText = stock.ai_reasoning || "Ingen analyse endnu."
                const beginnerText = stock.beginner_explanation || "Ingen begynderforklaring tilgængelig endnu."
                const isBuy = stock.recommendation && stock.recommendation.toUpperCase() === 'KØB'
                
                // Gør den øverste (første i listen med højest score) til dagens klogeste valg
                const isTopPick = index === 0 && stock.score >= 85

                return (
                  <div 
                    key={stock.id} 
                    className={`bg-[#0b1326] border rounded-2xl p-6 flex flex-col gap-4 transition shadow-lg relative group ${
                      isTopPick ? 'border-emerald-500/80 shadow-emerald-950/20 shadow-xl' : 'border-gray-800/80 hover:border-gray-700'
                    }`}
                  >
                    {/* DAGENS KLOGESTE VALG BADGE */}
                    {isTopPick && (
                      <div className="absolute -top-3 left-6 bg-gradient-to-r from-emerald-500 to-cyan-500 text-gray-950 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider font-mono shadow-md flex items-center gap-1">
                        👑 Dagens Klogeste Valg
                      </div>
                    )}

                    <button 
                      onClick={() => deleteStock(stock.id, stock.symbol)}
                      className="absolute top-4 right-4 text-gray-600 hover:text-rose-400 transition z-10"
                      title="Fjern fra overvågning"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pr-10 pt-1">
                      <div className="space-y-2 w-full">
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
                          
                          {isExpanded && (
                            <div className="mt-2.5 p-3 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-xs text-emerald-200/90 leading-relaxed font-sans">
                              <strong className="text-emerald-400 block mb-1">🎓 Sådan forstår du handlen:</strong>
                              {beginnerText}
                            </div>
                          )}

                          <button 
                            onClick={() => toggleExpand(stock.id)}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium mt-1 inline-flex items-center gap-1 focus:outline-none"
                          >
                            {isExpanded ? '▲ Vis mindre' : '▼ Vis mere om handel & strategi'}
                          </button>
                        </div>

                        {(stock.stop_loss || stock.take_profit) && (
                          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono">
                            <span className="text-rose-400 bg-rose-950/40 border border-rose-900/40 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                              🛑 Stop-Loss: <strong>{stock.stop_loss}</strong>
                            </span>
                            <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
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
                            isBuy ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm' :
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
                        {price > 0 && isBuy ? (
                          <span className="text-xs text-emerald-400/90 font-mono">
                            Anbefalet køb for denne: <strong className="text-white font-bold">{calculatedShares} stk.</strong> (ca. {totalCost.toLocaleString('da-DK')} DKK v/ kurs {price})
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 font-mono">
                            {price > 0 ? `Aktuel kurs: ${price} - Afvent bedre moment` : 'Ingen prisdata tilgængelig'}
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

      {/* FAST BUNDMENU (MOBILE TAB BAR) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0b1326]/95 backdrop-blur-md border-t border-gray-800 py-3 px-6 z-50 shadow-2xl">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <button 
            onClick={() => setActiveTab('ALLE')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'ALLE' ? 'text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span className="text-lg">🏠</span>
            <span className="text-[11px] tracking-wide">Alle</span>
          </button>

          <button 
            onClick={() => setActiveTab('LANGSIKTET')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'LANGSIKTET' ? 'text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span className="text-lg">🛡️</span>
            <span className="text-[11px] tracking-wide">Langsigtet</span>
          </button>

          <button 
            onClick={() => setActiveTab('KORTSIGTET')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'KORTSIGTET' ? 'text-cyan-400 font-bold' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span className="text-lg">⚡</span>
            <span className="text-[11px] tracking-wide">Kortsigtet (Sving)</span>
          </button>
        </div>
      </nav>
    </main>
  )
}