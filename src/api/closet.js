// 옷장 보유 옷 읽기 (ClosetPage가 localStorage['closet_items']에 저장)
// 추천(LLM)에 "보유 옷 활용 + 부족분만 구매 추천"을 위해 옷장을 읽어 AI 친화 형태로 변환.

// 옷장 카테고리(한국어) → 추천 카테고리(영문)
const CATEGORY_MAP = { 상의: 'top', 하의: 'bottom', 신발: 'shoes', 아우터: 'outer' }

export const getCloset = () => {
  try {
    const saved = localStorage.getItem('closet_items')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

// AI에 넘길 형태: 짧은 id(인덱스) + 영문 카테고리 + 이름 + 색
// (id로 보유 옷을 다시 찾을 수 있어야 하므로 getCloset()과 같은 순서를 유지)
export const getClosetForAI = () =>
  getCloset().map((it, i) => ({
    id: String(i),
    category: CATEGORY_MAP[it.category] || '',
    name: it.name,
    color: it.color,
  }))
