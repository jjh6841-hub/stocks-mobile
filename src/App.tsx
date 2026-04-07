import React, { useEffect, useState, useCallback } from 'react'

// ── 데이터 소스: 웹버전 JSON 공유 ──────────────────────────────────
const DATA_URL = 'https://jjh6841-hub.github.io/stocks/market-data.json'

// ── 타입 ─────────────────────────────────────────────────────────
interface Quote {
  sym: string; name: string; type: string
  price: number; change: number; changePct: number
  high52w: number; low52w: number; ath?: number
  unit?: string; icon?: string
}
interface MarketData {
  updatedAt: string
  quotes: Record<string, Quote>
  crypto: any[]
  forex: Record<string, number>
  fearGreed: { value: number; label: string }
  news: any[]
  investorTrading?: {
    date: string; note?: string
    data: Record<string, { buy: Array<{code:string;name:string;amount:number}>; sell: Array<{code:string;name:string;amount:number}> }>
  }
}
type Tab = 'home' | 'assets' | 'news' | 'outlook' | 'investor'

// ── 유틸 ─────────────────────────────────────────────────────────
const fmt = (n: number, d = 2) => n.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d })
const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
const fmtBn = (n: number) =>
  n >= 1e12 ? `${(n/1e12).toFixed(1)}조` :
  n >= 1e8  ? `${(n/1e8).toFixed(0)}억`  :
  n >= 1e4  ? `${(n/1e4).toFixed(0)}만`  : `${n}`

const KST_OFFSET = 9 * 60
const kstNow = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() + KST_OFFSET + d.getTimezoneOffset()); return d
}

// ── 색상 상수 ────────────────────────────────────────────────────
const C = {
  bg: '#050e1a', card: '#091523', card2: '#0d1b2e', border: '#122030',
  accent: '#40c4ff', green: '#00e676', red: '#ff5252',
  gold: '#ffd740', purple: '#b39ddb', orange: '#ff8a65',
  text: '#eceff1', muted: '#8ea5b0', dim: '#607d8b',
}

// ── 공포탐욕 색상 ─────────────────────────────────────────────────
const fgColor = (v: number) =>
  v <= 25 ? '#ff5252' : v <= 45 ? '#ff8a65' : v <= 55 ? '#ffd740' : v <= 75 ? '#69f0ae' : '#00e676'

// ── 가격 색상 ────────────────────────────────────────────────────
const pctColor = (p: number) => p > 0 ? C.green : p < 0 ? C.red : C.muted

// ── CALENDAR 이벤트 (정적) ─────────────────────────────────────────
const CALENDAR_EVENTS = [
  { date: '04/09', title: 'FOMC 의사록', tag: 'Fed' },
  { date: '04/10', title: '美 CPI 발표', tag: 'Macro' },
  { date: '04/11', title: '美 PPI 발표', tag: 'Macro' },
  { date: '04/14', title: '골드만삭스 실적', tag: '실적' },
  { date: '04/15', title: 'BOC 금리결정', tag: '금리' },
  { date: '04/16', title: 'TSMC 실적', tag: '실적' },
  { date: '04/23', title: '테슬라 실적', tag: '실적' },
  { date: '04/30', title: 'FOMC 금리결정', tag: 'Fed' },
]

// ══════════════════════════════════════════════════════════════════
// 컴포넌트
// ══════════════════════════════════════════════════════════════════

// ── 탑바 ─────────────────────────────────────────────────────────
function TopBar({ updatedAt, onRefresh, loading }: { updatedAt?: string; onRefresh: () => void; loading: boolean }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const d = kstNow()
      setTime(`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`)
    }
    tick(); const t = setInterval(tick, 10000); return () => clearInterval(t)
  }, [])

  const upd = updatedAt ? (() => {
    const d = new Date(updatedAt)
    const diff = Math.round((Date.now() - d.getTime()) / 60000)
    return diff < 1 ? '방금' : diff < 60 ? `${diff}분 전` : `${Math.floor(diff/60)}시간 전`
  })() : ''

  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:100,
      background: 'linear-gradient(180deg,#050e1a 80%,transparent)',
      padding:'12px 16px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <div>
        <div style={{ fontSize:'18px', fontWeight:'800', color:C.accent, letterSpacing:'1px' }}>
          📈 마켓 모니터
        </div>
        {upd && <div style={{ fontSize:'11px', color:C.dim, marginTop:'1px' }}>업데이트 {upd} · KST {time}</div>}
      </div>
      <button onClick={onRefresh} disabled={loading} style={{
        background: loading ? C.card2 : 'rgba(64,196,255,0.15)',
        border: `1px solid ${loading ? C.border : 'rgba(64,196,255,0.3)'}`,
        borderRadius:'20px', padding:'6px 14px', color: loading ? C.dim : C.accent,
        fontSize:'12px', fontWeight:'600', cursor: loading ? 'default':'pointer'
      }}>
        {loading ? '로딩중…' : '↺ 새로고침'}
      </button>
    </div>
  )
}

