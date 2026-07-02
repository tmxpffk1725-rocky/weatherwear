// 추천 API(/api/outfit, /api/shop) 보호 — JWT 검증 + 계정별 일일 호출 상한.
// Vercel 서버리스 함수와 로컬 server.js가 공유한다.
// JWT_SECRET은 백엔드(오라클 VM)와 같은 값을 Vercel env에 넣는다 — 서명 검증만 하므로
// 백엔드와 통신할 필요가 없다.
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET
// Vercel 배포 환경에서는 시크릿 미설정 시 fail-closed, 로컬 개발(server.js)은 검증 생략
const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'

// 계정별 일일 카운터. 서버리스 인스턴스 메모리라 인스턴스별 best-effort지만,
// 단일 계정이 뚫을 수 있는 호출량의 상한을 만드는 게 목적이다.
let quotaDay = ''
let counts = new Map()

// 검증 통과 시 토큰 payload({uid,...}) 반환, 실패 시 응답을 보내고 null 반환.
const guard = (req, res, name, dailyLimit) => {
  let user
  if (!JWT_SECRET) {
    if (isProd) {
      res.status(500).json({ error: '서버 설정 오류: JWT_SECRET 미설정' })
      return null
    }
    user = { uid: 'dev' } // 로컬 개발: 시크릿 없으면 검증 생략
  } else {
    const h = req.headers.authorization || ''
    const token = h.startsWith('Bearer ') ? h.slice(7) : null
    if (!token) {
      res.status(401).json({ error: '로그인이 필요합니다.' })
      return null
    }
    try {
      user = jwt.verify(token, JWT_SECRET)
    } catch {
      res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인하세요.' })
      return null
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  if (today !== quotaDay) {
    quotaDay = today
    counts = new Map()
  }
  const key = `${user.uid}:${name}`
  const n = (counts.get(key) || 0) + 1
  counts.set(key, n)
  if (n > dailyLimit) {
    res.status(429).json({ error: '오늘 사용량을 초과했습니다. 내일 다시 이용해주세요.' })
    return null
  }
  return user
}

module.exports = { guard }
