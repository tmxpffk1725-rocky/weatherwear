require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())

// API 키는 환경변수에서 읽는다 (.env, gitignore됨 / Vercel은 환경변수 설정)
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET

app.get('/api/shop', async (req, res) => {
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

app.listen(3001, () => {
  console.log('서버 실행 중: http://localhost:3001')
})
