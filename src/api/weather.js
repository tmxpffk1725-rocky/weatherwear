import axios from 'axios'
import { getCurrentLocation } from './location'

const API_KEY = decodeURIComponent('ad271f9567ec831f9278bafa6882d81b5670b2bf48384b9a54ad7e480a292c32')
const CACHE_KEY = 'weather_cache'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

// 발표 슬롯 후보(최신→과거). 미발표/일시오류 대비로 여러 개 시도.
const baseSlots = () => {
  const times = [2, 5, 8, 11, 14, 17, 20, 23]
  const now = new Date()
  const slots = []
  times.filter((t) => now.getHours() >= t).sort((a, b) => b - a)
    .forEach((t) => slots.push({ date: ymd(now), time: pad(t) + '00' }))
  const y = new Date(now); y.setDate(y.getDate() - 1)
  ;[...times].sort((a, b) => b - a).forEach((t) => slots.push({ date: ymd(y), time: pad(t) + '00' }))
  return slots.slice(0, 4)
}

const requestForecast = async (nx, ny, baseDate, baseTime) => {
  const response = await axios.get(
    'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
    {
      params: { serviceKey: API_KEY, pageNo: 1, numOfRows: 100, dataType: 'JSON', base_date: baseDate, base_time: baseTime, nx, ny },
      timeout: 8000,
    }
  )
  const items = response.data?.response?.body?.items?.item
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
    temp: tmp.fcstValue,
    desc: isRain ? ptyMap[ptyVal] : (skyMap[sky?.fcstValue] ?? '--'),
    feel: Math.round(tmp.fcstValue - (wsd?.fcstValue ?? 0) * 1.5),
    rain: isRain,
  }
}

export const getCachedWeather = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const cacheWeather = (w) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...w, cachedAt: Date.now() })) } catch { /* 용량 등 무시 */ }
}

const reverseGeocode = async (lat, lon) => {
  try {
    const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`)
    const addr = res.data.address
    return addr.city_district || addr.suburb || addr.city || addr.town || '현재 위치'
  } catch {
    return '현재 위치'
  }
}

export const fetchWeather = async () => {
  const { nx, ny, lat, lon } = await getCurrentLocation()
  // 여러 발표 슬롯을 순서대로 시도(일시 오류·미발표 대비)
  let core = null
  let lastErr
  for (const slot of baseSlots()) {
    try { core = await requestForecast(nx, ny, slot.date, slot.time); break }
    catch (e) { lastErr = e }
  }
  if (!core) throw lastErr || new Error('weather failed')
  const location = await reverseGeocode(lat, lon)
  const result = { ...core, lat, lon, location }
  cacheWeather(result)
  return result
}
