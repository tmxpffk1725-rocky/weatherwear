import axios from 'axios'
import { getCurrentLocation } from './location'
import { getWeather } from './backend'

const CACHE_KEY = 'weather_cache'

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
  // 날씨는 우리 백엔드 프록시(서버 캐시)로. 발표슬롯·재시도·기상청 키는 서버가 처리.
  const core = await getWeather(nx, ny)
  const location = await reverseGeocode(lat, lon)
  const result = { ...core, lat, lon, location }
  cacheWeather(result)
  return result
}
