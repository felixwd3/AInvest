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

interface PortfolioItem {
  id: string
  symbol: string
  name: string
  shares: number
  purchase_price: number
  current_price: number | null
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
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [budget, setBudget] = useState<number>(10000)
  const [analyzing, setAnalyzing] = useState(false)
  const [discovering, setDiscovering] = useState(false)

  const [newSymbol, setNewSymbol] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const [saxoText, setSaxoText] = useState('')
  const [importing, setImporting] = useState(false)

  const [pushEnabled, setPushEnabled] = useState(false)
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
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setPushEnabled(true)
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
      } catch (e) {}
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
      alert(`📋 Ticker "${symbol}" (${name}) er kopieret til udklipsholder.`);
    });
  }

  const filteredStocks = stocks.filter(stock => {
    const tf = stock.timeframe || 'LANGSIKTET'
    return tf === activeTab
  })

  return (
    <main className="min-h-screen lunar-glow text-slate-100 p-4 md:p-12 pb-36 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6">
        
        {/* Header med fastlåst logo-størrelse */}
        <header className="flex justify-between items-center bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-5 shadow-2xl w-full">
          <div className="flex items-center gap-3.5">
            <div style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px' }} className="rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden p-1.5 shrink-0">
              <img src="/logo.png" alt="AInvest" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">AINVEST</h1>
              <p className="text-[11px] tracking-wider text-slate-400 uppercase font-medium">
                {activeTab === 'PORTEFØLJE' ? 'Portefølje' : activeTab === 'KORTSIGTET' ? 'Sving & Momentum' : 'Langsigtet Anker'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab !== 'PORTEFØLJE' && (
              <button
                onClick={discoverNewStock}
                disabled={discovering}
                className="bg-slate-950 hover:bg-slate-800 text-cyan-400 border border-slate-800 text-xs font-semibold px-3 py-2.5 rounded-2xl transition disabled:opacity-50"
              >
                {discovering ? 'Scanner...' : '🔍 Top 3'}
              </button>
            )}
            <button
              onClick={runAiAnalysis}
              disabled={analyzing}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-2xl transition shadow-md disabled:opacity-50"
            >
              {analyzing ? 'Opdaterer...' : '✨ Opdater'}
            </button>
          </div>
        </header>

        {/* MARKEDETS PULS KORT */}
        <section className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 bg-emerald-950/50 border border-emerald-900/40 px-3 py-1 rounded-full">
              Markedsoverblik • {marketPulse.status}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-white mb-2">
            {marketPulse.headline}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            {marketPulse.advice}
          </p>

          <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {pushEnabled ? '🛡️ Stop-Loss overvågning aktiv' : '🔕 Slå notifikationer til for alarmer'}
            </span>
            {!pushEnabled && (
              <button
                onClick={requestPushPermission}
                className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition"
              >
                Slå til
              </button>
            )}
          </div>
        </section>

        {/* INDHOLD FOR HVER TAB */}
        {activeTab === 'PORTEFØLJE' ? (
          <div className="space-y-6">
            <section className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-6 shadow-2xl">
              <h2 className="text-sm font-bold text-cyan-300 uppercase tracking-wider mb-1">Saxo Lyn-Import</h2>
              <p className="text-xs text-slate-400 mb-4">Indsæt ordretekst direkte fra Saxo:</p>
              <form onSubmit={handleSaxoImport} className="flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="F.eks. Købt 10 stk. Novo Nordisk til 450" 
                  value={saxoText}
                  onChange={(e) => setSaxoText(e.target.value)}
                  className="bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-white text-xs focus:outline-none focus:border-cyan-500 transition"
                  required
                />
                <button 
                  type="submit"
                  disabled={importing}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-2xl text-xs transition disabled:opacity-50"
                >
                  {importing ? 'Tyder ordre...' : '⚡ Tilføj til Portefølje'}
                </button>
              </form>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Aktive Positioner</h2>
              {portfolio.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-8 text-center text-slate-400 text-xs">
                  Ingen aktive handler endnu. Brug lyn-importen ovenfor.
                </div>
              ) : (
                portfolio.map((item) => {
                  const curPrice = item.current_price || item.purchase_price
                  const investedValue = item.shares * item.purchase_price
                  const currentValue = item.shares * curPrice
                  const gainLoss = currentValue - investedValue
                  const gainLossPct = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0
                  const isProfit = gainLoss >= 0

                  return (
                    <div key={item.id} className="bg-slate-900/60 border border-slate-800/60 rounded-3xl p-5 shadow-xl relative">
                      <button 
                        onClick={() => deletePortfolioItem(item.id, item.symbol)}
                        className="absolute top-5 right-5 text-slate-500 hover:text-rose-400 text-xs"
                      >
                        ✕
                      </button>
                      <div className="flex justify-between items-start mb-2 pr-6">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{item.name}</h3>
                            <span className="text-[10px] bg-slate-950 text-cyan-300 px-2.5 py-0.5 rounded-lg font-mono border border-slate-800">{item.symbol}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {item.shares} stk. à {item.purchase_price} DKK (Aktuel: {curPrice})
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isProfit ? '+' : ''}{gainLoss.toFixed(1)} DKK ({isProfit ? '+' : ''}{gainLossPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Budget & Beregner */}
            <section className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-5 shadow-xl flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Tranche Budget</h3>
                <p className="text-[11px] text-slate-400">Spreder risiko automatisk</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-2xl px-3.5 py-2 shrink-0">
                <input 
                  type="number" 
                  value={budget} 
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="bg-transparent text-right font-mono text-xs text-emerald-400 font-bold w-24 focus:outline-none"
                />
                <span className="text-xs text-slate-500">DKK</span>
              </div>
            </section>

            {/* Tilføj manuelt */}
            <section className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-5 shadow-xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Tilføj overvågning</h3>
              <form onSubmit={handleAddStock} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Navn" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-slate-950/80 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white flex-1 focus:outline-none focus:border-emerald-500"
                />
                <input 
                  type="text" 
                  placeholder="Ticker" 
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="bg-slate-950/80 border border-slate-800 rounded-2xl px-3 py-2.5 text-xs text-white w-24 font-mono uppercase focus:outline-none focus:border-emerald-500"
                  required
                />
                <button 
                  type="submit"
                  disabled={adding}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-2xl text-xs transition disabled:opacity-50"
                >
                  +
                </button>
              </form>
            </section>

            {/* Aktieliste */}
            <section className="space-y-3">
              {loading ? (
                <div className="text-center py-12 text-slate-500 text-xs font-mono">Henter data...</div>
              ) : filteredStocks.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-8 text-center text-slate-400 text-xs">
                  Ingen aktier fundet endnu. Klik på "Top 3".
                </div>
              ) : (
                filteredStocks.map((stock, index) => {
                  const price = stock.current_price || 0
                  const trancheBudget = budget / 2
                  const calculatedShares = price > 0 ? Math.floor(trancheBudget / price) : 0
                  const totalCost = calculatedShares * price
                  const isTopPick = index === 0 && stock.score >= 85

                  return (
                    <div 
                      key={stock.id} 
                      className={`bg-slate-900/60 backdrop-blur-xl border rounded-3xl p-5 shadow-xl relative transition ${
                        isTopPick ? 'border-emerald-500/50 shadow-emerald-500/5' : 'border-slate-800/60'
                      }`}
                    >
                      {isTopPick && (
                        <div className="absolute -top-3 left-5 bg-emerald-500 text-slate-950 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow">
                          Top Valg
                        </div>
                      )}

                      <button 
                        onClick={() => deleteStock(stock.id, stock.symbol)}
                        className="absolute top-5 right-5 text-slate-600 hover:text-rose-400 text-xs"
                      >
                        ✕
                      </button>

                      <div className="flex justify-between items-start mb-2 pr-6 pt-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{stock.name}</h3>
                            <span className="text-[10px] bg-slate-950 text-cyan-300 px-2 py-0.5 rounded-lg font-mono border border-slate-800">{stock.symbol}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-2 leading-relaxed">{stock.ai_reasoning}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-extrabold text-emerald-400 font-mono">{stock.score}</span>
                          <span className="text-[9px] text-slate-500 block">Score</span>
                        </div>
                      </div>

                      {stock.stop_loss && (
                        <div className="flex gap-2 mt-3 text-[10px] font-mono">
                          <span className="text-rose-400 bg-rose-950/30 border border-rose-900/40 px-2.5 py-1 rounded-xl">
                            Stop-Loss: {stock.stop_loss}
                          </span>
                          <span className="text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2.5 py-1 rounded-xl">
                            Take-Profit: {stock.take_profit}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-800/60 text-[11px]">
                        <span className="text-slate-400 font-mono">
                          {price > 0 ? `Tranche (50%): ${calculatedShares} stk. (${totalCost.toLocaleString('da-DK')} DKK)` : ''}
                        </span>
                        <button 
                          onClick={() => handleCopyTicker(stock.symbol, stock.name)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700/60 font-medium transition"
                        >
                          Kopiér Ticker
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </section>
          </div>
        )}
      </div>

      {/* Flydende Neo-bank Tab Bar i bunden */}
      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-2xl border border-slate-800/60 py-3 px-6 z-50 rounded-3xl shadow-2xl max-w-sm mx-auto">
        <div className="flex justify-around items-center">
          <button 
            onClick={() => setActiveTab('KORTSIGTET')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'KORTSIGTET' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="text-base">⚡</span>
            <span className="text-[10px] tracking-wide">Kortsigtet</span>
          </button>

          <button 
            onClick={() => setActiveTab('LANGSIKTET')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'LANGSIKTET' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="text-base">🛡️</span>
            <span className="text-[10px] tracking-wide">Langsigtet</span>
          </button>

          <button 
            onClick={() => setActiveTab('PORTEFØLJE')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'PORTEFØLJE' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="text-base">💼</span>
            <span className="text-[10px] tracking-wide">Portefølje</span>
          </button>
        </div>
      </nav>
    </main>
  )
}