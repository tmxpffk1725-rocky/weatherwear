import axios from 'axios'
import { getCurrentLocation } from './location'

const API_KEY = decodeURIComponent('ad271f9567ec831f9278bafa6882d81b5670b2bf48384b9a54ad7e480a292c32')

const getBaseTime = () => {
  const now = new Date()
  const hours = now.getHours()
  const times = [2, 5, 8, 11, 14, 17, 20, 23]
  let baseHour = times[0]
  for (let t of times) {
    if (hours >= t) baseHour = t
  }
  return String(baseHour).padStart(2, '0') + '00'
}

const getBaseDate = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

export const fetchWeather = async () => {
  const { nx, ny, lat, lon } = await getCurrentLocation()

  const baseDate = getBaseDate()
  const baseTime = getBaseTime()

  const response = await axios.get(
    'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
    {
      params: {
        serviceKey: API_KEY,
        pageNo: 1,
        numOfRows: 100,
        dataType: 'JSON',
        base_date: baseDate,
        base_time: baseTime,
        nx,
        ny,
      }
    }
  )

  const items = response.data.response.body.items.item
  const tmp = items.find(i => i.category === 'TMP')
  const sky = items.find(i => i.category === 'SKY')
  const wsd = items.find(i => i.category === 'WSD')
  const pty = items.find(i => i.category === 'PTY')

  const skyMap = { '1': '맑음', '3': '구름많음', '4': '흐림' }
  const ptyMap = { '1': '비', '2': '비/눈', '3': '눈', '4': '소나기' }
  const ptyVal = pty?.fcstValue
  const isRain = !!ptyVal && ptyVal !== '0'

let locationName = '현재 위치'
  try {
    const geoRes = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`
    )
    const addr = geoRes.data.address
    locationName = addr.city_district || addr.suburb || addr.city || addr.town || '현재 위치'
  } catch (e) {
    console.error('주소 변환 실패:', e)
  }

  return {
    temp: tmp?.fcstValue ?? '--',
    desc: isRain ? ptyMap[ptyVal] : (skyMap[sky?.fcstValue] ?? '--'),
    feel: Math.round(tmp?.fcstValue - wsd?.fcstValue * 1.5),
    rain: isRain,
    lat,
    lon,
    location: locationName,
  }
}