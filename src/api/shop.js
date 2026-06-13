import axios from 'axios'
import { isRecent, addHistory, cleanHistory } from './history'

const getKeywords = (temp, situation, gender, preferredItems) => {
  const situationMap = {
    '출근': '오피스',
    '데이트': '데이트',
    '캐주얼': '캐주얼',
    '운동': '운동'
  }
  const situation_keyword = situationMap[situation] ?? ''

  const pick = (category) => {
    const items = preferredItems[category]
    if (!items || items.length === 0) return ''
    return items[Math.floor(Math.random() * items.length)]
  }

  return [
    pick('top') ? `${gender} ${pick('top')} ${situation_keyword}` : '',
    pick('bottom') ? `${gender} ${pick('bottom')} ${situation_keyword}` : '',
    pick('outer') ? `${gender} ${pick('outer')} ${situation_keyword}` : '',
    pick('shoes') ? `${gender} ${pick('shoes')}` : '',
  ]
}

const fetchOne = async (query) => {
  if (!query) return null
  const response = await axios.get('http://localhost:3001/api/shop', {
    params: { query, display: 10 }
  })
  const items = response.data.items
  if (!items || items.length === 0) return null
  const filtered = items.filter((item) => !isRecent(item.productId))
  return filtered.length > 0 ? filtered : items
}

export const fetchOutfitPresets = async (temp, situation, gender, preferredItems) => {
  cleanHistory()
  const keywords = getKeywords(temp, situation, gender, preferredItems)
  const [tops, bottoms, outers, shoes] = await Promise.all(
    keywords.map((kw) => fetchOne(kw))
  )

  const presets = []
  for (let i = 0; i < 3; i++) {
    const preset = {
      id: i + 1,
      top: tops?.[i] ?? null,
      bottom: bottoms?.[i] ?? null,
      outer: outers?.[i] ?? null,
      shoes: shoes?.[i] ?? null,
    }

    if (preset.top) addHistory(preset.top.productId)
    if (preset.bottom) addHistory(preset.bottom.productId)
    if (preset.outer) addHistory(preset.outer.productId)
    if (preset.shoes) addHistory(preset.shoes.productId)

    presets.push(preset)
  }

  return presets
}