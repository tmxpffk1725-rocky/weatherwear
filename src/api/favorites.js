// 찜한 코디 헬퍼 — 순수 함수(주어진 배열을 받아 새 배열 반환).
// 실제 저장은 App 상태 + 백엔드 동기화가 담당한다.

// 코디 1세트를 식별하는 id (4개 상품 productId 조합)
const presetKey = (preset) => {
  if (!preset) return ''
  return ['top', 'bottom', 'outer', 'shoes']
    .map((cat) => preset[cat]?.productId ?? '-')
    .join('|')
}

// 렌더에 필요한 필드만 추림 (보유 옷은 productId 없이 name/color 유지)
const slimItem = (item) => {
  if (!item) return null
  return {
    title: item.title,
    image: item.image,
    link: item.link,
    lprice: item.lprice,
    mallName: item.mallName,
    productId: item.productId,
    owned: item.owned,
    name: item.name,
    color: item.color,
  }
}

export const isFavorite = (favorites, preset) => {
  const id = presetKey(preset)
  if (!id) return false
  return favorites.some((f) => f.id === id)
}

export const removeFavorite = (favorites, id) => favorites.filter((f) => f.id !== id)

// 저장/해제 토글. meta = { situation, temp }
export const toggleFavorite = (favorites, preset, meta = {}) => {
  const id = presetKey(preset)
  if (!id) return favorites
  if (favorites.some((f) => f.id === id)) return removeFavorite(favorites, id)

  const entry = {
    id,
    savedAt: Date.now(),
    situation: meta.situation ?? '',
    temp: meta.temp ?? '',
    items: {
      top: slimItem(preset.top),
      bottom: slimItem(preset.bottom),
      outer: slimItem(preset.outer),
      shoes: slimItem(preset.shoes),
    },
  }
  return [entry, ...favorites]
}
