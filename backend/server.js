// WeatherWear 백엔드 — 이메일/비밀번호 로그인 + 계정별 데이터(설정·옷장·찜) 동기화 + 날씨 프록시.
// 오라클 클라우드 VM에서 systemd로 상시 실행. 프론트(Vercel)는 이 API를 호출한다.
//
// 보안 설계 요약 (포트폴리오 질문 대비):
//  · 비밀번호: bcrypt 해시로만 저장 — 해시는 되돌릴 수 없어 DB가 유출돼도 원문을 모른다.
//    bcrypt는 일부러 느린 알고리즘이라 무차별 대입도 비현실적.
//  · 로그인 상태: JWT(서명된 토큰, 30일). 서버는 세션을 저장하지 않고(무상태)
//    요청마다 토큰 서명을 JWT_SECRET으로 검증해 사용자를 식별한다.
//  · 무차별 대입 방어: 인증 관련 엔드포인트에 rate limit(15분 30회).
//  · 네트워크: 앱은 127.0.0.1에만 바인딩하고, 외부 노출은 Caddy(자동 HTTPS)가 대신한다.
//  · CORS: 허용한 프론트 출처(FRONTEND_ORIGINS)만 브라우저 호출 가능.
const crypto = require('crypto')
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const db = require('./db')
const { sendVerifyEmail, sendCodeEmail, sendResetEmail } = require('./mailer')
const { getWeather } = require('./weather')

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
// JWT 발급: payload(uid·email·name)를 JWT_SECRET으로 서명. 클라이언트가 위조하면 서명이 깨진다.
const signToken = (user) => jwt.sign({ uid: user.id, email: user.email, name: user.name || '' }, JWT_SECRET, { expiresIn: '30d' })

// 보호 라우트용 미들웨어: Authorization: Bearer <토큰> 검증 → req.user에 payload 주입
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

// --- 가입 전 이메일 인증번호 (메모리 보관 — 재시작 시 소멸, 다시 요청하면 됨) ---
const CODE_TTL = 10 * 60 * 1000 // 10분
const CODE_MAX_ATTEMPTS = 5
const signupCodes = new Map() // email → { code, expires, attempts, verified }

// 인증번호 발송: 계정 생성 전에 이메일 소유를 확인한다 (오타 이메일로 계정 선점 방지)
app.post('/auth/send-code', authLimiter, async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  if (!validEmail(email)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' })
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (exists) return res.status(409).json({ error: '이미 가입된 이메일입니다.' })

  const code = String(crypto.randomInt(100000, 1000000))
  signupCodes.set(email, { code, expires: Date.now() + CODE_TTL, attempts: 0, verified: false })
  try {
    await sendCodeEmail(email, code)
  } catch (e) {
    signupCodes.delete(email)
    console.error('인증번호 발송 실패:', e.message)
    return res.status(500).json({ error: '인증코드 발송에 실패했습니다. 잠시 후 다시 시도하세요.' })
  }
  res.json({ ok: true })
})

// 인증번호 확인 (5회 초과 시 재요청 필요)
app.post('/auth/verify-code', authLimiter, (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const code = String(req.body?.code || '').trim()
  const entry = signupCodes.get(email)
  if (!entry || entry.expires < Date.now()) {
    return res.status(400).json({ error: '인증코드가 만료됐어요. 다시 요청하세요.' })
  }
  if (entry.attempts >= CODE_MAX_ATTEMPTS) {
    signupCodes.delete(email)
    return res.status(400).json({ error: '시도 횟수를 초과했어요. 인증코드를 다시 요청하세요.' })
  }
  if (entry.code !== code) {
    entry.attempts += 1
    return res.status(400).json({ error: '인증코드가 올바르지 않습니다.' })
  }
  entry.verified = true
  entry.expires = Date.now() + CODE_TTL // 인증 후 가입 완료까지 10분 연장
  res.json({ ok: true })
})

