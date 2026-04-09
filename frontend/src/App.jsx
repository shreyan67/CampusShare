import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
// useRef is still used in ListItemModal for title/notes inputs which don't have the remount problem
import * as api from './api.js'

// ── FONTS ─────────────────────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');`

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const ACCENT = '#e94560'
const TRUST_TIERS = {
  newcomer: { label:'Newcomer',   color:'#5F5E5A', bg:'#F1EFE8', limit:1 },
  regular:  { label:'Regular',    color:'#185FA5', bg:'#E6F1FB', limit:3 },
  trusted:  { label:'Trusted',    color:'#0F6E56', bg:'#E1F5EE', limit:5 },
  rep:      { label:'Campus Rep', color:'#534AB7', bg:'#EEEDFE', limit:8 },
}
const CATEGORIES = ['Books','Lab Equipment','Electronics','Notes & Guides','Accessories','Other']
const EMOJIS = { 'Books':'📗','Lab Equipment':'🔬','Electronics':'🔌','Notes & Guides':'📝','Accessories':'🎒','Other':'📦','lost_found':'🔍' }
const STATUS_MAP = {
  available:       { bg:'#eaf3de', color:'#3B6D11', label:'Available'       },
  borrowed:        { bg:'#FAEEDA', color:'#854F0B', label:'Borrowed'        },
  pending:         { bg:'#FAEEDA', color:'#854F0B', label:'Pending'         },
  selected: { bg:'#E6F1FB', color:'#185FA5', label:'Selected' },
  active:          { bg:'#E6F1FB', color:'#185FA5', label:'Active'          },
  returned:        { bg:'#eaf3de', color:'#3B6D11', label:'Returned'        },
  declined:        { bg:'#FCEBEB', color:'#A32D2D', label:'Declined'        },
  overdue:         { bg:'#FCEBEB', color:'#A32D2D', label:'Overdue'         },
  completed: { bg:'#eaf3de', color:'#3B6D11', label:'Claimed' },
}

// ── STYLE HELPERS ─────────────────────────────────────────────────────────────
const A = '#e94560'
const btn = (primary=false, sm=false) => ({
  fontFamily:"'DM Sans',sans-serif", fontSize:sm?11:13, fontWeight:500,
  padding:sm?'4px 10px':'8px 16px', borderRadius:8, cursor:'pointer',
  border:primary?'none':'0.5px solid rgba(0,0,0,0.18)',
  background:primary?A:'transparent', color:primary?'#fff':'#1a1a1a', transition:'all .15s',
})
const INP = { width:'100%', padding:'9px 12px', fontSize:13, border:'0.5px solid rgba(0,0,0,0.18)', borderRadius:8, background:'#f5f5f0', color:'#1a1a1a', outline:'none', boxSizing:'border-box', fontFamily:"'DM Sans',sans-serif" }
const LBL = { display:'block', fontSize:11, fontWeight:500, color:'#666', marginBottom:5 }
const ERR = { padding:'8px 12px', background:'#fff0f0', color:'#c0392b', borderRadius:8, fontSize:12, marginBottom:12 }
const OK  = { padding:'8px 12px', background:'#eaf3de', color:'#3B6D11', borderRadius:8, fontSize:12, marginBottom:12 }
const row = (gap=8) => ({ display:'flex', alignItems:'center', gap })
const card = { background:'#fff', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:12, overflow:'hidden' }

// ── CONTEXT ───────────────────────────────────────────────────────────────────
const Ctx = createContext(null)
const useApp = () => useContext(Ctx)

// ── TOAST ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [msg,setMsg] = useState('')
  const show = useCallback(m => { setMsg(m); setTimeout(()=>setMsg(''),3000) }, [])
  return [msg, show]
}
function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{ position:'sticky', bottom:16, display:'flex', justifyContent:'center', pointerEvents:'none', zIndex:999 }}>
      <div style={{ background:'#1a1a2e', color:'#fff', padding:'10px 22px', borderRadius:8, fontSize:13, maxWidth:360, textAlign:'center' }}>{msg}</div>
    </div>
  )
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, children, wide=false }) {
  if (!open) return null
  return (
    <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, minHeight:'100%', background:'rgba(10,10,20,0.62)', zIndex:100, display:'flex', justifyContent:'center', alignItems:'flex-start', paddingTop:48, paddingBottom:48 }}
      onMouseDown={e => { if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:14, border:'0.5px solid rgba(0,0,0,0.15)', width:'100%', maxWidth:wide?620:440, margin:'0 16px', padding:'1.5rem' }}>
        {children}
      </div>
    </div>
  )
}

