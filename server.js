require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { generateOutfit } = require('./lib/outfit')
const { analyzeClothing } = require('./lib/vision')
const { guard } = require('./lib/auth')

const app = express()
app.use(cors())
// 사진 분석(/api/vision)의 base64 이미지가 기본 한도(100kb)를 넘으므로 상향
app.use(express.json({ limit: '6mb' }))

// API 키는 환경변수에서 읽는다 (.env, gitignore됨 / Vercel은 환경변수 설정)
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET

app.get('/api/shop', async (req, res) => {
  if (!guard(req, res, 'shop', 600)) return
  const { query, display = 10 } = req.query
  try {
    const url =
      'https://openapi.naver.com/v1/search/shop.json' +
      `?query=${encodeURIComponent(query)}&display=${encodeURIComponent(display)}&sort=sim`
    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
    })
    const data = await response.json()
    res.status(response.ok ? 200 : response.status).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/outfit', async (req, res) => {
  if (!guard(req, res, 'outfit', 50)) return
  try {
    const presets = await generateOutfit(req.body || {})
    res.json({ presets })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/vision', async (req, res) => {
  if (!guard(req, res, 'vision', 60)) return
  const { image, mediaType } = req.body || {}
  if (!image) return res.status(400).json({ error: 'image(base64)가 필요합니다.' })
  try {
    const item = await analyzeClothing(image, mediaType)
    res.json({ item })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(3001, () => {
  console.log('서버 실행 중: http://localhost:3001')
})
