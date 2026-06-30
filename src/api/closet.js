// 옷장 항목을 추천(LLM)에 넘길 형태로 변환.
// 데이터는 계정(백엔드)에서 불러와 App 상태로 관리되며, 여기서는 매핑만 한다.

// 옷장 카테고리(한국어) → 추천 카테고리(영문)
const CATEGORY_MAP = { 상의: 'top', 하의: 'bottom', 신발: 'shoes', 아우터: 'outer' }

// AI에 넘길 형태: 짧은 id(인덱스) + 영문 카테고리 + 이름 + 색
// (id로 보유 옷을 다시 찾을 수 있어야 하므로 원본 배열과 같은 순서를 유지)
export const closetForAI = (items = []) =>
  items.map((it, i) => ({
    id: String(i),
    category: CATEGORY_MAP[it.category] || '',
    name: it.name,
    color: it.color,
  }))