// ── SMALL UI ATOMS ────────────────────────────────────────────────────────────
function TierBadge({ tier }) {
  const t = TRUST_TIERS[tier] || TRUST_TIERS.newcomer
  return <span style={{ background:t.bg, color:t.color, fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:20 }}>{t.label}</span>
}
function SBadge({ status, inline=false }) {
  const s = STATUS_MAP[status] || STATUS_MAP.available
  return <span style={{ background:s.bg, color:s.color, fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:20, ...(inline?{}:{ position:'absolute', top:8, right:8 }) }}>{s.label}</span>
}
function Av({ user, size=22 }) {
  const init = user?.avatar || user?.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'
  return <div style={{ width:size, height:size, borderRadius:'50%', background:user?.color||'#888', display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.round(size*.4), fontWeight:500, color:'#fff', flexShrink:0 }}>{init}</div>
}
function Divider() { return <div style={{ height:'0.5px', background:'rgba(0,0,0,0.1)', margin:'12px 0' }} /> }
function ModalTitle({ children }) { return <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:4 }}>{children}</div> }
function ModalSub({ children }) { return <div style={{ fontSize:13, color:'#666', marginBottom:14 }}>{children}</div> }

// ── AUTH SCREEN ───────────────────────────────────────────────────────────────
// KEY DESIGN: all useState at top level, NO conditional rendering of inputs,
// NO key props on inputs. This prevents any remounting that clears field values.
function AuthScreen({ onLogin }) {
  const [mode,       setMode]      = useState('login') // 'login' | 'signup' | 'otp'
  const [pending,    setPending]   = useState(null)
  const [err,        setErr]       = useState('')
  const [loading,    setLoading]   = useState(false)
  const [consoleOtp, setConsoleOtp] = useState('')

  // All field values in one object — useState so they persist across re-renders
  const [fields, setFields] = useState({ name:'', email:'', roll:'', otp:'' })
  const set = key => e => setFields(prev => ({ ...prev, [key]: e.target.value }))

  async function doLogin() {
    setErr('')
    if (!fields.email.trim()) return setErr('Please enter your college email.')
    setLoading(true)
    const r = await api.login(fields.email.trim())
    setLoading(false)
    if (r.error) return setErr(r.error)
    setPending({ userId: r.userId })
    if (r._otp) setConsoleOtp(r._otp)
    setMode('otp')
  }
console.log("SIGNUP CLICKED")

async function doSignup() {
  setErr('')

  const name = fields.name?.trim()
  const email = fields.email?.trim()
  const roll = fields.roll?.trim()

  if (!name || !email || !roll) {
    return setErr('All fields are required.')
  }

  setLoading(true)

  try {
    // ✅ THIS WAS MISSING
    const r = await api.signup(name, email, roll)

    if (r.error) {
      setLoading(false)
      return setErr(r.error)
    }

    setPending({ userId: r.userId })
    if (r._devOtp) setConsoleOtp(r._devOtp)
    setMode('otp')

  } catch (e) {
    setErr('Request failed')
  }

  setLoading(false)
}
  async function doOtp() {
    setErr('')
    if (!fields.otp.trim()) return setErr('Please enter the 6-digit code.')
    setLoading(true)
    const r = await api.verifyOtp(pending.userId, fields.otp.trim())
    setLoading(false)
    if (r.error) return setErr(r.error)
    api.saveSession(r.token, r.user)
    onLogin(r.user)
  }

  function switchMode(m) { setErr(''); setMode(m) }

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", color:'#1a1a1a', minHeight:'100vh', background:'#f9f9f6' }}>
      <style>{FONTS}</style>
      <div style={{ display:'flex', alignItems:'center', padding:'14px 24px', background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.1)' }}>
        <Logo />
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'calc(100vh - 53px)', padding:'2rem 16px' }}>
        <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:12, maxWidth:400, width:'100%', padding:'1.75rem' }}>

          {/* ── LOGIN ── */}
          {mode==='login' && <>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, marginBottom:4 }}>Welcome back</div>
            <div style={{ fontSize:13, color:'#666', marginBottom:'1.25rem' }}>Sign in with your college email</div>
            {err && <div style={ERR}>{err}</div>}
            <div style={{ marginBottom:14 }}>
              <label style={LBL}>College email</label>
              <input
                style={INP}
                placeholder="cs2021001@mail.iitb.ac.in"
                value={fields.email}
                onChange={set('email')}
                onKeyDown={e => e.key==='Enter' && doLogin()}
                autoComplete="email"
              />
            </div>
            <button style={{ ...btn(true), width:'100%', padding:'10px' }} onClick={doLogin} disabled={loading}>
              {loading ? 'Sending code…' : 'Sign in →'}
            </button>
            <p style={{ fontSize:12, color:'#666', textAlign:'center', marginTop:14 }}>
              No account? <span style={{ color:A, cursor:'pointer' }} onClick={()=>switchMode('signup')}>Sign up</span>
            </p>
            <Divider />
            <p style={{ fontSize:11, color:'#aaa', textAlign:'center' }}>Demo: <code>cs2021001@mail.iitb.ac.in</code></p>
          </>}

          {/* ── SIGNUP ── */}
          {mode==='signup' && <>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, marginBottom:4 }}>Join CampusShare</div>
            <div style={{ fontSize:12, color:'#666', marginBottom:'1.25rem' }}>
              Email format: <strong>roll_no@mail.collegename.ac.in</strong><br/>
              Each college sees only their own listings.
            </div>
            {err && <div style={ERR}>{err}</div>}
            <div style={{ marginBottom:14 }}>
              <label style={LBL}>Full name</label>
              <input
                style={INP}
                placeholder="Rahul Mehta"
                value={fields.name}
                onChange={set('name')}
                autoComplete="name"
              />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={LBL}>College email</label>
              <input
                style={INP}
                placeholder="cs2021001@mail.iitb.ac.in"
                value={fields.email}
                onChange={set('email')}
                autoComplete="email"
              />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={LBL}>Roll number</label>
              <input
                style={INP}
                placeholder="CS2021001"
                value={fields.roll}
                onChange={set('roll')}
                onKeyDown={e => e.key==='Enter' && doSignup()}
                autoComplete="off"
              />
            </div>
         <button
  type="button"
  style={{ ...btn(true), width:'100%', padding:'10px' }}
  onClick={doSignup}
  disabled={loading}
