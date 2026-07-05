// 옷장 등록과 추천 코디가 공유하는 색 팔레트 (이름 → hex)
//
// 왜 "닫힌" 팔레트인가: 색을 자유 입력으로 받으면 ① 색칩(hex 매핑)이 깨지고
// ② 추천이 보유 옷 색과 매칭을 못 하고 ③ 네이버 검색어가 희귀해진다.
// 그래서 AI(추천·비전)도 이 18색 안에서만 고르도록 프롬프트로 강제한다.
// ⚠️ lib/outfit.js·lib/vision.js의 프롬프트 허용 색 목록과 이름을 일치시킬 것.
export const COLORS = [
  { name: '블랙', hex: '#111111' },
  { name: '화이트', hex: '#ffffff' },
  { name: '그레이', hex: '#9aa0a6' },
  { name: '네이비', hex: '#2a3b5e' },
  { name: '베이지', hex: '#d9c6a5' },
  { name: '브라운', hex: '#6f4e37' },
  { name: '카키', hex: '#6b6b3a' },
  { name: '블루', hex: '#3b6fd6' },
  { name: '그린', hex: '#3a7d44' },
  { name: '레드', hex: '#c0392b' },
  { name: '핑크', hex: '#e58fa8' },
  { name: '옐로우', hex: '#e6c34a' },
  { name: '와인', hex: '#722f37' },
  { name: '민트', hex: '#9fd8cb' },
  { name: '퍼플', hex: '#7d5ba6' },
  { name: '오렌지', hex: '#e2823a' },
  { name: '아이보리', hex: '#f2ecdc' },
  { name: '차콜', hex: '#3a3d40' },
]

export const COLOR_HEX = Object.fromEntries(COLORS.map((c) => [c.name, c.hex]))
