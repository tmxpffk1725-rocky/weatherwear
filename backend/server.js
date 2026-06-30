// WeatherWear 백엔드 — 이메일/비밀번호 로그인 + 계정별 데이터(설정·옷장·찜) 동기화.
// 오라클 클라우드 VM에서 실행. 프론트(Vercel)는 이 API를 호출한다.
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const db = require('./db')

const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('JWT_SECRET 환경변수가 필요합니다.')
  process.exit(1)
}
// 허용 출처(쉼표 구분). 미설정 시 로컬 개발만 허용.
const ORIGINS = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean)

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cors({ origin: ORIGINS }))

// --- 인증 ---
const signToken = (user) => jwt.sign({ uid: user.id, email: user.email, name: user.name || '' }, JWT_SECRET, { expiresIn: '30d' })

const authRequired = (req, res, next) => {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인하세요.' })
  }
}

// 회원가입/로그인 무차별 대입 방지
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false })

const validEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

app.post('/auth/signup', authLimiter, (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password || ''
  const name = (req.body?.name || '').trim()
  if (!validEmail(email)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' })
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' })
  if (!name) return res.status(400).json({ error: '이름을 입력하세요.' })
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (exists) return res.status(409).json({ error: '이미 가입된 이메일입니다.' })

  const hash = bcrypt.hashSync(password, 10)
  const now = Date.now()
  const info = db.prepare('INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)').run(email, hash, name, now)
  const user = { id: info.lastInsertRowid, email, name }
  db.prepare('INSERT INTO user_data (user_id, settings, closet, favorites, updated_at) VALUES (?, NULL, NULL, NULL, ?)').run(user.id, now)
  res.json({ token: signToken(user), email, name })
})

app.post('/auth/login', authLimiter, (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password || ''
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' })
  }
  res.json({ token: signToken(user), email: user.email, name: user.name || '' })
})

app.get('/auth/me', authRequired, (req, res) => {
  res.json({ email: req.user.email, name: req.user.name || '' })
})

// --- 데이터 동기화 (계정별 설정·옷장·찜) ---
const parse = (s, fallback) => { try { return s ? JSON.parse(s) : fallback } catch { return fallback } }

app.get('/api/state', authRequired, (req, res) => {
  const row = db.prepare('SELECT settings, closet, favorites FROM user_data WHERE user_id = ?').get(req.user.uid)
  res.json({
    settings: parse(row?.settings, null),
    closet: parse(row?.closet, []),
    favorites: parse(row?.favorites, []),
  })
})

const saveField = (field) => (req, res) => {
  const value = JSON.stringify(req.body?.value ?? null)
  db.prepare(`UPDATE user_data SET ${field} = ?, updated_at = ? WHERE user_id = ?`).run(value, Date.now(), req.user.uid)
  res.json({ ok: true })
}
app.put('/api/settings', authRequired, saveField('settings'))
app.put('/api/closet', authRequired, saveField('closet'))
app.put('/api/favorites', authRequired, saveField('favorites'))

app.get('/health', (req, res) => res.json({ ok: true }))

app.listen(PORT, '127.0.0.1', () => console.log(`weatherwear backend on :${PORT}`))
