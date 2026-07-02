// Vercel 서버리스 함수 — 옷 사진 분석 (/api/vision)
const { analyzeClothing } = require('../lib/vision')
const { guard } = require('../lib/auth')

// 계정당 하루 분석 상한. 옷장 첫 등록(수십 장)도 감당하되 어뷰징은 막는 수준.
const DAILY_LIMIT = 60

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  if (!guard(req, res, 'vision', DAILY_LIMIT)) return
  const { image, mediaType } = req.body || {}
  if (!image) {
    res.status(400).json({ error: 'image(base64)가 필요합니다.' })
    return
  }
  try {
    const item = await analyzeClothing(image, mediaType)
    res.status(200).json({ item })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
