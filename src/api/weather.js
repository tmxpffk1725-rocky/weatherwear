// 날씨 조회 (프론트) — 흐름: GPS → 격자 변환 → 백엔드 날씨 프록시 → 동네명 붙여 반환.
//
// 기상청을 직접 부르지 않고 우리 백엔드를 거치는 이유:
//  1) API 키를 브라우저에 노출하지 않기 위해 (서버에만 보관)
//  2) 같은 격자(지역) 사용자들이 서버 캐시를 공유해 기상청 호출 한도를 절약
//  3) 발표 슬롯 계산·재시도·장애 폴백(stale) 같은 복잡한 로직을 서버 한 곳에 모으기 위해
//
// 기기 캐시(localStorage)는 "서버까지 실패했을 때"의 마지막 안전망이다.
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

// 위경도 → 동네 이름 (OpenStreetMap Nominatim 무료 역지오코딩).
// 표시용일 뿐이라 실패해도 '현재 위치'로 대체하고 날씨 자체는 계속 진행한다.
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
