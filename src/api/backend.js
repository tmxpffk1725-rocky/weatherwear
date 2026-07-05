// 오라클 백엔드(계정·동기화·날씨) 호출 클라이언트.
//
// 이 앱의 서버는 두 곳으로 나뉜다:
//  · 오라클 VM 백엔드(이 파일) — 인증, 계정 데이터(설정·옷장·찜), 날씨 프록시.
//    DB(SQLite)가 있어야 해서 상시 실행 서버가 필요 → 무료 VM에 배치.
//  · Vercel 서버리스(api/*.js) — AI 추천·상품검색·사진분석. DB가 필요 없는
//    프록시성 작업이라 프론트와 같은 곳(Vercel)에 함수로 배치.
//
// 로그인 토큰(JWT)은 localStorage에 보관하고 모든 인증 요청에 Bearer로 첨부.
// 서버는 세션을 저장하지 않는다(무상태) — 토큰 서명 검증만으로 사용자를 식별.
const API_BASE = import.meta.env.VITE_API_BASE || 'https://161.33.11.111.nip.io'
const TOKEN_KEY = 'weatherwear_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

// 공통 요청 헬퍼 — auth: true면 저장된 토큰을 Authorization 헤더로 첨부
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

// 가입 전 이메일 인증번호 발송(중복이면 409) / 확인(10분·5회 제한)
export const sendCode = (email) => req('/auth/send-code', { method: 'POST', body: { email } })
export const verifyCode = (email, code) => req('/auth/verify-code', { method: 'POST', body: { email, code } })

// 가입 (인증번호 확인을 마친 이메일만) → 즉시 로그인. 반환: { email, name }
export const signup = async (email, password, name) => {
  const { token, email: e, name: n } = await req('/auth/signup', { method: 'POST', body: { email, password, name } })
  setToken(token)
  return { email: e, name: n }
}

// 인증 메일 재전송 (레거시 미인증 계정용)
export const resend = (email) => req('/auth/resend', { method: 'POST', body: { email } })

export const login = async (email, password) => {
  const { token, email: e, name: n } = await req('/auth/login', { method: 'POST', body: { email, password } })
  setToken(token)
  return { email: e, name: n }
}

// 비밀번호 재설정 메일 요청 (계정 존재 여부와 무관하게 항상 ok)
export const forgot = (email) => req('/auth/forgot', { method: 'POST', body: { email } })

// 회원 탈퇴 — 비밀번호 재확인 후 계정+데이터 영구 삭제
export const deleteAccount = (password) => req('/auth/account', { method: 'DELETE', auth: true, body: { password } })

// 토큰 유효성 확인 → {email, name} 반환(실패 시 throw)
export const me = () => req('/auth/me', { auth: true })

// 계정 데이터 전체 로드 {settings, closet, favorites}
export const fetchState = () => req('/api/state', { auth: true })

// 날씨(서버 프록시 + 캐시). {temp, feel, desc, rain} 반환
export const getWeather = (nx, ny) => req(`/api/weather?nx=${nx}&ny=${ny}`, { auth: true })

export const saveSettings = (value) => req('/api/settings', { method: 'PUT', auth: true, body: { value } })
export const saveCloset = (value) => req('/api/closet', { method: 'PUT', auth: true, body: { value } })
export const saveFavorites = (value) => req('/api/favorites', { method: 'PUT', auth: true, body: { value } })
