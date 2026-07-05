// 기상청 단기예보를 서버에서 대신 호출 + 격자(nx,ny)별 캐시.
// 같은 지역 사용자들이 캐시를 공유해 기상청 호출 한도를 크게 절약하고, 키도 서버에만 둔다.
// 회복력: 격자별 '마지막 성공 데이터'를 무기한 보관(파일 영속화)해 기상청 장애 시
// 502 대신 묵은 데이터(stale+asOf)를 제공하고, 일시 오류(순간 429·타임아웃)는 1회 재시도로 흡수.
const fs = require('fs')
const path = require('path')

const KMA_KEY = process.env.KMA_KEY

// 기상청 단기예보는 하루 8번, 정해진 시각(발표 슬롯)에만 발표된다.
// 조회할 때는 "가장 최근에 발표된 슬롯"을 base_date/base_time으로 지정해야 하며,
// 최신 슬롯이 아직 준비 전이면 그 이전 슬롯으로 물러나며 시도한다(candidateSlots).
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

// 격자별 마지막 성공 데이터 (TTL 없음). 재시작에도 살아남게 파일로 영속화.
const LAST_GOOD_FILE = path.join(__dirname, 'data', 'weather-last-good.json')
let lastGood = new Map() // `${nx},${ny}` -> { at, data }
try {
  lastGood = new Map(Object.entries(JSON.parse(fs.readFileSync(LAST_GOOD_FILE, 'utf8'))))
} catch { /* 파일 없음/손상 → 빈 상태로 시작 */ }

const persistLastGood = () => {
  try {
    fs.mkdirSync(path.dirname(LAST_GOOD_FILE), { recursive: true })
    fs.writeFileSync(LAST_GOOD_FILE, JSON.stringify(Object.fromEntries(lastGood)))
  } catch (e) { console.error('날씨 캐시 저장 실패:', e.message) }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const fetchSlot = async (nx, ny, date, time) => {
  // numOfRows를 넉넉히 둬서 같은 응답에 들어오는 일 최고/최저(TMX·TMN)까지 포함 (호출 수는 동일)
  const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst`
    + `?serviceKey=${KMA_KEY}&pageNo=1&numOfRows=300&dataType=JSON`
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
  // 최고/최저는 하루 한 번만 들어오고, 결측은 -999/-50 등으로 옴 → 유효값만 채택
  const findValid = (cat) => {
    const it = items.find((i) => i.category === cat && Number(i.fcstValue) > -900)
    return it ? Math.round(Number(it.fcstValue)) : null
  }
  const skyMap = { '1': '맑음', '3': '구름많음', '4': '흐림' }
  const ptyMap = { '1': '비', '2': '비/눈', '3': '눈', '4': '소나기' }
  const ptyVal = pty?.fcstValue
  const isRain = !!ptyVal && ptyVal !== '0'
  return {
    temp: Number(tmp.fcstValue),
    desc: isRain ? ptyMap[ptyVal] : (skyMap[sky?.fcstValue] ?? '--'),
    feel: Math.round(Number(tmp.fcstValue) - Number(wsd?.fcstValue ?? 0) * 1.5),
    rain: isRain,
    pop: findValid('POP'),  // 강수확률(%)
    reh: findValid('REH'),  // 습도(%)
    tmx: findValid('TMX'),  // 일 최고기온
    tmn: findValid('TMN'),  // 일 최저기온
  }
}

const trySlots = async (nx, ny, slots) => {
  let lastErr
  for (const s of slots) {
    try { return await fetchSlot(nx, ny, s.date, s.time) }
    catch (e) { lastErr = e; if (e.status) break } // HTTP 에러(429/5xx)는 다음 슬롯도 실패 확률 높음 → 중단(한도 절약)
  }
  throw lastErr || new Error('weather failed')
}

async function getWeather(nx, ny) {
  if (!KMA_KEY) throw new Error('KMA_KEY 미설정')
  const slots = candidateSlots()
  const key = `${nx},${ny},${slots[0].date},${slots[0].time}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return { ...hit.data, asOf: hit.at, stale: false }

  let data = null
  try {
    data = await trySlots(nx, ny, slots)
  } catch {
    // 공공데이터포털의 순간 튕김(간헐 429·타임아웃) 흡수: 1.5초 뒤 딱 1회 재시도
    await sleep(1500)
    try {
      data = await trySlots(nx, ny, slots)
    } catch (err) {
      // 그래도 실패 → 마지막 성공 데이터라도 제공 (프론트가 '○분 전 날씨'로 표시)
      const lg = lastGood.get(`${nx},${ny}`)
      if (lg) return { ...lg.data, asOf: lg.at, stale: true }
      throw err
    }
  }
  const now = Date.now()
  cache.set(key, { at: now, data })
  lastGood.set(`${nx},${ny}`, { at: now, data })
  persistLastGood()
  return { ...data, asOf: now, stale: false }
}

module.exports = { getWeather }