>
  {loading ? 'Sending code…' : 'Sign up →'}
</button>
            <p style={{ fontSize:12, color:'#666', textAlign:'center', marginTop:14 }}>
              Have an account? <span style={{ color:A, cursor:'pointer' }} onClick={()=>switchMode('login')}>Sign in</span>
            </p>
          </>}

          {/* ── OTP ── */}
          {mode==='otp' && <>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, marginBottom:4 }}>Check your inbox</div>
            <div style={{ fontSize:13, color:'#666', marginBottom:'1.25rem' }}>
              Enter the 6-digit code sent to your college email.
            </div>
            {err && <div style={ERR}>{err}</div>}
            {consoleOtp && (
              <div style={OK}>
                Console mode — OTP: <strong style={{ letterSpacing:'0.15em' }}>{consoleOtp}</strong>
              </div>
            )}
            <div style={{ marginBottom:14 }}>
              <label style={LBL}>6-digit code</label>
              <input
                style={{ ...INP, letterSpacing:'0.3em', fontSize:22, textAlign:'center' }}
                placeholder="------"
                maxLength={6}
                value={fields.otp}
                onChange={set('otp')}
                onKeyDown={e => e.key==='Enter' && doOtp()}
                autoComplete="one-time-code"
                inputMode="numeric"
              />
              {window.__DEV_OTP__ && (
  <p style={{ marginTop: "10px", color: "#888" }}>
    Dev OTP: <b>{window.__DEV_OTP__}</b>
  </p>
)}
            </div>
            <button style={{ ...btn(true), width:'100%', padding:'10px' }} onClick={doOtp} disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & enter →'}
            </button>
            <p style={{ fontSize:11, color:'#aaa', textAlign:'center', marginTop:14, cursor:'pointer' }} onClick={()=>switchMode('login')}>← Back</p>
          </>}
        </div>
      </div>
    </div>
  )
}

// ── LOGO ──────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, letterSpacing:'-0.5px', ...row(7) }}>
      <span style={{ width:8, height:8, background:ACCENT, borderRadius:'50%', display:'inline-block' }}></span>CampusShare
    </div>
  )
}

