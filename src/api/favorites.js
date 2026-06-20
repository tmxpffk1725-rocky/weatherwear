const FAVORITES_KEY = 'weatherwear_favorites'

// 코디 1세트를 식별하는 id (4개 상품 productId 조합)
const presetKey = (preset) => {
  if (!preset) return ''
  return ['top', 'bottom', 'outer', 'shoes']
    .map((cat) => preset[cat]?.productId ?? '-')
    .join('|')
}

// 렌더에 필요한 필드만 추림
const slimItem = (item) => {
  if (!item) return null
  return {
    title: item.title,
    image: item.image,
    link: item.link,
    lprice: item.lprice,
    mallName: item.mallName,
    productId: item.productId,
  }
}

export const getFavorites = () => {
  const raw = localStorage.getItem(FAVORITES_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

const save = (favorites) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
}

export const isFavorite = (preset) => {
  const id = presetKey(preset)
  if (!id) return false
  return getFavorites().some((f) => f.id === id)
}

export const removeFavorite = (id) => {
  const next = getFavorites().filter((f) => f.id !== id)
  save(next)
  return next
}

// 저장/해제 토글. meta = { situation, temp }
export const toggleFavorite = (preset, meta = {}) => {
  const id = presetKey(preset)
  if (!id) return getFavorites()

  const favorites = getFavorites()
  if (favorites.some((f) => f.id === id)) {
    return removeFavorite(id)
  }

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
  const next = [entry, ...favorites]
  save(next)
  return next
}