// ── 바텀 내비 ─────────────────────────────────────────────────────
const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id:'home',     icon:'📊', label:'시장' },
  { id:'assets',  icon:'💎', label:'자산' },
  { id:'news',    icon:'📰', label:'뉴스' },
  { id:'outlook', icon:'🔮', label:'전망' },
  { id:'investor',icon:'👥', label:'투자자' },
]

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div style={{
      position:'fixed', bottom:0, left:0, right:0, zIndex:100,
      background: C.card, borderTop:`1px solid ${C.border}`,
      display:'flex', paddingBottom:'env(safe-area-inset-bottom)',
    }}>
      {NAV_ITEMS.map(n => (
        <button key={n.id} onClick={() => setTab(n.id)} style={{
          flex:1, padding:'10px 0 8px', border:'none', background:'transparent',
          display:'flex', flexDirection:'column', alignItems:'center', gap:'3px',
          cursor:'pointer', transition:'opacity .15s',
        }}>
          <span style={{ fontSize:'20px', lineHeight:1 }}>{n.icon}</span>
          <span style={{ fontSize:'10px', fontWeight:'600',
            color: tab === n.id ? C.accent : C.dim,
            borderBottom: tab === n.id ? `2px solid ${C.accent}` : '2px solid transparent',
            paddingBottom:'1px',
          }}>{n.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── 로딩 스피너 ──────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'160px' }}>
      <div style={{ width:'36px', height:'36px', border:`3px solid ${C.border}`,
        borderTop:`3px solid ${C.accent}`, borderRadius:'50%',
        animation:'spin .8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── 지수 카드 (가로 스크롤) ──────────────────────────────────────
function IndexCards({ quotes }: { quotes: Record<string, Quote> }) {
  const indices = Object.values(quotes).filter(q => q.type === 'index')
  return (
    <div style={{ overflowX:'auto', paddingBottom:'4px', marginBottom:'8px' }}>
      <div style={{ display:'flex', gap:'10px', padding:'0 16px', width:'max-content' }}>
        {indices.map(q => (
          <div key={q.sym} style={{
            background: C.card, border:`1px solid ${C.border}`, borderRadius:'16px',
            padding:'14px 18px', minWidth:'130px',
            borderLeft: `3px solid ${pctColor(q.changePct)}`,
          }}>
            <div style={{ fontSize:'11px', color:C.muted, marginBottom:'6px', fontWeight:'600' }}>{q.name}</div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:C.text, marginBottom:'4px' }}>
              {fmt(q.price, q.price > 100 ? 0 : 2)}
            </div>
            <div style={{ fontSize:'13px', fontWeight:'700', color:pctColor(q.changePct) }}>
              {fmtPct(q.changePct)}
            </div>
            {q.ath && (
              <div style={{ fontSize:'10px', color:C.dim, marginTop:'4px' }}>
                ATH {((q.price/q.ath-1)*100).toFixed(1)}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ETF 섹터 카드 ─────────────────────────────────────────────────
function EtfCards({ quotes }: { quotes: Record<string, Quote> }) {
  const etfs = Object.values(quotes).filter(q => q.type === 'etf')
  return (
    <div style={{ overflowX:'auto', paddingBottom:'4px' }}>
      <div style={{ display:'flex', gap:'8px', padding:'0 16px', width:'max-content' }}>
        {etfs.map(q => (
          <div key={q.sym} style={{
            background: C.card2, border:`1px solid ${C.border}`, borderRadius:'12px',
            padding:'10px 14px', minWidth:'90px', textAlign:'center',
          }}>
            <div style={{ fontSize:'11px', color:C.muted, marginBottom:'6px' }}>{q.name}</div>
            <div style={{ fontSize:'13px', fontWeight:'700', color:pctColor(q.changePct) }}>
              {fmtPct(q.changePct)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 공포탐욕 게이지 ──────────────────────────────────────────────
function FearGreedGauge({ fg }: { fg: { value: number; label: string } }) {
  const color = fgColor(fg.value)
  const label = fg.value <= 25 ? '극단적 공포' : fg.value <= 45 ? '공포' :
    fg.value <= 55 ? '중립' : fg.value <= 75 ? '탐욕' : '극단적 탐욕'
  return (
    <div style={{
      background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px',
      padding:'16px 20px', margin:'0 16px',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <div style={{ fontSize:'12px', color:C.muted, fontWeight:'700', letterSpacing:'1px' }}>공포&탐욕 지수</div>
        <div style={{ fontSize:'11px', color:color, fontWeight:'700', background:`${color}22`,
          padding:'3px 10px', borderRadius:'20px' }}>{label}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
        <div style={{ fontSize:'48px', fontWeight:'900', color, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
          {fg.value}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ height:'8px', background:C.border, borderRadius:'4px', marginBottom:'6px', position:'relative' }}>
            <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${fg.value}%`,
              background:`linear-gradient(90deg,#ff5252,#ffd740,#00e676)`, borderRadius:'4px' }}/>
            <div style={{ position:'absolute', top:'-3px', left:`${fg.value}%`, transform:'translateX(-50%)',
              width:'14px', height:'14px', background:color, borderRadius:'50%', border:'2px solid #050e1a' }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:C.dim }}>
            <span>극단적 공포</span><span>중립</span><span>극단적 탐욕</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 환율 미니 카드 ────────────────────────────────────────────────
function ForexMini({ forex }: { forex: Record<string, number> }) {
  const pairs = [
    { label:'달러/원', val: forex['KRW'] ? (1/forex['KRW']*1000).toFixed(1) : '-', unit:'₩' },
    { label:'엔/원',   val: forex['JPY'] && forex['KRW'] ? ((forex['JPY']/forex['KRW'])).toFixed(2) : '-', unit:'₩' },
    { label:'유로/원', val: forex['EUR'] && forex['KRW'] ? (forex['EUR']/forex['KRW']*1000).toFixed(1) : '-', unit:'₩' },
    { label:'위안/원', val: forex['CNY'] && forex['KRW'] ? (forex['CNY']/forex['KRW']*100).toFixed(1) : '-', unit:'₩' },
  ]
  const usdKrw = forex['KRW'] ? 1/forex['KRW'] : 0
  return (
    <div style={{ margin:'0 16px', background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px', padding:'16px' }}>
      <div style={{ fontSize:'12px', color:C.muted, fontWeight:'700', letterSpacing:'1px', marginBottom:'12px' }}>환율</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
        {pairs.map(p => (
          <div key={p.label} style={{ background:C.card2, borderRadius:'12px', padding:'10px 12px' }}>
            <div style={{ fontSize:'11px', color:C.dim, marginBottom:'4px' }}>{p.label}</div>
            <div style={{ fontSize:'17px', fontWeight:'800', color:C.text }}>{p.val}</div>
          </div>
        ))}
      </div>
      {usdKrw > 0 && (
        <div style={{ marginTop:'10px', fontSize:'11px', color:C.dim, textAlign:'right' }}>
          USD/KRW: {fmt(usdKrw, 1)}
        </div>
      )}
    </div>
  )
}

// ── 섹션 헤더 ─────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding:'16px 16px 8px', display:'flex', alignItems:'baseline', gap:'8px' }}>
      <div style={{ fontSize:'14px', fontWeight:'800', color:C.text, letterSpacing:'0.5px' }}>{title}</div>
      {sub && <div style={{ fontSize:'11px', color:C.dim }}>{sub}</div>}
    </div>
  )
}

// ── 코인 카드 ─────────────────────────────────────────────────────
function CoinCards({ crypto }: { crypto: any[] }) {
  const COIN_ICONS: Record<string, string> = {
    bitcoin:'₿', ethereum:'Ξ', solana:'◎', ripple:'✕', binancecoin:'B'
  }
  return (
    <div style={{ overflowX:'auto', paddingBottom:'4px' }}>
      <div style={{ display:'flex', gap:'10px', padding:'0 16px', width:'max-content' }}>
        {crypto.slice(0, 5).map((c: any) => {
          const pct = c.price_change_percentage_24h ?? 0
          return (
            <div key={c.id} style={{
              background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px',
              padding:'14px 16px', minWidth:'130px',
              borderLeft:`3px solid ${pctColor(pct)}`,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:`${pctColor(pct)}22`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'14px', fontWeight:'800', color:pctColor(pct) }}>
                  {COIN_ICONS[c.id] ?? '●'}
                </div>
                <div>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:C.text }}>{c.symbol.toUpperCase()}</div>
                  <div style={{ fontSize:'10px', color:C.dim }}>{c.name}</div>
                </div>
              </div>
              <div style={{ fontSize:'18px', fontWeight:'800', color:C.text, marginBottom:'4px' }}>
                ${c.current_price < 1 ? c.current_price.toFixed(4) : fmt(c.current_price, 0)}
              </div>
              <div style={{ fontSize:'13px', fontWeight:'700', color:pctColor(pct) }}>{fmtPct(pct)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 원자재 리스트 ─────────────────────────────────────────────────
function CommodityList({ quotes }: { quotes: Record<string, Quote> }) {
  const commodities = Object.values(quotes).filter(q => q.type === 'commodity')
  return (
    <div style={{ margin:'0 16px', background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px', overflow:'hidden' }}>
      {commodities.map((q, i) => (
        <div key={q.sym} style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'13px 16px', borderBottom: i < commodities.length - 1 ? `1px solid ${C.border}` : 'none',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'20px' }}>{q.icon ?? '●'}</span>
            <div>
              <div style={{ fontSize:'14px', fontWeight:'600', color:C.text }}>{q.name}</div>
              <div style={{ fontSize:'11px', color:C.dim }}>{q.unit}</div>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'16px', fontWeight:'700', color:C.text }}>{fmt(q.price, 2)}</div>
            <div style={{ fontSize:'13px', fontWeight:'700', color:pctColor(q.changePct) }}>{fmtPct(q.changePct)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 주요 해외주식 ─────────────────────────────────────────────────
function StockList({ quotes }: { quotes: Record<string, Quote> }) {
  const stocks = Object.values(quotes).filter(q => q.type === 'stock')
  return (
    <div style={{ margin:'0 16px', background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px', overflow:'hidden' }}>
      {stocks.map((q, i) => (
        <div key={q.sym} style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'11px 16px', borderBottom: i < stocks.length - 1 ? `1px solid ${C.border}` : 'none',
        }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:'700', color:C.text }}>{q.sym}</div>
            <div style={{ fontSize:'11px', color:C.dim }}>{q.name}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'15px', fontWeight:'700', color:C.text }}>{fmt(q.price, 2)}</div>
            <div style={{ fontSize:'12px', fontWeight:'700', color:pctColor(q.changePct) }}>{fmtPct(q.changePct)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 뉴스 카드 ─────────────────────────────────────────────────────
const NEWS_CAT: Record<string, { label: string; color: string }> = {
  trump:    { label:'트럼프', color:'#ff6b35' },
  crypto:   { label:'코인',   color:'#ffd740' },
  tech:     { label:'테크',   color:'#40c4ff' },
  energy:   { label:'에너지', color:'#69f0ae' },
  korea:    { label:'한국',   color:'#b39ddb' },
  earnings: { label:'실적',   color:'#ff8a65' },
  macro:    { label:'매크로', color:'#8ea5b0' },
}

function NewsFeed({ news }: { news: any[] }) {
  const [filter, setFilter] = useState<string>('all')
  const cats = ['all', 'trump', 'tech', 'macro', 'crypto', 'korea', 'energy', 'earnings']
  const filtered = filter === 'all' ? news : news.filter((n: any) => n.category === filter)

  return (
    <div>
      {/* 카테고리 필터 */}
      <div style={{ overflowX:'auto', padding:'0 16px 12px' }}>
        <div style={{ display:'flex', gap:'8px', width:'max-content' }}>
          {cats.map(c => {
            const info = NEWS_CAT[c]
            const active = filter === c
            return (
              <button key={c} onClick={() => setFilter(c)} style={{
                padding:'6px 14px', borderRadius:'20px', border:'none', cursor:'pointer',
                fontSize:'12px', fontWeight:'600',
                background: active ? (info?.color ?? C.accent) : C.card2,
                color: active ? '#050e1a' : C.muted,
              }}>
                {c === 'all' ? '전체' : info?.label ?? c}
              </button>
            )
          })}
        </div>
      </div>

      {/* 뉴스 리스트 */}
      <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:'10px' }}>
        {filtered.slice(0, 20).map((n: any) => {
          const cat = NEWS_CAT[n.category]
          const isTrump = n.isTrump
          return (
            <a key={n.id} href={n.url} target="_blank" rel="noreferrer" style={{ textDecoration:'none' }}>
              <div style={{
                background: isTrump ? 'rgba(255,107,53,0.08)' : C.card,
                border: `1px solid ${isTrump ? 'rgba(255,107,53,0.3)' : C.border}`,
                borderRadius:'14px', padding:'13px 15px',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'7px' }}>
                  {cat && (
                    <span style={{ fontSize:'10px', fontWeight:'700', color:cat.color,
                      background:`${cat.color}22`, padding:'2px 8px', borderRadius:'20px' }}>
                      {cat.label}
                    </span>
                  )}
                  <span style={{ fontSize:'10px', color:C.dim, marginLeft:'auto' }}>{n.time}</span>
                  <span style={{ fontSize:'10px', color:C.dim }}>{n.source}</span>
                </div>
                <div style={{ fontSize:'14px', color:C.text, fontWeight:'600', lineHeight:'1.5',
                  wordBreak:'keep-all' }}>
                  {n.title}
                </div>
                {n.sentiment === 'negative' && (
                  <div style={{ marginTop:'6px', fontSize:'10px', color:C.red }}>▼ 부정</div>
                )}
                {n.sentiment === 'positive' && (
                  <div style={{ marginTop:'6px', fontSize:'10px', color:C.green }}>▲ 긍정</div>
                )}
              </div>
            </a>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', color:C.dim, fontSize:'13px', padding:'32px' }}>해당 카테고리 뉴스 없음</div>
        )}
      </div>
    </div>
  )
}

// ── 시장 전망 ─────────────────────────────────────────────────────
function MarketOutlook({ quotes, fg }: { quotes: Record<string, Quote>; fg: { value: number; label: string } }) {
  const spx = quotes['^GSPC']
  const gold = quotes['GC=F']
  const fgV = fg.value

  let bull = 0, bear = 0
  if (fgV <= 20) { bear += 2; bull += 1 }
  else if (fgV <= 35) bear += 2
  else if (fgV <= 55) { bull += 1; bear += 1 }
  else if (fgV <= 75) bull += 2
  else { bull += 2; bear += 1 }

  const spxFromATH = spx && spx.ath ? ((spx.price / spx.ath - 1) * 100) : null
  if (spxFromATH !== null) {
    if (spxFromATH < -20) { bear += 3; bull += 1 }
    else if (spxFromATH < -10) { bear += 2; bull += 1 }
    else if (spxFromATH < -5) bear += 1
    else bull += 2
  }
  if (gold?.changePct > 1) { bull += 1; bear += 1 }

  const total = bull + bear
  const bullPct = total > 0 ? Math.round(bull / total * 100) : 50
  const scenario = bull > bear + 1 ? 'bull' : bear > bull + 1 ? 'bear' : 'base'

  const scenarioInfo = {
    bull:  { icon:'🟢', label:'단기 강세', color:C.green },
    bear:  { icon:'🔴', label:'단기 약세', color:C.red },
    base:  { icon:'🟡', label:'중립 / 관망', color:C.gold },
  }[scenario]

  const shortLines: string[] = []
  if (fgV <= 25 && spxFromATH !== null && spxFromATH < -10)
    shortLines.push(`공포지수 ${fgV} — 역사적으로 FG 25 이하에서 3개월 평균 +12% 반등 경향`)
  else if (fgV <= 35)
    shortLines.push(`공포 심리 지속 중 (FG ${fgV}) — 반등 시 저점 매수 기회 탐색`)
  else if (fgV >= 75)
    shortLines.push(`극단적 탐욕 (FG ${fgV}) — 과매수 구간, 단기 조정 가능성`)
  else if (fgV >= 60)
    shortLines.push(`탐욕 구간 (FG ${fgV}) — 모멘텀 유지, 추가 이벤트 촉매 필요`)
  else
    shortLines.push(`중립 심리 (FG ${fgV}) — 방향성 불확실, 이벤트 주시 필요`)

  if (spxFromATH !== null) {
    if (spxFromATH < -15)
      shortLines.push(`S&P500 ATH 대비 ${spxFromATH.toFixed(1)}% — 기술적 저점 구간 진입`)
    else if (spxFromATH < -5)
      shortLines.push(`S&P500 ATH 대비 ${spxFromATH.toFixed(1)}% — 조정 중`)
    else
      shortLines.push(`S&P500 ATH 근접 (${spxFromATH.toFixed(1)}%) — 신고가 돌파 여부 주목`)
  }

  const midScenarios = [
    { label:'📈 강세 시나리오', color:C.green, prob: bullPct,
      desc:'인플레이션 안정→Fed 금리인하 기대 강화, 기업실적 호조로 지수 반등 가능' },
    { label:'📉 약세 시나리오', color:C.red, prob: 100 - bullPct,
      desc:'관세 전쟁 심화, 경기침체 우려 확대시 추가 하락 압력' },
  ]

  const watchStocks = [
    { name:'NVDA', reason:'AI 수요 지표' },
    { name:'TSMC', reason:'반도체 사이클' },
    { name:'삼성전자', reason:'HBM·KOSPI 선행' },
    { name:'한화에어로', reason:'방산 모멘텀' },
    { name:'XOM', reason:'원유 가격 연동' },
  ]

  return (
    <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:'12px' }}>
      {/* 시나리오 뱃지 */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px', padding:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ fontSize:'14px', fontWeight:'800', color:C.text }}>현재 시장 진단</div>
          <div style={{ fontSize:'12px', fontWeight:'700', color:scenarioInfo.color,
            background:`${scenarioInfo.color}22`, padding:'4px 12px', borderRadius:'20px' }}>
            {scenarioInfo.icon} {scenarioInfo.label}
          </div>
        </div>
        {/* 강세/약세 바 */}
        <div style={{ marginBottom:'12px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'5px' }}>
            <span style={{ color:C.green, fontWeight:'700' }}>강세 {bullPct}%</span>
            <span style={{ color:C.red, fontWeight:'700' }}>약세 {100-bullPct}%</span>
          </div>
          <div style={{ height:'8px', background:C.border, borderRadius:'4px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${bullPct}%`, background:`linear-gradient(90deg,${C.red},${C.green})`, borderRadius:'4px' }}/>
          </div>
        </div>
        {/* 단기 전망 */}
        {shortLines.map((l, i) => (
          <div key={i} style={{ fontSize:'13px', color:C.muted, lineHeight:'1.6', wordBreak:'keep-all',
            paddingLeft:'10px', borderLeft:`2px solid ${scenarioInfo.color}`, marginBottom:'6px' }}>
            {l}
          </div>
        ))}
      </div>

      {/* 중기 시나리오 */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px', padding:'16px' }}>
        <div style={{ fontSize:'13px', fontWeight:'700', color:C.muted, marginBottom:'12px', letterSpacing:'1px' }}>
          중기 시나리오 (1-3개월)
        </div>
        {midScenarios.map((s, i) => (
          <div key={i} style={{ marginBottom: i < midScenarios.length - 1 ? '12px' : 0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
              <div style={{ fontSize:'13px', fontWeight:'700', color:s.color }}>{s.label}</div>
              <div style={{ fontSize:'12px', fontWeight:'800', color:s.color }}>{s.prob}%</div>
            </div>
            <div style={{ height:'4px', background:C.border, borderRadius:'2px', marginBottom:'6px' }}>
              <div style={{ height:'100%', width:`${s.prob}%`, background:s.color, borderRadius:'2px', opacity:0.7 }}/>
            </div>
            <div style={{ fontSize:'12px', color:C.dim, lineHeight:'1.5', wordBreak:'keep-all' }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* 이벤트 캘린더 */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px', padding:'16px' }}>
        <div style={{ fontSize:'13px', fontWeight:'700', color:C.muted, marginBottom:'12px', letterSpacing:'1px' }}>
          주요 이벤트
        </div>
        {CALENDAR_EVENTS.map((e, i) => {
          const tagColor = e.tag==='Fed'?'#ff8a65':e.tag==='Macro'?C.accent:e.tag==='실적'?C.gold:'#b39ddb'
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px',
              marginBottom: i < CALENDAR_EVENTS.length-1 ? '10px' : 0 }}>
              <div style={{ fontSize:'12px', color:C.dim, width:'40px', flexShrink:0 }}>{e.date}</div>
              <div style={{ flex:1, fontSize:'13px', color:C.text, wordBreak:'keep-all' }}>{e.title}</div>
              <div style={{ fontSize:'10px', color:tagColor, background:`${tagColor}22`,
                padding:'2px 8px', borderRadius:'20px', flexShrink:0 }}>{e.tag}</div>
            </div>
          )
        })}
      </div>

      {/* 주목 종목 */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px', padding:'16px', marginBottom:'4px' }}>
        <div style={{ fontSize:'13px', fontWeight:'700', color:C.muted, marginBottom:'12px', letterSpacing:'1px' }}>
          주목 종목
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
          {watchStocks.map(s => (
            <div key={s.name} style={{ background:C.card2, borderRadius:'12px', padding:'10px 12px' }}>
              <div style={{ fontSize:'14px', fontWeight:'800', color:C.accent, marginBottom:'3px' }}>{s.name}</div>
              <div style={{ fontSize:'11px', color:C.dim }}>{s.reason}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 투자자 패널 ──────────────────────────────────────────────────
function InvestorPanel({ data }: { data: MarketData['investorTrading'] }) {
  const [inv, setInv] = useState('외국인')
  const [side, setSide] = useState<'buy'|'sell'>('buy')
  const INV_COLORS: Record<string, string> = {
    '외국인':C.accent, '기관':'#69f0ae', '연기금':C.gold, '개인':C.orange,
  }
  if (!data?.data) return (
    <div style={{ margin:'0 16px', background:C.card, border:`1px solid ${C.border}`,
      borderRadius:'16px', padding:'32px 16px', textAlign:'center', color:C.dim, fontSize:'13px' }}>
      👥 투자자 데이터 — 다음 실행 후 표시됩니다
    </div>
  )
  const list = data.data[inv]?.[side] ?? []
  const maxAmt = Math.max(...list.map(x => x.amount), 1)
  const isRatio = inv === '외국인' && list.length > 0 && list[0].amount < 10000
  const fmtAmt = (n: number) => isRatio ? `${(n/100).toFixed(1)}%` : fmtBn(n)
  const dateLabel = data.date
    ? `${data.date.slice(0,4)}.${data.date.slice(4,6)}.${data.date.slice(6,8)} 기준 · ${isRatio ? '외국인지분율':'거래대금'}`
    : ''
  const accent = INV_COLORS[inv] ?? C.accent

  return (
    <div style={{ padding:'0 16px' }}>
      {dateLabel && <div style={{ fontSize:'11px', color:C.dim, marginBottom:'10px' }}>{dateLabel}</div>}

      {/* 투자자 탭 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'12px', overflowX:'auto', paddingBottom:'2px' }}>
        {Object.keys(INV_COLORS).map(t => (
          <button key={t} onClick={() => setInv(t)} style={{
            padding:'7px 18px', borderRadius:'20px', border:`1px solid ${inv===t ? INV_COLORS[t] : C.border}`,
            cursor:'pointer', fontSize:'13px', fontWeight:'700', flexShrink:0,
            background: inv===t ? `${INV_COLORS[t]}22` : 'transparent',
            color: inv===t ? INV_COLORS[t] : C.dim,
          }}>{t}</button>
        ))}
      </div>

      {/* 매수/매도 토글 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
        {(['buy','sell'] as const).map(s => (
          <button key={s} onClick={() => setSide(s)} style={{
            flex:1, padding:'10px', borderRadius:'12px', border:'none', cursor:'pointer',
            fontSize:'14px', fontWeight:'700',
            background: side===s ? (s==='buy'?'rgba(0,230,118,.2)':'rgba(255,82,82,.2)') : C.card2,
            color: side===s ? (s==='buy'?C.green:C.red) : C.dim,
          }}>
            {s==='buy' ? '▲ 매수 상위' : '▼ 매도 상위'}
          </button>
        ))}
      </div>

      {/* 리스트 */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px', overflow:'hidden' }}>
        {list.length === 0
          ? <div style={{ padding:'24px', textAlign:'center', color:C.dim, fontSize:'13px' }}>데이터 없음</div>
          : list.slice(0, 10).map((item, i) => (
            <div key={item.code} style={{
              padding:'12px 16px',
              borderBottom: i < list.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
                <span style={{ fontSize:'12px', color:C.dim, width:'20px', textAlign:'right', fontWeight:'700', flexShrink:0 }}>{i+1}</span>
                <span style={{ flex:1, fontSize:'14px', color:C.text, fontWeight:'600',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</span>
                <span style={{ fontSize:'14px', fontWeight:'800',
                  color:side==='buy'?C.green:C.red, flexShrink:0 }}>{fmtAmt(item.amount)}</span>
              </div>
              <div style={{ marginLeft:'30px', height:'4px', background:C.card2, borderRadius:'2px' }}>
                <div style={{ height:'100%', width:`${(item.amount/maxAmt)*100}%`,
                  background:accent, borderRadius:'2px', opacity:0.6 }}/>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// 탭 화면
// ══════════════════════════════════════════════════════════════════

function HomeTab({ data }: { data: MarketData }) {
  return (
    <div>
      <SectionHeader title="주요 지수" />
      <IndexCards quotes={data.quotes} />
      <SectionHeader title="섹터 ETF" />
      <EtfCards quotes={data.quotes} />
      <div style={{ height:'12px' }}/>
      <FearGreedGauge fg={data.fearGreed} />
      <div style={{ height:'12px' }}/>
      <ForexMini forex={data.forex} />
    </div>
  )
}

function AssetsTab({ data }: { data: MarketData }) {
  return (
    <div>
      <SectionHeader title="가상자산" />
      <CoinCards crypto={data.crypto} />
      <SectionHeader title="원자재" />
      <CommodityList quotes={data.quotes} />
      <SectionHeader title="해외주식" />
      <StockList quotes={data.quotes} />
    </div>
  )
}

function NewsTab({ data }: { data: MarketData }) {
  return (
    <div>
      <SectionHeader title="주요 뉴스" sub={`${data.news.length}건`} />
      <NewsFeed news={data.news} />
    </div>
  )
}

function OutlookTab({ data }: { data: MarketData }) {
  return (
    <div>
      <SectionHeader title="시장 전망" sub="AI 시그널 기반" />
      <MarketOutlook quotes={data.quotes} fg={data.fearGreed} />
    </div>
  )
}

function InvestorTab({ data }: { data: MarketData }) {
  return (
    <div>
      <SectionHeader title="투자자별 TOP10" sub={data.investorTrading?.note} />
      <InvestorPanel data={data.investorTrading} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// 메인 앱
// ══════════════════════════════════════════════════════════════════

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch(DATA_URL + '?t=' + Date.now())
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setData(await r.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 10분마다 자동 갱신
  useEffect(() => {
    const t = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  const CONTENT_STYLE: React.CSSProperties = {
    paddingTop: '68px',
    paddingBottom: 'calc(70px + env(safe-area-inset-bottom))',
    minHeight: '100vh',
  }

  return (
    <div style={{ background:C.bg, minHeight:'100vh' }}>
      <TopBar updatedAt={data?.updatedAt} onRefresh={load} loading={loading} />

      <div style={CONTENT_STYLE}>
        {loading && !data && <Spinner />}
        {error && !data && (
          <div style={{ padding:'32px 16px', textAlign:'center', color:C.red, fontSize:'14px' }}>
            데이터 로드 실패: {error}<br/>
            <button onClick={load} style={{ marginTop:'12px', padding:'8px 20px', borderRadius:'10px',
              background:'rgba(255,82,82,.2)', border:`1px solid ${C.red}`, color:C.red,
              fontSize:'13px', cursor:'pointer' }}>재시도</button>
          </div>
        )}
        {data && (
          <>
            {tab === 'home'     && <HomeTab     data={data} />}
            {tab === 'assets'  && <AssetsTab   data={data} />}
            {tab === 'news'    && <NewsTab     data={data} />}
            {tab === 'outlook' && <OutlookTab  data={data} />}
            {tab === 'investor'&& <InvestorTab data={data} />}
          </>
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  )
}
