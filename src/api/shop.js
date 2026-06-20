import axios from 'axios'
import { isRecent, addHistory, cleanHistory } from './history'
import { getSolarTerm } from './season'

const CATEGORIES = ['top', 'bottom', 'outer', 'shoes']

const situationMap = {
  '출근': '오피스',
  '데이트': '데이트',
  '캐주얼': '캐주얼',
  '운동': '운동',
}

// 체감온도(℃) 기준 아이템별 적정 구간 [min, max]
// (기온별 옷차림 가이드를 앱 아이템 어휘에 맞춰 정리 — 필요하면 자유롭게 조정)
const TEMP_RANGE = {
  top: {
    '반팔': [23, 40],
    '가디건': [13, 23],
    '맨투맨': [12, 22],
    '후드티': [11, 22],
    '니트': [8, 20],
    '두꺼운니트': [-10, 11],
    '기모티셔츠': [-10, 9],
  },
  bottom: {
    '반바지': [23, 40],
    '치노팬츠': [17, 28],
    '슬랙스': [9, 27],
    '청바지': [5, 23],
    '조거팬츠': [9, 23],
    '기모바지': [-10, 9],
  },
  outer: {
    '바람막이': [12, 21],
    '얇은자켓': [12, 20],
    '트렌치코트': [9, 17],
    '가죽자켓': [8, 17],
    '코트': [4, 12],
    '패딩': [-10, 9],
  },
  shoes: {
    '샌들': [23, 40],
    '스니커즈': [5, 40],
    '로퍼': [8, 28],
    '구두': [5, 28],
    '부츠': [-10, 13],
    '어그부츠': [-10, 8],
  },
}

const inRange = (category, item, temp) => {
  const r = TEMP_RANGE[category]?.[item]
  if (!r) return true // 표에 없는 아이템은 일단 허용
  return temp >= r[0] && temp <= r[1]
}

// 카테고리별 '날씨에 맞는' 후보 아이템 목록
const seasonalItems = (category, temp, preferredItems, rain) => {
  // 1) 선호 아이템 중 체감온도에 맞는 것
  let cands = (preferredItems[category] || []).filter((i) => inRange(category, i, temp))
  // 2) 선호 중 적정한 게 없으면 전체 목록에서 적정한 것으로 폴백
  if (cands.length === 0) {
    cands = Object.keys(TEMP_RANGE[category] || {}).filter((i) => inRange(category, i, temp))
  }
  // 3) 비 보정
  if (rain) {
    if (category === 'shoes') {
      cands = cands.filter((i) => i !== '샌들' && i !== '어그부츠')
    }
    if (category === 'outer') {
      const water = cands.filter((i) => ['바람막이', '트렌치코트', '코트'].includes(i))
      if (water.length) cands = water
    }
  }
  return cands
}

// 검색어 = 성별 + 아이템 + 절기 시즌 키워드 + (신발 외)상황 키워드
const makeQuery = (category, item, gender, situationKeyword, season) =>
  category === 'shoes'
    ? `${gender} ${item} ${season}`.replace(/\s+/g, ' ').trim()
    : `${gender} ${item} ${season} ${situationKeyword}`.replace(/\s+/g, ' ').trim()

// 프리셋 3개 × 카테고리별 검색어 생성 (후보를 돌려가며 다양화)
const buildPresetQueries = (temp, situation, gender, preferredItems, rain) => {
  const situationKeyword = situationMap[situation] ?? ''
  const season = getSolarTerm().season // 오늘 절기 기준 시즌 키워드(봄/여름/가을/겨울)
  const cands = {}
  CATEGORIES.forEach((c) => {
    cands[c] = seasonalItems(c, temp, preferredItems, rain)
  })

  const presets = []
  for (let i = 0; i < 3; i++) {
    const queries = {}
    CATEGORIES.forEach((c) => {
      const list = cands[c]
      queries[c] = list.length
        ? makeQuery(c, list[i % list.length], gender, situationKeyword, season)
        : ''
    })
    presets.push(queries)
  }
  return presets
}