// ── LIST ITEM MODAL ───────────────────────────────────────────────────────────
function ListItemModal({ open, onClose, onSuccess }) {
  const { user } = useApp()
  const titleRef = useRef(''), notesRef = useRef('')
  const [category, setCat]     = useState('Books')
  const [maxDays,  setMaxDays] = useState('7')
  const [ltype,    setLtype]   = useState('borrow')
  const [isPaid,   setPaid]    = useState(false)
  const [ppd,      setPpd]     = useState('')
  const [photos,   setPhotos]  = useState([])
  const [previews, setPreviews] = useState([])
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  function onPhotoPick(e) {
    const files = Array.from(e.target.files).slice(0,4)
    setPhotos(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function submit() {
    setErr(''); setLoading(true)
    const r = await api.listItem({
      title: titleRef.current, category,
      conditionNotes: notesRef.current,
      maxBorrowDays: maxDays,
      listingType: ltype,
      isPaid: isPaid ? 'true' : 'false',
      pricePerDay: isPaid ? ppd : '',
      photos,
    })
    setLoading(false)
    if (r.error) return setErr(r.error)
    onSuccess(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalTitle>List an item</ModalTitle>
      <ModalSub>Share something you're not using right now</ModalSub>
      <div style={{ ...OK, marginBottom:14 }}>✓ Verified: {user?.name} · {user?.roll_number} · {user?.college_name}</div>
      {err && <div style={ERR}>{err}</div>}

      {/* Listing type */}
      <div style={{ marginBottom:14 }}>
        <label style={LBL}>Listing type</label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[['borrow','📦 Lend / Borrow'],['lost_found','🔍 Lost & Found']].map(([val,label])=>(
            <button key={val} onClick={()=>setLtype(val)} style={{ padding:'10px', borderRadius:8, border:`1.5px solid ${ltype===val?ACCENT:'rgba(0,0,0,0.15)'}`, background:ltype===val?'#e9456010':'#fff', color:ltype===val?ACCENT:'#444', fontWeight:500, cursor:'pointer', fontSize:13 }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:14 }}><label style={LBL}>Item name</label><input style={INP} placeholder="e.g. Casio FX-991EX" defaultValue={titleRef.current} onChange={e=>titleRef.current=e.target.value} /></div>
      <div style={{ marginBottom:14 }}><label style={LBL}>Category</label><select style={INP} value={category} onChange={e=>setCat(e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
      <div style={{ marginBottom:14 }}><label style={LBL}>Condition notes</label><input style={INP} placeholder="e.g. Good condition, minor cover wear" defaultValue="" onChange={e=>notesRef.current=e.target.value} /></div>

      {ltype==='borrow' && <>
        <div style={{ marginBottom:14 }}>
          <label style={LBL}>Max borrow duration</label>
          <select style={INP} value={maxDays} onChange={e=>setMaxDays(e.target.value)}>
            {[['1','1 day'],['3','3 days'],['7','1 week'],['14','2 weeks']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Paid toggle */}
        <div style={{ marginBottom:14, padding:'12px', background:'#f9f9f6', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.1)' }}>
          <div style={{ ...row(10), marginBottom: isPaid?12:0 }}>
            <label style={{ ...row(8), cursor:'pointer', userSelect:'none', fontSize:13, fontWeight:500 }}>
              <input type="checkbox" checked={isPaid} onChange={e=>setPaid(e.target.checked)} style={{ width:16, height:16, accentColor:ACCENT }} />
              Paid rental
            </label>
            {!isPaid && <span style={{ fontSize:11, color:'#999', marginLeft:'auto' }}>Lender earns per day borrowed</span>}
          </div>
          {isPaid && (
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:13, color:'#444', fontWeight:500 }}>₹</span>
              <input style={INP} type="number" min="1" placeholder="e.g. 19" value={ppd} onChange={e=>setPpd(e.target.value)} />
              <div style={{ gridColumn:'1/-1', fontSize:11, color:'#888' }}>per day — borrower pays total before approval</div>
            </div>
          )}
        </div>
      </>}

      {/* Photo upload */}
      <div style={{ marginBottom:14 }}>
        <label style={LBL}>Photos (up to 4)</label>
        <input type="file" accept="image/*" multiple onChange={onPhotoPick} style={{ fontSize:12, color:'#666' }} />
        {previews.length > 0 && (
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
            {previews.map((p,i)=>(
              <img key={i} src={p} alt="" style={{ width:72, height:72, objectFit:'cover', borderRadius:8, border:'0.5px solid rgba(0,0,0,0.1)' }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ ...row(8), justifyContent:'flex-end', marginTop:16 }}>
        <button style={btn(false)} onClick={onClose}>Cancel</button>
        <button style={btn(true)} onClick={submit} disabled={loading}>{loading?'Listing…':'List Item'}</button>
      </div>
    </Modal>
  )
}

// ── BORROW / CLAIM MODAL ──────────────────────────────────────────────────────
function BorrowModal({ open, item, onClose, onSuccess, showToast }) {
  const { user } = useApp()
  const msgRef = useRef('')
  const [days, setDays]     = useState('3')
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)
  const tier = TRUST_TIERS[user?.trust_tier] || TRUST_TIERS.newcomer
  const isLostFound = item?.listing_type === 'lost_found'
  const totalCost = item?.is_paid ? (parseFloat(item.price_per_day) * parseInt(days)).toFixed(2) : null

  useEffect(() => { if (open) { setErr(''); setDays('3') } }, [open])

  async function submit() {
    setErr(''); setLoading(true)
    const r = await api.requestBorrow({ itemId:item.id, requestedDays:isLostFound?1:parseInt(days), message:msgRef.current })
    setLoading(false)
    if (r.error) return setErr(r.error)
    onSuccess()
    showToast(isLostFound ? 'Claim sent! Owner will review.' : item.is_paid ? `Request sent! You'll need to pay ₹${totalCost} to confirm.` : `Request sent to ${item.owner_name}!`)
    onClose()
  }

  if (!item) return null
  return (
    <Modal open={open} onClose={onClose}>
      <ModalTitle>{isLostFound ? 'Claim this item' : 'Request to borrow'}</ModalTitle>
      <ModalSub>{item.title} · from {item.owner_name}</ModalSub>
      {!isLostFound && <div style={{ ...row(6), ...OK, marginBottom:14 }}>✓ {tier.label} · {tier.limit} borrow slots</div>}
      {err && <div style={ERR}>{err}</div>}

      {!isLostFound && (
        <div style={{ marginBottom:14 }}>
          <label style={LBL}>Duration (max {item.max_borrow_days} days)</label>
          <select style={INP} value={days} onChange={e=>setDays(e.target.value)}>
            {[1,2,3,5,7,14].filter(d=>d<=item.max_borrow_days).map(d=><option key={d} value={d}>{d} day{d>1?'s':''}</option>)}
          </select>
        </div>
      )}

      {item.is_paid && !isLostFound && (
        <div style={{ marginBottom:14, padding:'12px', background:'#FAEEDA', borderRadius:8, border:'0.5px solid #F0997B' }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#854F0B', marginBottom:4 }}>💰 Paid rental</div>
          <div style={{ fontSize:13, color:'#854F0B' }}>₹{item.price_per_day}/day × {days} day{parseInt(days)>1?'s':''} = <strong>₹{totalCost}</strong></div>
          <div style={{ fontSize:11, color:'#993C1D', marginTop:4 }}>Pay this to the owner (cash/UPI) and then confirm payment in your Activity tab.</div>
        </div>
      )}

      <div style={{ marginBottom:14 }}>
        <label style={LBL}>{isLostFound ? 'Why do you think this is yours?' : 'Message (optional)'}</label>
        <input style={INP} placeholder={isLostFound ? 'Describe your item to prove ownership…' : 'e.g. Need for Wednesday exam'} defaultValue="" onChange={e=>msgRef.current=e.target.value} />
      </div>

      <div style={{ ...row(8), justifyContent:'flex-end', marginTop:16 }}>
        <button style={btn(false)} onClick={onClose}>Cancel</button>
        <button style={btn(true)} onClick={submit} disabled={loading}>{loading?'Sending…': isLostFound?'Send Claim':'Send Request'}</button>
      </div>
    </Modal>
  )
}

// ── ACTIVITY MODAL ────────────────────────────────────────────────────────────
function ActivityModal({ open, onClose, refresh, showToast }) {
  const { user, setUser } = useApp()
  const [tab, setTab]     = useState('borrowing')
  const [reqs, setReqs]   = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api.getMyRequests().then(r => { setLoading(false); if (!r.error) setReqs(r.requests||[]) })
  }, [open])

  async function reload() { const r=await api.getMyRequests(); if(!r.error) setReqs(r.requests||[]); refresh() }

 async function act(fn, ...args) {
  try {
    const res = await fn(...args)

    if (res?.error) {
      return res   // ❗ don't reload on error
    }

    await reload()
    return res

  } catch (err) {
    console.error(err)
    return { error: 'Something went wrong' }
  }
}

  const borrowing = reqs.filter(r=>r.borrower_id===user?.id)
  const lending   = reqs.filter(r=>r.owner_id===user?.id)
  const tier = TRUST_TIERS[user?.trust_tier]||TRUST_TIERS.newcomer
const activeCount = borrowing.filter(r =>
  ['active','selected'].includes(r.status)
).length

  function TabBtn({ id, label, count }) {
    return (
      <button style={{ padding:'5px 12px', borderRadius:6, border:'none', background:tab===id?ACCENT:'transparent', color:tab===id?'#fff':'#666', fontSize:12, fontWeight:500, cursor:'pointer' }}
        onClick={()=>setTab(id)}>{label}{count!==undefined?` (${count})`:''}</button>
    )
  }

  function ReqCard({ r, isBorrowing }) {
    const isPaid = r.is_paid
    const isLF   = r.listing_type === 'lost_found'
    return (
      <div style={{ border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:8, padding:12, marginBottom:8, background:'#f9f9f6' }}>
        <div style={{ ...row(8), marginBottom:8 }}>
          <Av user={isBorrowing ? { name:r.owner_name } : { avatar:r.borrower_avatar, color:r.borrower_color }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500 }}>{r.item_title}</div>
            <div style={{ fontSize:11, color:'#666' }}>
              {isBorrowing ? `from ${r.owner_name}` : r.borrower_name}
              {!isLF && ` · ${r.requested_days}d`}
              {isPaid && ` · ₹${r.total_amount}`}
              {r.message ? ` · "${r.message}"` : ''}
            </div>
          </div>
          <SBadge status={r.status} inline />
        </div>

        {/* Status-specific info */}
        {r.status==='active' && r.due_at && (
          <div style={{ fontSize:11, color:'#666', marginBottom:8 }}>
            Due: {new Date(r.due_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
            {new Date()>new Date(r.due_at) && <span style={{ color:'#c0392b', marginLeft:6 }}>⚠ Overdue</span>}
          </div>
        )}

        {/* Paid info for borrower */}
        {isBorrowing && r.status==='selected' && (
          <div style={{ padding:'8px 10px', background:'#FCEBEB', borderRadius:6, fontSize:12, color:'#A32D2D', marginBottom:8 }}>
            Pay <strong>₹{r.total_amount}</strong> to {r.owner_name} (cash or UPI), then click below.
          </div>
        )}

        {/* Action buttons */}
        <div style={row(6)}>
          {isBorrowing && r.status==='selected' && (
            <button style={btn(true,true)} onClick={async()=>{ const res=await act(api.confirmPayment,r.id); if(res&&!res.error) showToast('Payment confirmed! Waiting for owner approval.') }}>I've paid ₹{r.total_amount}</button>
          )}
          {!isBorrowing && r.status==='pending' && (
            <>
 <button
  style={btn(true,true)}
  onClick={async () => {
    try {
      const res = await api.approveRequest(r.id)

      console.log("APPROVE RESPONSE:", res)

      // 🔥 ONLY check for error
      if (res?.error) {
        showToast(res.error)
        return
      }

      // ✅ SUCCESS
      showToast('Approved successfully!')
      await reload()

    } catch (err) {
      console.error(err)
      showToast('Approval failed')
    }
  }}
>
  Approve
</button>
              <button style={btn(false,true)} onClick={async()=>{ await act(api.declineRequest,r.id); showToast('Declined.') }}>Decline</button>
              </>)}
              {!isBorrowing && r.status==='selected' && r.payment_confirmed && (
  <button
    style={btn(true,true)}
    onClick={async()=>{
      const res = await act(api.finalizeBorrow, r.id)
      if(res && !res.error){
        showToast('Borrow confirmed!')
        await reload()
      }
    }}
  >
    Confirm Payment
  </button>
)}
            
          
          {!isBorrowing && r.listing_type !== 'lost_found' && ['active','overdue'].includes(r.status) && (
          <button
  style={btn(true,true)}
  onClick={async () => {
    const res = await act(api.confirmReturn, r.id)
 
console.log("RETURN RESPONSE:", res)
if (!res || res.error) {
  showToast("Return failed")
  return
}
if (res.onTime === false) {
  showToast('Return confirmed (late).')
} else {
  showToast('Return confirmed!')
}

  }}
>
  Confirm return
</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} wide>
      <ModalTitle>My activity</ModalTitle>
      <div style={{ ...row(3), padding:4, background:'#f5f5f0', borderRadius:8, marginBottom:14 }}>
        <TabBtn id="borrowing" label="Borrowing" count={borrowing.length} />
        <TabBtn id="lending"   label="Lending"   count={lending.length} />
        <TabBtn id="profile"   label="Profile" />
      </div>

      {loading && <p style={{ fontSize:13, color:'#666', textAlign:'center', padding:'1.5rem 0' }}>Loading…</p>}

      {!loading && tab==='borrowing' && (
        <>
          <div style={{ ...row(6), marginBottom:10, fontSize:12, color:'#666' }}>
            <TierBadge tier={user?.trust_tier}/> {activeCount}/{tier.limit} slots used
          </div>
          {borrowing.length===0
            ? <p style={{ fontSize:13, color:'#999', textAlign:'center', padding:'1.5rem 0' }}>Nothing borrowed yet.</p>
            : borrowing.map(r=><ReqCard key={r.id} r={r} isBorrowing />)
          }
        </>
      )}

      {!loading && tab==='lending' && (
        <>
          {lending.length===0
            ? <p style={{ fontSize:13, color:'#999', textAlign:'center', padding:'1.5rem 0' }}>No lending activity. List an item!</p>
            : lending.map(r=><ReqCard key={r.id} r={r} isBorrowing={false} />)
          }
        </>
      )}

      {!loading && tab==='profile' && (
        <>
          <div style={{ ...row(12), marginBottom:16 }}>
            <Av user={user} size={44} />
            <div>
              <div style={{ fontWeight:500, fontSize:15 }}>{user?.name}</div>
              <div style={{ fontSize:12, color:'#666' }}>{user?.email}</div>
              <div style={{ fontSize:11, color:'#999', marginTop:2 }}>{user?.college_name}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {[
              ['Trust tier', <TierBadge tier={user?.trust_tier}/>],
              ['Borrow limit', `${tier.limit} items`],
              ['On-time returns', user?.return_count ?? 0],
              ['Roll number', user?.roll_number],
            ].map(([l,v])=>(
              <div key={l} style={{ background:'#f5f5f0', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:11, color:'#666', marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:14, fontWeight:500 }}>{v}</div>
              </div>
            ))}
          </div>
          {user?.trust_tier!=='rep' && (()=>{
            const next={newcomer:'regular',regular:'trusted',trusted:'rep'}[user.trust_tier]
            const thresholds={newcomer:0,regular:3,trusted:10,rep:25}
            const need=thresholds[next]-(user?.return_count||0)
            return <div style={{ fontSize:12, color:'#666', borderTop:'0.5px solid rgba(0,0,0,0.1)', paddingTop:12 }}>{need} more on-time return{need!==1?'s':''} to reach <TierBadge tier={next}/></div>
          })()}
        </>
      )}

      <div style={{ ...row(8), justifyContent:'flex-end', marginTop:16 }}>
        <button style={btn(true)} onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}

// ── ITEM CARD ─────────────────────────────────────────────────────────────────
function ItemCard({ item, currentUserId, onRequest, myRequests = [] }) {
  const isYours  = item.owner_id === currentUserId
  const isLF     = item.listing_type === 'lost_found'
  const alreadyRequested = myRequests.some(
  r => r.item_id === item.id &&
       ['pending','selected','active'].includes(r.status)
)
  const canAct = !isYours && !alreadyRequested && (isLF || item.status==='available')
  const firstPhoto = item.images?.[0]

  return (
    <div style={{ ...card, cursor:canAct?'pointer':'default' }} onClick={()=>canAct&&onRequest(item)}>
      {/* Thumbnail */}
      <div style={{ height:110, display:'flex', alignItems:'center', justifyContent:'center', background:firstPhoto?'#000':'#f5f5f0', position:'relative', overflow:'hidden' }}>
        {firstPhoto
          ? <img src={firstPhoto} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.92 }} />
          : <span style={{ fontSize:40 }}>{isLF?'🔍':EMOJIS[item.category]||'📦'}</span>
        }
        {isYours
          ? <span style={{ background:'#e9456015', color:ACCENT, fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:20, position:'absolute', top:8, right:8 }}>Yours</span>
          : isLF
            ? <span style={{ background:'#EEEDFE', color:'#534AB7', fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:20, position:'absolute', top:8, right:8 }}>Lost & Found</span>
            : <SBadge status={item.status} />
        }
        {item.is_paid && !isLF && (
          <span style={{ background:'#1a1a2e', color:'#fff', fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:20, position:'absolute', bottom:8, left:8 }}>₹{item.price_per_day}/day</span>
        )}
      </div>

      <div style={{ padding:12 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</div>
        <div style={{ fontSize:11, color:'#666', marginBottom:10 }}>{item.category}{!isLF?` · max ${item.max_borrow_days}d`:''}</div>
        <div style={{ ...row(0), justifyContent:'space-between' }}>
          <div style={{ ...row(5), fontSize:11, color:'#666' }}>
            <Av user={{ avatar:item.owner_avatar, color:item.owner_color, name:item.owner_name }} />
            {item.owner_name?.split(' ')[0]}
          </div>
          {isYours
            ? <span style={{ fontSize:10, color:'#aaa' }}>listed</span>
            : !canAct
              ? <span style={{ fontSize:10, color:'#aaa', opacity:.5 }}>Unavailable</span>
              : <span style={{ ...btn(true,true), display:'inline-block', pointerEvents:'none' }}>{isLF?'Claim':'Request'}</span>
          }
        </div>
      </div>
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,    setUser]   = useState(()=>api.getSavedUser())
  const [tab,     setTab]    = useState('marketplace') // 'marketplace' | 'lostfound'
  const [items,   setItems]  = useState([])
  const [stats,   setStats]  = useState({})
  const [cat,     setCat]    = useState('all')
  const [avail,   setAvail]  = useState('all')
  const [search,  setSearch] = useState('')
  const [listOpen,setList]   = useState(false)
  const [actOpen, setAct]    = useState(false)
  const [borrowItem, setBorrow] = useState(null)
  const [tick,    setTick]   = useState(0)
  const [toast,   showToast] = useToast()
  const [myRequests, setMyRequests] = useState([])
  const refresh = useCallback(()=>setTick(t=>t+1),[])

  useEffect(()=>{
    if (!user) return
   if (tab==='marketplace') {
  api.getItems({ 
    listingType: 'borrow', // ✅ ADD THIS
    category: cat!=='all' ? cat : undefined, 
    status: avail==='available' ? 'available' : undefined, 
    search: search || undefined 
  })
    .then(r=>{ if(!r.error) setItems(r.items||[]) })
} else {
api.getItems({ 
  listingType: 'lost_found',
  search: search || undefined 
})
    .then(r=>{ if(!r.error) setItems(r.items||[]) })
}
    api.getStats().then(r=>{ if(!r.error) setStats(r) })
      api.getMyRequests().then(r => {
  if (!r.error) setMyRequests(r.requests || [])
})
  },[user,tab,cat,avail,search,tick])

  function handleLogout() { api.clearSession(); setUser(null) }

  if (!user) return <AuthScreen onLogin={u=>setUser(u)} />

  const CAT_COUNTS = CATEGORIES.reduce((a,c)=>{ a[c]=items.filter(i=>i.category===c).length; return a },{})
  const tier = TRUST_TIERS[user.trust_tier] || TRUST_TIERS.newcomer

  return (
    <Ctx.Provider value={{ user, setUser }}>
      <style>{FONTS}</style>
      <div style={{ fontFamily:"'DM Sans',sans-serif", color:'#1a1a1a', minHeight:600, position:'relative' }}>

        {/* MODALS */}
        {listOpen   && <ListItemModal  open={listOpen}    onClose={()=>setList(false)}   onSuccess={refresh} />}
        {borrowItem && <BorrowModal    open={!!borrowItem} item={borrowItem}              onClose={()=>setBorrow(null)} onSuccess={refresh} showToast={showToast} />}
        {actOpen    && <ActivityModal  open={actOpen}     onClose={()=>setAct(false)}    refresh={refresh}   showToast={showToast} />}

        {/* HEADER */}
        <div style={{ ...row(0), justifyContent:'space-between', padding:'12px 20px', borderBottom:'0.5px solid rgba(0,0,0,0.1)', background:'#fff', flexWrap:'wrap', gap:8 }}>
          <Logo />
          <div style={row(8)}>
            <div style={{ ...row(6), fontSize:12, color:'#666' }}>
              <Av user={user} /> {user.name?.split(' ')[0]}
              <TierBadge tier={user.trust_tier}/>
              <span style={{ fontSize:11, color:'#aaa' }}>· {user.college_name}</span>
            </div>
            <button style={btn(false)} onClick={()=>setAct(true)}>Activity</button>
            <button style={btn(true)}  onClick={()=>setList(true)}>+ List Item</button>
            <button style={{ ...btn(false), fontSize:11 }} onClick={handleLogout}>Sign out</button>
          </div>
        </div>

        {/* HERO */}
        <div style={{ padding:'1.75rem 20px 1.25rem', borderBottom:'0.5px solid rgba(0,0,0,0.1)', background:'#fff' }}>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, letterSpacing:'-1px', lineHeight:1.1, margin:'0 0 4px' }}>
            Share more, <span style={{ color:ACCENT }}>spend less.</span>
          </h1>
          <p style={{ fontSize:13, color:'#666', margin:'0 0 1rem' }}>Borrow what you need. Lend what you don't. Showing items from <strong>{user.college_name}</strong> only.</p>

          {/* Section tabs */}
          <div style={{ ...row(4), marginBottom:'1rem' }}>
            {[['marketplace','📦 Marketplace'],['lostfound','🔍 Lost & Found']].map(([id,label])=>(
              <button key={id} onClick={()=>{setTab(id);setSearch('');setCat('all')}} style={{ padding:'7px 16px', borderRadius:8, border:`1.5px solid ${tab===id?ACCENT:'rgba(0,0,0,0.15)'}`, background:tab===id?ACCENT:'#fff', color:tab===id?'#fff':'#444', fontWeight:500, cursor:'pointer', fontSize:13 }}>{label}</button>
            ))}
          </div>

          <div style={{ ...row(8), maxWidth:540 }}>
            <input style={{ ...INP, flex:1 }} placeholder={tab==='marketplace'?'Search books, calculators, lab kits…':'Search lost & found…'}
              value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
        </div>

        {/* STATS */}
        <div style={{ ...row(0), gap:'2rem', padding:'10px 20px', borderBottom:'0.5px solid rgba(0,0,0,0.1)', background:'#f9f9f6', flexWrap:'wrap' }}>
          {[[stats.available,'available'],[stats.students,'students'],[stats.borrows,'borrows'],[stats.pending,'pending']].map(([n,l])=>(
            <div key={l} style={row(6)}>
              <span style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:l==='pending'?ACCENT:'#1a1a1a' }}>{n??'—'}</span>
              <span style={{ fontSize:12, color:'#666' }}>{l}</span>
            </div>
          ))}
        </div>

        {/* BODY */}
        <div style={{ display:'grid', gridTemplateColumns: tab==='marketplace'?'178px 1fr':'1fr' }}>

          {/* SIDEBAR — marketplace only */}
          {tab==='marketplace' && (
            <div style={{ borderRight:'0.5px solid rgba(0,0,0,0.1)', padding:'1.25rem 12px', background:'#fff' }}>
              <div style={{ fontSize:10, fontWeight:500, letterSpacing:'0.08em', color:'#999', textTransform:'uppercase', marginBottom:8 }}>Category</div>
              {[['all','All items',items.length],...CATEGORIES.map(c=>[c,c,CAT_COUNTS[c]])].map(([val,label,count])=>(
                <button key={val} onClick={()=>setCat(val)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', borderRadius:8, fontSize:12, cursor:'pointer', color:cat===val?ACCENT:'#1a1a1a', fontWeight:cat===val?500:400, background:cat===val?'#e9456012':'transparent', border:'none', width:'100%', textAlign:'left', marginBottom:2 }}>
                  <span>{label}</span>
                  <span style={{ fontSize:10, background:cat===val?'#e9456020':'#f5f5f0', color:cat===val?ACCENT:'#999', padding:'1px 6px', borderRadius:20 }}>{count}</span>
                </button>
              ))}
              <Divider />
              <div style={{ fontSize:10, fontWeight:500, letterSpacing:'0.08em', color:'#999', textTransform:'uppercase', marginBottom:8 }}>Availability</div>
              {[['all','Show all'],['available','Available now']].map(([val,label])=>(
                <button key={val} onClick={()=>setAvail(val)} style={{ display:'flex', padding:'6px 10px', borderRadius:8, fontSize:12, cursor:'pointer', color:avail===val?ACCENT:'#1a1a1a', fontWeight:avail===val?500:400, background:avail===val?'#e9456012':'transparent', border:'none', width:'100%', textAlign:'left', marginBottom:2 }}>{label}</button>
              ))}
            </div>
          )}

          {/* GRID */}
          <div style={{ padding:'1.25rem 20px' }}>
            <div style={{ ...row(0), justifyContent:'space-between', marginBottom:'1rem' }}>
              <span style={{ fontSize:13, color:'#666' }}>
                {tab==='lostfound' ? `${items.length} lost & found item${items.length!==1?'s':''}` : `${items.length} item${items.length!==1?'s':''}`}
              </span>
              <span style={{ fontSize:12, color:'#666' }}>Most recent</span>
            </div>

            {tab==='lostfound' && items.length===0 && (
              <div style={{ textAlign:'center', padding:'3rem 0' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:14, color:'#999', marginBottom:8 }}>No lost & found items yet.</div>
                <button style={btn(true)} onClick={()=>setList(true)}>Report a found item</button>
              </div>
            )}

            {items.length===0 && tab==='marketplace'
              ? <div style={{ textAlign:'center', padding:'3rem 0', color:'#999', fontSize:14 }}>No items match your filter.</div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(195px,1fr))', gap:14 }}>
{items
  .filter(item => item.status !== 'closed')
  .map(item =>
    <ItemCard 
      key={item.id+'-'+tick} 
      item={item} 
      currentUserId={user.id} 
      onRequest={i=>setBorrow(i)}
      myRequests={myRequests}   // 🔥 THIS IS THE FIX
    />
)}
                </div>
            }
          </div>
        </div>

        <Toast msg={toast} />
      </div>
    </Ctx.Provider>
  )
}
