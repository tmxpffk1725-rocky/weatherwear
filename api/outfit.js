// Vercel 서버리스 함수 — LLM 코디 설계 (/api/outfit)
const { generateOutfit } = require('../lib/outfit')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  try {
    const presets = await generateOutfit(req.body || {})
    res.status(200).json({ presets })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
