import axios from 'axios'
import { getToken } from './backend'

// 추천 API와 동일하게 로그인 토큰 필요 (비용 어뷰징 방어)
const authHeaders = () => {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// 사진을 긴 변 1024px JPEG로 축소 — 전송량(서버리스 바디 한도)·비전 토큰 비용을 줄인다.
// 반환: 데이터 URL (썸네일 표시와 base64 추출에 함께 사용)
const MAX_EDGE = 1024

export const downscalePhoto = async (file) => {
  const bitmap = await createImageBitmap(file) // EXIF 회전 반영
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

// 사진 1장 분석 → { category, color, name } (실패 시 throw — 호출부에서 빈 폼으로 폴백)
export const analyzeClothing = async (dataUrl) => {
  const image = dataUrl.split(',')[1]
  const response = await axios.post('/api/vision', { image, mediaType: 'image/jpeg' }, { headers: authHeaders() })
  return response.data?.item || null
}
