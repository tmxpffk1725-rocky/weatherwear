// Vercel 서버리스 함수 — LLM 코디 설계 (/api/outfit)
// Vercel은 api/ 폴더의 파일 하나하나가 곧 HTTP 엔드포인트가 된다 (별도 서버 불필요).
// 실제 로직은 lib/outfit.js에 있고, 이 파일은 인증·상한 검사 후 위임하는 얇은 껍데기.
const { generateOutfit } = require('../lib/outfit')
const { guard } = require('../lib/auth')

// 계정당 하루 LLM 호출 상한. 정상 사용은 결과가 30분 캐시되므로 하루 수 회 수준.
const DAILY_LIMIT = 50

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  if (!guard(req, res, 'outfit', DAILY_LIMIT)) return
  try {
    const presets = await generateOutfit(req.body || {})
    res.status(200).json({ presets })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