// 네이버 분류(category3)와 제목을 함께 보고 상품의 실제 카테고리를 판별.
// '운동' 검색은 상·하의가 모두 category3='트레이닝복'으로 묶여 분류만으론 부족하므로
// 제목 키워드(반바지/쇼츠/팬츠 등)로 보강한다. (상의 칸에 반바지가 들어오는 문제 해결)
const TOP_C3 = ['티셔츠', '니트', '셔츠', '맨투맨', '후드', '카디건', '가디건', '남방', '스웨터', '폴로', '피케']
const OUTER_C3 = ['아우터', '코트', '자켓', '재킷', '점퍼', '패딩', '야상', '바람막이']
const BOTTOM_C3 = ['바지', '데님', '레깅스']
const BOTTOM_TITLE = ['반바지', '쇼츠', '쇼트', '팬츠', '바지', '슬랙스', '레깅스', '타이즈', '데님', '조거']
const TOP_TITLE = ['티셔츠', '반팔티', '긴팔티', '니트', '맨투맨', '후드', '카디건', '셔츠', '스웨터', '이너']

const classify = (item) => {
  const c2 = item.category2 || ''
  const c3 = item.category3 || ''
  const title = (item.title || '').replace(/<[^>]+>/g, '')
  if (c2.includes('신발')) return 'shoes'
  if (OUTER_C3.some((k) => c3.includes(k))) return 'outer'
  if (BOTTOM_C3.some((k) => c3.includes(k))) return 'bottom'
  if (TOP_C3.some((k) => c3.includes(k))) return 'top'
  // category3가 모호한 경우(트레이닝복 등) 제목으로 판별
  const isBottom = BOTTOM_TITLE.some((w) => title.includes(w))
  const isTop = TOP_TITLE.some((w) => title.includes(w))
  if (isTop && !isBottom) return 'top'
  if (isBottom && !isTop) return 'bottom'
  return null // 상·하의가 섞여 애매하면 제외
}

const fetchOne = async (query, category) => {
  if (!query) return null
  const response = await axios.get('http://localhost:3001/api/shop', {
    params: { query, display: 10 }
  })
  const items = response.data.items
  if (!items || items.length === 0) return null
  // 1) 실제 카테고리가 일치하는 상품만 (없으면 그 칸은 비움 — 엉뚱한 카테고리 노출 방지)
  const matched = items.filter((item) => classify(item) === category)
  if (matched.length === 0) return null
  // 2) 최근 추천한 상품 제외
  const fresh = matched.filter((item) => !isRecent(item.productId))
  return fresh.length > 0 ? fresh : matched
}

export const fetchOutfitPresets = async (temp, situation, gender, preferredItems, rain = false) => {
  cleanHistory()

  const t = parseInt(temp, 10)
  const presetQueries = buildPresetQueries(t, situation, gender, preferredItems, rain)

  // 검색어 → 카테고리 매핑 (중복 검색어는 한 번만 호출)
  const queryCategory = {}
  presetQueries.forEach((p) => {
    CATEGORIES.forEach((c) => { if (p[c]) queryCategory[p[c]] = c })
  })
  const uniqueQueries = Object.keys(queryCategory)
  const resultMap = {}
  await Promise.all(
    uniqueQueries.map(async (q) => { resultMap[q] = await fetchOne(q, queryCategory[q]) })
  )

  // 같은 검색어를 여러 프리셋이 쓰면 서로 다른 상품을 소비하도록 커서 유지
  const cursor = {}
  const takeNext = (query) => {
    const list = query ? resultMap[query] : null
    if (!list || list.length === 0) return null
    const idx = cursor[query] ?? 0
    cursor[query] = idx + 1
    return list[idx] ?? list[list.length - 1]
  }

  return presetQueries.map((queries, i) => {
    const preset = {
      id: i + 1,
      top: takeNext(queries.top),
      bottom: takeNext(queries.bottom),
      outer: takeNext(queries.outer),
      shoes: takeNext(queries.shoes),
    }
    CATEGORIES.forEach((c) => {
      if (preset[c]) addHistory(preset[c].productId)
    })
    return preset
  })
}
