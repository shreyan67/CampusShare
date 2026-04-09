const BASE = import.meta.env.VITE_API_URL || '/api'

const getToken = () => localStorage.getItem('cs_token')
const saveToken = t => localStorage.setItem('cs_token', t)
const saveUser  = u => localStorage.setItem('cs_user', JSON.stringify(u))
export const clearSession = () => { localStorage.removeItem('cs_token'); localStorage.removeItem('cs_user') }
export const getSavedUser = () => { try { return JSON.parse(localStorage.getItem('cs_user') || 'null') } catch { return null } }

async function req(method, path, body) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let fetchOpts = { method, headers }

  if (body instanceof FormData) {
    fetchOpts.body = body
  } else if (body) {
    headers['Content-Type'] = 'application/json'
    fetchOpts.body = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, fetchOpts)

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
// 🔥 DEV OTP CAPTURE
if (data && data.devOtp) {
  window.__DEV_OTP__ = data.devOtp
  console.log("DEV OTP:", data.devOtp)
}
  // 🔥 IMPORTANT FIX
  if (!res.ok) {
    return { error: data?.error || 'Request failed' }
  }

  // 🔥 ENSURE SUCCESS STRUCTURE
  return data || { success: true }
}

const get   = p      => req('GET',    p)
const post  = (p, b) => req('POST',   p, b)
const patch = (p, b) => req('PATCH',  p, b)
const del   = p      => req('DELETE', p)

// Auth
export const signup = (name, email, roll) =>
  post('/auth/signup', {
    name,
    email,
    rollNumber: roll,
    
  })
export const verifyOtp = (userId, otp)              => post('/auth/verify-otp', { userId, otp })
export const login     = email                      => post('/auth/login',       { email })
export const getMe     = ()                         => get('/users/me')
export function saveSession(token, user) { saveToken(token); saveUser(user) }

// Items
export const getItems     = f => get('/items?' + new URLSearchParams(clean(f)))
export const getLostFound = f => get('/items/lostfound?' + new URLSearchParams(clean(f)))
export const getStats     = () => get('/items/stats')
export const deleteItem   = id => del(`/items/${id}`)
export function listItem(data) {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => {
    if (k === 'photos') { (v || []).forEach(f => fd.append('photos', f)) }
    else if (v !== undefined && v !== null) fd.append(k, v)
  })
  return req('POST', '/items', fd)
}

// Requests
export const getMyRequests    = ()  => get('/requests/mine')
export const requestBorrow    = b   => post('/requests', b)
export const confirmPayment   = id  => patch(`/requests/${id}/confirm-payment`)
export const finalizeBorrow   = id => patch(`/requests/${id}/finalize`)
export const approveRequest   = id  => patch(`/requests/${id}/approve`)
export const declineRequest   = id  => patch(`/requests/${id}/decline`)
export const confirmReturn    = id  => patch(`/requests/${id}/return`)

function clean(obj) {
  const out = {}
  Object.entries(obj || {}).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') out[k] = v })
  return out
}
