// 추천 API(/api/outfit, /api/shop, /api/vision) 보호 — JWT 검증 + 계정별 일일 호출 상한.
// Vercel 서버리스 함수와 로컬 server.js가 공유한다.
//
// 왜 필요한가: 이 API들은 호출마다 돈이 드는 외부 서비스(Claude·네이버)를 부른다.
// UI 로그인만으로는 curl 직접 호출로 우회할 수 있으므로, 함수 자체에서 토큰을 검증한다.
//
// 핵심 아이디어: JWT는 "서명 검증"만으로 진위를 확인할 수 있다.
// 백엔드(오라클 VM)가 발급한 토큰을 Vercel이 검증하려면 서명 비밀키(JWT_SECRET)만
// 같으면 되고, 두 서버가 서로 통신할 필요가 전혀 없다 — 그래서 같은 값을 양쪽 env에 둔다.
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET
// Vercel 배포 환경에서는 시크릿 미설정 시 fail-closed, 로컬 개발(server.js)은 검증 생략
const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'

// 계정별 일일 카운터. 서버리스 인스턴스 메모리라 인스턴스가 여러 개면 각자 세지만
// (엄밀한 전역 카운트가 아님), 단일 계정이 뚫을 수 있는 호출량의 "상한"을 만드는 게
// 목적이라 이 정도면 충분하다 — 정확한 과금용 카운트가 필요해지면 그때 DB로 옮긴다.
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
