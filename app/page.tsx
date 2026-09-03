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

interface PortfolioItem {
  id: string
  symbol: string
  name: string
  shares: number
  purchase_price: number
  current_price: number | null
  stop_loss: number | null
  take_profit: number | null
}

interface MarketPulse {
  status: 'ROLIGT' | 'USIKKERT' | 'UROLIGT'
  headline: string
  advice: string
}

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [budget, setBudget] = useState<number>(3000)
  const [analyzing, setAnalyzing] = useState(false)
  const [discovering, setDiscovering] = useState(false)

  const [newSymbol, setNewSymbol] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  // Saxo lyn-import state
  const [saxoText, setSaxoText] = useState('')
  const [importing, setImporting] = useState(false)

  // Push notifikationer state
  const [pushEnabled, setPushEnabled] = useState(false)

  const [expandedCards, setExpandedCards] = useState<{ [key: string]: boolean }>({})
  const [activeTab, setActiveTab] = useState<'KORTSIGTET' | 'LANGSIKTET' | 'PORTEFØLJE'>('KORTSIGTET')

  const [marketPulse, setMarketPulse] = useState<MarketPulse>({
    status: 'ROLIGT',
    headline: 'Tager temperaturen på markedet...',
    advice: "Vent et øjeblik mens AI'en tjekker stemningen."
  })

  const fetchData = async () => {
    setLoading(true)
    const { data: stockData } = await supabase.from('stocks').select('*').order('score', { ascending: false })
    const { data: portData } = await supabase.from('portfolio').select('*').order('created_at', { ascending: false })

    setStocks(stockData || [])
    setPortfolio(portData || [])
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
    fetchData()
    fetchMarketPulse()

    if ('Notification' in window && Notification.permission === 'granted') {
      setPushEnabled(true)
    }
  }, [])

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('Din enhed understøtter desværre ikke notifikationer.')
      return
    }

    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setPushEnabled(true)
      new Notification('AINVEST Notifikationer', {
        body: 'Du vil nu modtage vigtige opdateringer og stop-loss advarsler her!',
        icon: '/logo.png'
      })
      
      try {
        const registration = await navigator.serviceWorker?.ready
        if (registration && 'pushManager' in registration) {
          const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYPE5NjhFk'
          }).catch(() => null)

          if (sub) {
            await fetch('/api/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sub)
            })
          }
        }
      } catch (e) {
        console.log('Lokal tilladelse givet')
      }
    } else {
      alert('Tilladelse til notifikationer blev afvist.')
    }
  }

  // Udløs test-notifikation med det samme
  const sendTestNotification = () => {
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification('🧪 Test fra AINVEST', {
          body: 'Perfekt! Notifikationer virker som de skal på din telefon.',
          icon: '/logo.png'
        })
      }).catch(() => {
        // Fallback hvis service worker ikke er klar
        new Notification('🧪 Test fra AINVEST', {
          body: 'Perfekt! Notifikationer virker som de skal på din telefon.',
          icon: '/logo.png'
        })
      })
    } else {
      alert('Du skal først aktivere notifikationer ved at trykke på knappen ovenfor.')
    }
  }

  const runAiAnalysis = async () => {
    try {
      setAnalyzing(true)
      await fetchMarketPulse()
      const res = await fetch('/api/analyze', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await fetchData()
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
      const targetTimeframe = activeTab === 'PORTEFØLJE' ? 'KORTSIGTET' : activeTab
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discover', timeframe: targetTimeframe }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchData()
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

    try {
      setAdding(true)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add', 
          symbol: newSymbol, 
          name: newName || newSymbol, 
          timeframe: activeTab === 'LANGSIKTET' ? 'LANGSIKTET' : 'KORTSIGTET'
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewSymbol('')
        setNewName('')
        await fetchData()
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

  const handleSaxoImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!saxoText.trim()) return

    try {
      setImporting(true)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_saxo', text: saxoText }),
      })
      const data = await res.json()
      if (data.success) {
        setSaxoText('')
        await fetchData()
        alert('✅ Handlen blev tilføjet til din portefølje!')
      } else {
        alert('Kunne ikke tyde teksten: ' + (data.error || 'Ukendt fejl'))
      }
    } catch (err) {
      console.error(err)
      alert('Der opstod en fejl ved import.')
    } finally {
      setImporting(false)
    }
  }

  const deleteStock = async (id: string, symbol: string) => {
    if (!window.confirm(`Fjern ${symbol} fra overvågning?`)) return
    await supabase.from('stocks').delete().eq('id', id)
    setStocks(stocks.filter(s => s.id !== id))
  }

  const deletePortfolioItem = async (id: string, symbol: string) => {
    if (!window.confirm(`Slet ${symbol} fra din portefølje?`)) return
    await supabase.from('portfolio').delete().eq('id', id)
    setPortfolio(portfolio.filter(p => p.id !== id))
  }

  const handleCopyTicker = (symbol: string, name: string) => {
    navigator.clipboard.writeText(symbol).then(() => {
      alert(`📋 Kopiér lykkedes!\n\nTicker "${symbol}" (${name}) er kopieret til udklipsholder.`);
    });
  }

  const filteredStocks = stocks.filter(stock => {
    const tf = stock.timeframe || 'LANGSIKTET'
    return tf === activeTab
  })

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
                {activeTab === 'PORTEFØLJE' ? '💼 Min Aktive Portefølje' : activeTab === 'KORTSIGTET' ? '⚡ Sving & Daytrade Rådgiver' : '🛡️ Langsigtet Rådgiver'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            {activeTab !== 'PORTEFØLJE' && (
              <button
                onClick={discoverNewStock}
                disabled={discovering}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold px-3 py-2.5 rounded-xl text-xs tracking-wide transition shadow-lg disabled:opacity-50"
              >
                {discovering ? 'AI scanner...' : '🔍 Få AI Anbefalinger (Top 3)'}
              </button>
            )}
            <button
              onClick={runAiAnalysis}
              disabled={analyzing}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-gray-950 font-bold px-3 py-2.5 rounded-xl text-xs tracking-wide transition shadow-lg disabled:opacity-50"
            >
              {analyzing ? 'Opdaterer...' : '✨ Opdater Kurser'}
            </button>
          </div>
        </header>

        {/* MARKEDETS PULS OG NOTIFIKATIONS KNAPPER */}
        <section className={`bg-gradient-to-r border rounded-2xl p-5 mb-6 shadow-xl flex flex-col gap-4 ${pulseColor}`}>
          <div className="flex items-start gap-3.5">
            <span className="text-2xl mt-0.5">{pulseIcon}</span>
            <div className="w-full">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-sm font-bold uppercase font-mono tracking-wide">
                  Markedets Status: {marketPulse.status}
                </h3>
                <span className="text-[10px] bg-gray-950/60 px-2.5 py-0.5 rounded-full font-mono text-gray-300 border border-gray-800">
                  Dagsoverblik
                </span>
              </div>
              <p className="text-sm font-semibold text-white mt-1">
                {marketPulse.headline}
              </p>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                {marketPulse.advice}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-800/60 flex justify-between items-center flex-wrap gap-3">
            <span className="text-xs text-gray-300">
              {pushEnabled ? '🔔 Notifikationer er aktive på denne enhed.' : '🔕 Aktivér notifikationer for at modtage opdateringer.'}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {!pushEnabled ? (
                <button
                  onClick={requestPushPermission}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-emerald-500 text-gray-950 hover:opacity-90 shadow-sm"
                >
                  🔔 Slå Til
                </button>
              ) : (
                <button
                  onClick={sendTestNotification}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
                >
                  🧪 Test Notifikation
                </button>
              )}
            </div>
          </div>
        </section>

        {/* PORTEFØLJE TAB VISNING */}
        {activeTab === 'PORTEFØLJE' ? (
          <div>
            {/* Saxo Lyn-import boks */}
            <section className="bg-[#0b1326] border border-cyan-800/60 rounded-2xl p-6 mb-6 shadow-xl">
              <h2 className="text-lg font-semibold text-cyan-300 mb-1">📋 Saxo Lyn-Import</h2>
              <p className="text-xs text-gray-400 mb-3">Kopiér blot din ordretekst fra Saxo og indsæt herunder:</p>
              <form onSubmit={handleSaxoImport} className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="F.eks. Købt 10 stk. AAPL til kurs 180" 
                  value={saxoText}
                  onChange={(e) => setSaxoText(e.target.value)}
                  className="bg-[#070b14] border border-gray-700 rounded-xl px-4 py-2 text-white flex-1 text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
                <button 
                  type="submit"
                  disabled={importing}
                  className="bg-cyan-600 hover:bg-cyan-500 text-gray-950 font-bold px-5 py-2 rounded-xl text-sm transition disabled:opacity-50"
                >
                  {importing ? 'Tyder...' : '⚡ Tilføj'}
                </button>
              </form>
            </section>

            {/* Oversigt over egne aktier */}
            <section>
              <h2 className="text-xl font-semibold text-gray-200 mb-4 tracking-wide">Dine Aktive Handler</h2>
              {portfolio.length === 0 ? (
                <div className="bg-[#0b1326] border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
                  <p>Du har ikke tilføjet nogen aktier til din portefølje endnu.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {portfolio.map((item) => {
                    const curPrice = item.current_price || item.purchase_price
                    const investedValue = item.shares * item.purchase_price
                    const currentValue = item.shares * curPrice
                    const gainLoss = currentValue - investedValue
                    const gainLossPct = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0
                    const isProfit = gainLoss >= 0

                    return (
                      <div key={item.id} className="bg-[#0b1326] border border-gray-800/80 rounded-2xl p-6 shadow-lg relative group">
                        <button 
                          onClick={() => deletePortfolioItem(item.id, item.symbol)}
                          className="absolute top-4 right-4 text-gray-600 hover:text-rose-400 transition"
                        >
                          ✕
                        </button>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pr-6">
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-bold text-gray-100">{item.name}</h3>
                              <span className="text-xs bg-gray-900 text-cyan-300 border border-cyan-900/40 px-2.5 py-0.5 rounded-md font-mono">{item.symbol}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              Antal: <strong className="text-white">{item.shares} stk.</strong> | Købskurs: <strong className="text-white">{item.purchase_price}</strong> | Aktuel: <strong className="text-white">{curPrice}</strong>
                            </p>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-gray-400 uppercase font-mono">Gevinst / Tab</div>
                            <div className={`text-lg font-extrabold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isProfit ? '+' : ''}{gainLoss.toFixed(2)} DKK ({isProfit ? '+' : ''}{gainLossPct.toFixed(1)}%)
                            </div>
                          </div>
                        </div>

                        {item.stop_loss && curPrice <= item.stop_loss && (
                          <div className="mt-3 p-3 bg-rose-950/50 border border-rose-900 rounded-xl text-xs text-rose-200 font-bold flex items-center gap-2">
                            🚨 ADVARSEL: Dit Stop-Loss ({item.stop_loss}) er nået! Overvej at sælge nu.
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div>
            {/* Positions-beregner */}
            <section className="bg-[#0b1326] border border-gray-800/80 rounded-2xl p-6 mb-6 shadow-xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-200">Positions- & Kapitalberegner</h2>
                  <p className="text-sm text-gray-400">Indtast dit samlede beløb.</p>
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

            {/* Tilføj ny aktie manuelt */}
            <section className="bg-[#0b1326] border border-gray-800/80 rounded-2xl p-6 mb-8 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-200 mb-3">
                Tilføj manuelt til {activeTab === 'KORTSIGTET' ? 'Kortsigtet (Sving)' : 'Langsigtet'}
              </h2>
              <form onSubmit={handleAddStock} className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="Virksomhedsnavn" 
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
                  className="bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-bold px-5 py-2 rounded-xl text-sm transition disabled:opacity-50"
                >
                  {adding ? 'Analyserer...' : '+ Tilføj'}
                </button>
              </form>
            </section>

            {/* Sektion med aktier */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-200 tracking-wide">
                  {activeTab === 'KORTSIGTET' ? '⚡ Korte Sving & Momentum' : '🛡️ Langsigtede Ankre'}
                </h2>
                <span className="text-xs font-mono text-gray-400">{filteredStocks.length} stk. fundet</span>
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
                    const calculatedShares = price > 0 ? Math.floor(budget / 2 / price) : 0
                    const totalCost = calculatedShares * price
                    const isTopPick = index === 0 && stock.score >= 85
                    const isBuy = stock.recommendation && stock.recommendation.toUpperCase() === 'KØB'

                    return (
                      <div 
                        key={stock.id} 
                        className={`bg-[#0b1326] border rounded-2xl p-6 flex flex-col gap-4 transition shadow-lg relative group ${
                          isTopPick ? 'border-emerald-500/80 shadow-xl' : 'border-gray-800/80 hover:border-gray-700'
                        }`}
                      >
                        {isTopPick && (
                          <div className="absolute -top-3 left-6 bg-gradient-to-r from-emerald-500 to-cyan-500 text-gray-950 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider font-mono shadow-md flex items-center gap-1">
                            👑 Dagens Klogeste Valg
                          </div>
                        )}

                        <button 
                          onClick={() => deleteStock(stock.id, stock.symbol)}
                          className="absolute top-4 right-4 text-gray-600 hover:text-rose-400 transition z-10"
                        >
                          ✕
                        </button>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pr-10 pt-1">
                          <div className="space-y-2 w-full">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="text-lg font-bold text-gray-100">{stock.name}</h3>
                              <span className="text-xs bg-gray-900 text-cyan-300 border border-cyan-900/40 px-2.5 py-0.5 rounded-md font-mono">{stock.symbol}</span>
                            </div>

                            <p className="text-sm text-gray-400 max-w-xl">{stock.ai_reasoning}</p>

                            {stock.stop_loss && (
                              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono">
                                <span className="text-rose-400 bg-rose-950/40 border border-rose-900/40 px-2.5 py-1 rounded-lg">
                                  🛑 Stop-Loss: <strong>{stock.stop_loss}</strong>
                                </span>
                                <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-1 rounded-lg">
                                  🎯 Take-Profit: <strong>{stock.take_profit}</strong>
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-6 shrink-0">
                            <div className="text-right">
                              <div className="text-xs uppercase tracking-wider text-gray-400">Score</div>
                              <div className="text-xl font-extrabold text-emerald-400 font-mono">{stock.score}/100</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-gray-800/50 gap-3">
                          <span className="text-xs text-emerald-400/90 font-mono">
                            {price > 0 && isBuy ? `Købs-guidance: ${calculatedShares} stk. (ca. ${totalCost.toLocaleString('da-DK')} DKK)` : ''}
                          </span>

                          <button 
                            onClick={() => handleCopyTicker(stock.symbol, stock.name)}
                            className="inline-flex items-center gap-1.5 text-xs bg-gray-900 hover:bg-gray-800 text-gray-200 px-3.5 py-2 rounded-xl font-medium border border-gray-700/80 cursor-pointer"
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
        )}
      </div>

      {/* FAST BUNDMENU (MOBILE TAB BAR) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0b1326]/95 backdrop-blur-md border-t border-gray-800 py-3 px-6 z-50 shadow-2xl">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <button 
            onClick={() => setActiveTab('KORTSIGTET')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'KORTSIGTET' ? 'text-cyan-400 font-bold' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span className="text-lg">⚡</span>
            <span className="text-[11px] tracking-wide">Kortsigtet</span>
          </button>

          <button 
            onClick={() => setActiveTab('LANGSIKTET')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'LANGSIKTET' ? 'text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span className="text-lg">🛡️</span>
            <span className="text-[11px] tracking-wide">Langsigtet</span>
          </button>

          <button 
            onClick={() => setActiveTab('PORTEFØLJE')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'PORTEFØLJE' ? 'text-cyan-400 font-bold' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span className="text-lg">💼</span>
            <span className="text-[11px] tracking-wide">Min Portefølje</span>
          </button>
        </div>
      </nav>
    </main>
  )
}