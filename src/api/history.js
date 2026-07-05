// 추천 이력 — 최근에 보여준 상품(productId)을 기억해 같은 상품이 반복 추천되는 것을 막는다.
// 매번 똑같은 옷이 뜨면 추천이 "고장난 것처럼" 느껴지므로, 한 번 나온 상품은
// EXPIRE_DAYS 동안 후보에서 제외한다. 기기별 경험이라 localStorage에만 저장(계정 동기화 불필요).
const HISTORY_KEY = 'weatherwear_history'
const EXPIRE_DAYS = 4 // 4일 지나면 다시 추천 가능

export const getHistory = () => {
  const raw = localStorage.getItem(HISTORY_KEY)
  if (!raw) return []
  return JSON.parse(raw)
}

export const addHistory = (keyword) => {
  const history = getHistory()
  const now = new Date().getTime()
  history.push({ keyword, date: now })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

// 이 상품이 최근(4일 내) 추천된 적 있는가 — 상품 후보 필터링에 사용
export const isRecent = (keyword) => {
  const history = getHistory()
  const now = new Date().getTime()
  const expireMs = EXPIRE_DAYS * 24 * 60 * 60 * 1000
  return history.some(
    (h) => h.keyword === keyword && now - h.date < expireMs
  )
}

// 만료된 이력 정리 — 추천을 시작할 때 한 번 호출해 localStorage가 무한히 크는 것을 방지
export const cleanHistory = () => {
  const history = getHistory()
  const now = new Date().getTime()
  const expireMs = EXPIRE_DAYS * 24 * 60 * 60 * 1000
  const cleaned = history.filter((h) => now - h.date < expireMs)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(cleaned))
}