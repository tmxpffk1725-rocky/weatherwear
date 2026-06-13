const HISTORY_KEY = 'weatherwear_history'
const EXPIRE_DAYS = 4

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

export const isRecent = (keyword) => {
  const history = getHistory()
  const now = new Date().getTime()
  const expireMs = EXPIRE_DAYS * 24 * 60 * 60 * 1000
  return history.some(
    (h) => h.keyword === keyword && now - h.date < expireMs
  )
}

export const cleanHistory = () => {
  const history = getHistory()
  const now = new Date().getTime()
  const expireMs = EXPIRE_DAYS * 24 * 60 * 60 * 1000
  const cleaned = history.filter((h) => now - h.date < expireMs)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(cleaned))
}