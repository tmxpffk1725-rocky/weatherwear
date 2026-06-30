// 오라클 백엔드(계정/동기화) 호출 클라이언트. 토큰은 localStorage에 보관.
const API_BASE = import.meta.env.VITE_API_BASE || 'https://161.33.11.111.nip.io'
const TOKEN_KEY = 'weatherwear_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

const req = async (path, { method = 'GET', body, auth = false } = {}) => {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (auth) {
    const t = getToken()
    if (t) headers.Authorization = `Bearer ${t}`
  }
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || '요청 실패')
  return data
}

export const signup = async (email, password) => {
  const { token, email: e } = await req('/auth/signup', { method: 'POST', body: { email, password } })
  setToken(token)
  return e
}

export const login = async (email, password) => {
  const { token, email: e } = await req('/auth/login', { method: 'POST', body: { email, password } })
  setToken(token)
  return e
}

// 토큰 유효성 확인 → 이메일 반환(실패 시 throw)
export const me = () => req('/auth/me', { auth: true }).then((d) => d.email)

// 계정 데이터 전체 로드 {settings, closet, favorites}
export const fetchState = () => req('/api/state', { auth: true })

export const saveSettings = (value) => req('/api/settings', { method: 'PUT', auth: true, body: { value } })
export const saveCloset = (value) => req('/api/closet', { method: 'PUT', auth: true, body: { value } })
export const saveFavorites = (value) => req('/api/favorites', { method: 'PUT', auth: true, body: { value } })
