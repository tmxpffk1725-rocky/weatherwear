// 로컬 개발용 프록시 서버 (배포 환경에는 없음)
//
// 배포에서는 api/*.js가 Vercel 서버리스 함수로 돌지만, 로컬 `npm run dev`에는
// Vercel이 없으므로 이 Express 서버(3001)가 같은 엔드포인트(/api/shop·outfit·vision)를
// 대신 제공한다. Vite 프록시가 프론트의 /api 요청을 여기로 넘겨주므로,
// 프론트 코드는 로컬/배포 구분 없이 항상 상대경로로 호출하면 된다.
// 핵심 로직은 lib/를 공유하므로 두 환경의 동작이 갈라질 일이 없다.
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
