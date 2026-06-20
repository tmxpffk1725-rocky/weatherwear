// Vercel 서버리스 함수 — 네이버 쇼핑 검색 프록시 (/api/shop)
// API 키는 코드에 두지 않고 Vercel 환경변수(NAVER_CLIENT_ID/SECRET)에서 읽는다.
module.exports = async (req, res) => {
  const { query, display = 10 } = req.query
  if (!query) {
    res.status(400).json({ error: 'query is required' })
    return
  }
  try {
    const url =
      'https://openapi.naver.com/v1/search/shop.json' +
      `?query=${encodeURIComponent(query)}&display=${encodeURIComponent(display)}&sort=sim`
    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
      },
    })
    const data = await response.json()
    res.status(response.ok ? 200 : response.status).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
