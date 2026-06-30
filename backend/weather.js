// 기상청 단기예보를 서버에서 대신 호출 + 격자(nx,ny)별 캐시.
// 같은 지역 사용자들이 캐시를 공유해 기상청 호출 한도를 크게 절약하고, 키도 서버에만 둔다.
const KMA_KEY = process.env.KMA_KEY

const SLOT_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]
const pad = (n) => String(n).padStart(2, '0')

// VM 시간대(UTC 등)와 무관하게 KST 기준으로 발표 슬롯 계산
const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000)
const ymdUTC = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`

const candidateSlots = () => {
  const k = kstNow()
  const h = k.getUTCHours()
  const slots = []
  SLOT_HOURS.filter((x) => h >= x).sort((a, b) => b - a).forEach((x) => slots.push({ date: ymdUTC(k), time: pad(x) + '00' }))
  const y = new Date(k.getTime() - 24 * 3600 * 1000)
  ;[...SLOT_HOURS].sort((a, b) => b - a).forEach((x) => slots.push({ date: ymdUTC(y), time: pad(x) + '00' }))
  return slots.slice(0, 3)
}

const cache = new Map() // `${nx},${ny},${date},${time}` -> { at, data }
const TTL = 30 * 60 * 1000

const fetchSlot = async (nx, ny, date, time) => {
  const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst`
    + `?serviceKey=${KMA_KEY}&pageNo=1&numOfRows=100&dataType=JSON`
    + `&base_date=${date}&base_time=${time}&nx=${nx}&ny=${ny}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) { const e = new Error('upstream ' + res.status); e.status = res.status; throw e }
  const json = await res.json()
  const items = json?.response?.body?.items?.item
  if (!Array.isArray(items) || items.length === 0) throw new Error('no items')
  const tmp = items.find((i) => i.category === 'TMP')
  const sky = items.find((i) => i.category === 'SKY')
  const wsd = items.find((i) => i.category === 'WSD')
  const pty = items.find((i) => i.category === 'PTY')
  if (tmp?.fcstValue == null) throw new Error('no temp')
  const skyMap = { '1': '맑음', '3': '구름많음', '4': '흐림' }
  const ptyMap = { '1': '비', '2': '비/눈', '3': '눈', '4': '소나기' }
  const ptyVal = pty?.fcstValue
  const isRain = !!ptyVal && ptyVal !== '0'
  return {
    temp: Number(tmp.fcstValue),
    desc: isRain ? ptyMap[ptyVal] : (skyMap[sky?.fcstValue] ?? '--'),
    feel: Math.round(Number(tmp.fcstValue) - Number(wsd?.fcstValue ?? 0) * 1.5),
    rain: isRain,
  }
}

async function getWeather(nx, ny) {
  if (!KMA_KEY) throw new Error('KMA_KEY 미설정')
  const slots = candidateSlots()
  const key = `${nx},${ny},${slots[0].date},${slots[0].time}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.data

  let data = null
  let lastErr
  for (const s of slots) {
    try { data = await fetchSlot(nx, ny, s.date, s.time); break }
    catch (e) { lastErr = e; if (e.status) break } // HTTP 에러(429/5xx)는 즉시 중단(한도 절약)
  }
  if (!data) {
    if (hit) return hit.data // 장애/한도 시 오래된 캐시라도 제공
    throw lastErr || new Error('weather failed')
  }
  cache.set(key, { at: Date.now(), data })
  return data
}

module.exports = { getWeather }
