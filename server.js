const express = require('express')
const cors = require('cors')
const axios = require('axios')

const app = express()
app.use(cors())

const NAVER_CLIENT_ID = '9K9uQADED3a7z1ntmr1s'
const NAVER_CLIENT_SECRET = 'oUagCgMbJY'
app.get('/api/shop', async (req, res) => {
  const { query } = req.query
  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/shop.json', {
      params: {
        query,
        display: 10,
        sort: 'sim'
      },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      }
    })
    res.json(response.data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(3001, () => {
  console.log('서버 실행 중: http://localhost:3001')
})