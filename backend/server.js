// WeatherWear 백엔드 — 이메일/비밀번호 로그인 + 계정별 데이터(설정·옷장·찜) 동기화.
// 오라클 클라우드 VM에서 실행. 프론트(Vercel)는 이 API를 호출한다.
const crypto = require('crypto')
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const db = require('./db')
const { sendVerifyEmail } = require('./mailer')

const APP_URL = process.env.APP_URL || 'https://weatherwear-jade.vercel.app'

// 인증 결과 안내용 간단 HTML 페이지
const resultPage = (msg, ok) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WeatherWear 이메일 인증</title></head>
<body style="font-family:'Apple SD Gothic Neo',sans-serif;background:#fafafa;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="text-align:center;padding:32px">
<div style="font-size:22px;font-weight:800;color:#111;margin-bottom:14px">WeatherWear</div>
<div style="font-size:15px;color:${ok ? '#111' : '#c0392b'};margin-bottom:22px">${msg}</div>
<a href="${APP_URL}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px">앱으로 가기</a>
</div></body></html>`

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

app.post('/auth/signup', authLimiter, async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password || ''
  const name = (req.body?.name || '').trim()
  if (!validEmail(email)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' })
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' })
  // 이름은 프론트에서 필수 검증. 백엔드는 구버전 프론트 호환을 위해 비어 있어도 허용.
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (exists) return res.status(409).json({ error: '이미 가입된 이메일입니다.' })

  const hash = bcrypt.hashSync(password, 10)
  const now = Date.now()
  const verifyToken = crypto.randomBytes(24).toString('hex')
  const info = db.prepare('INSERT INTO users (email, password_hash, name, verify_token, created_at) VALUES (?, ?, ?, ?, ?)').run(email, hash, name, verifyToken, now)
  db.prepare('INSERT INTO user_data (user_id, settings, closet, favorites, updated_at) VALUES (?, NULL, NULL, NULL, ?)').run(info.lastInsertRowid, now)

  try {
    await sendVerifyEmail(email, verifyToken)
  } catch (e) {
    // 메일 실패 시 가입 롤백 → 재시도 가능
    db.prepare('DELETE FROM user_data WHERE user_id = ?').run(info.lastInsertRowid)
    db.prepare('DELETE FROM users WHERE id = ?').run(info.lastInsertRowid)
    console.error('인증 메일 발송 실패:', e.message)
    return res.status(500).json({ error: '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도하세요.' })
  }
  res.json({ message: '인증 메일을 보냈어요. 메일의 링크를 클릭한 뒤 로그인하세요.', email })
})

app.post('/auth/login', authLimiter, (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password || ''
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' })
  }
  if (!user.verified) {
    return res.status(403).json({ error: '이메일 인증이 필요해요. 메일의 링크를 확인하세요.', needVerify: true })
  }
  res.json({ token: signToken(user), email: user.email, name: user.name || '' })
})

// 인증 링크(메일 안 버튼). 클릭 시 verified=1 처리 후 안내 페이지 표시.
app.get('/auth/verify', (req, res) => {
  const token = req.query.token
  const user = token && db.prepare('SELECT * FROM users WHERE verify_token = ?').get(token)
  if (!user) return res.status(400).send(resultPage('인증 링크가 유효하지 않거나 이미 사용되었어요.', false))
  db.prepare('UPDATE users SET verified = 1, verify_token = NULL WHERE id = ?').run(user.id)
  res.send(resultPage('이메일 인증이 완료됐어요! 앱으로 돌아가 로그인하세요.', true))
})

// 인증 메일 재전송 (미인증 계정만). 존재 여부는 노출하지 않음.
app.post('/auth/resend', authLimiter, async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (user && !user.verified) {
    const verifyToken = crypto.randomBytes(24).toString('hex')
    db.prepare('UPDATE users SET verify_token = ? WHERE id = ?').run(verifyToken, user.id)
    try { await sendVerifyEmail(email, verifyToken) } catch (e) { console.error('재전송 실패:', e.message) }
  }
  res.json({ ok: true })
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