// 가입: 인증번호 확인을 마친 이메일만 허용 → verified 계정으로 생성하고 즉시 로그인
app.post('/auth/signup', authLimiter, (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password || ''
  const name = (req.body?.name || '').trim()
  if (!validEmail(email)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' })
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' })
  // 이름은 프론트에서 필수 검증. 백엔드는 구버전 프론트 호환을 위해 비어 있어도 허용.
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (exists) return res.status(409).json({ error: '이미 가입된 이메일입니다.' })

  const entry = signupCodes.get(email)
  if (!entry || !entry.verified || entry.expires < Date.now()) {
    return res.status(403).json({ error: '이메일 인증을 먼저 완료해주세요.' })
  }
  signupCodes.delete(email)

  const hash = bcrypt.hashSync(password, 10)
  const now = Date.now()
  const info = db.prepare('INSERT INTO users (email, password_hash, name, verified, created_at) VALUES (?, ?, ?, 1, ?)').run(email, hash, name, now)
  db.prepare('INSERT INTO user_data (user_id, settings, closet, favorites, updated_at) VALUES (?, NULL, NULL, NULL, ?)').run(info.lastInsertRowid, now)

  const user = { id: info.lastInsertRowid, email, name }
  res.json({ token: signToken(user), email, name })
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

// --- 비밀번호 재설정 ---
const RESET_TTL = 60 * 60 * 1000 // 1시간

// 재설정 메일 요청. 계정 존재 여부는 노출하지 않고 항상 ok.
app.post('/auth/forgot', authLimiter, async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const user = validEmail(email) && db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (user && user.verified) {
    const resetToken = crypto.randomBytes(24).toString('hex')
    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?')
      .run(resetToken, Date.now() + RESET_TTL, user.id)
    try { await sendResetEmail(email, resetToken) } catch (e) { console.error('재설정 메일 실패:', e.message) }
  }
  res.json({ ok: true })
})

// 새 비밀번호 입력 폼 (메일 링크). 토큰은 서버 생성 hex라 그대로 삽입해도 안전.
const resetFormPage = (token) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WeatherWear 비밀번호 재설정</title></head>
<body style="font-family:'Apple SD Gothic Neo',sans-serif;background:#fafafa;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<form id="f" style="text-align:center;padding:32px;max-width:320px;width:100%">
<div style="font-size:22px;font-weight:800;color:#111;margin-bottom:6px">WeatherWear</div>
<div style="font-size:14px;color:#444;margin-bottom:20px">새 비밀번호를 입력하세요</div>
<input id="pw" type="password" placeholder="새 비밀번호 (6자 이상)" minlength="6" required autocomplete="new-password"
  style="display:block;width:100%;box-sizing:border-box;padding:12px;margin-bottom:10px;border:1px solid #ddd;border-radius:10px;font-size:14px">
<input id="pw2" type="password" placeholder="새 비밀번호 확인" required autocomplete="new-password"
  style="display:block;width:100%;box-sizing:border-box;padding:12px;margin-bottom:14px;border:1px solid #ddd;border-radius:10px;font-size:14px">
<div id="msg" style="font-size:13px;color:#c0392b;margin-bottom:12px"></div>
<button style="width:100%;background:#111;color:#fff;border:0;padding:13px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer">비밀번호 변경</button>
</form>
<script>
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault()
  const pw = document.getElementById('pw').value
  const msg = document.getElementById('msg')
  if (pw !== document.getElementById('pw2').value) { msg.textContent = '비밀번호가 일치하지 않습니다.'; return }
  try {
    const r = await fetch('/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '${token}', password: pw }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { msg.textContent = d.error || '변경에 실패했습니다.'; return }
    document.body.innerHTML = '<div style="text-align:center;padding:32px">'
      + '<div style="font-size:22px;font-weight:800;color:#111;margin-bottom:14px">WeatherWear</div>'
      + '<div style="font-size:15px;color:#111;margin-bottom:22px">비밀번호가 변경됐어요! 새 비밀번호로 로그인하세요.</div>'
      + '<a href="${APP_URL}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px">앱으로 가기</a></div>'
  } catch { msg.textContent = '네트워크 오류가 발생했습니다.' }
})
</script></body></html>`

app.get('/auth/reset', (req, res) => {
  const token = req.query.token
  const user = token && db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token)
  if (!user || !user.reset_expires || user.reset_expires < Date.now()) {
    return res.status(400).send(resultPage('재설정 링크가 유효하지 않거나 만료됐어요. 앱에서 다시 요청하세요.', false))
  }
  res.send(resetFormPage(token))
})

app.post('/auth/reset', authLimiter, (req, res) => {
  const { token, password } = req.body || {}
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' })
  }
  const user = token && db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token)
  if (!user || !user.reset_expires || user.reset_expires < Date.now()) {
    return res.status(400).json({ error: '재설정 링크가 유효하지 않거나 만료됐어요. 앱에서 다시 요청하세요.' })
  }
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?')
    .run(bcrypt.hashSync(password, 10), user.id)
  res.json({ ok: true })
})

// --- 회원 탈퇴 (비밀번호 재확인, 계정+데이터 영구 삭제) ---
const deleteAccount = db.transaction((uid) => {
  db.prepare('DELETE FROM user_data WHERE user_id = ?').run(uid)
  db.prepare('DELETE FROM users WHERE id = ?').run(uid)
})

app.delete('/auth/account', authRequired, (req, res) => {
  const password = req.body?.password || ''
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid)
  if (!user) return res.status(404).json({ error: '계정을 찾을 수 없습니다.' })
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' })
  }
  deleteAccount(user.id)
  res.json({ ok: true })
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

// 날씨 프록시 (격자별 서버 캐시). 로그인 사용자만.
app.get('/api/weather', authRequired, async (req, res) => {
  const nx = parseInt(req.query.nx, 10)
  const ny = parseInt(req.query.ny, 10)
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return res.status(400).json({ error: '좌표가 필요합니다.' })
  try {
    res.json(await getWeather(nx, ny))
  } catch (e) {
    console.error('날씨 프록시 실패:', e.message)
    res.status(502).json({ error: '날씨를 불러오지 못했습니다.' })
  }
})

app.get('/health', (req, res) => res.json({ ok: true }))

app.listen(PORT, '127.0.0.1', () => console.log(`weatherwear backend on :${PORT}`))
