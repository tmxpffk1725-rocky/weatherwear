import axios from 'axios'
import { isRecent, addHistory, cleanHistory } from './history'
import { getSolarTerm } from './season'
import { getToken } from './backend'

// 추천 API(/api/shop, /api/outfit)는 로그인 토큰을 요구한다 (비용 어뷰징 방어)
const authHeaders = () => {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const CATEGORIES = ['top', 'bottom', 'outer', 'shoes']

// 추천 결과 캐시: 같은 조건(체감온도·상황·설정·옷장 등)이면 LLM/네이버 재호출 없이
// 즉시 반환한다. 탭 복귀·상황 재선택·앱 재방문 때 ~7초 대기를 제거. (localStorage, 30분 TTL)
const CACHE_KEY = 'outfit_cache'
const CACHE_TTL = 30 * 60 * 1000
const CACHE_MAX = 12

const cacheRead = (key) => {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const hit = all[key]
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.presets
  } catch { /* 캐시 깨졌으면 무시 */ }
  return null
}

const cacheWrite = (key, presets) => {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    all[key] = { at: Date.now(), presets }
    // TTL 지난 항목 제거 + 최신순 CACHE_MAX개만 유지
    const now = Date.now()
    const fresh = Object.entries(all)
      .filter(([, v]) => now - v.at < CACHE_TTL)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, CACHE_MAX)
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(fresh)))
  } catch { /* 용량 초과 등은 무시 */ }
}

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
  // 상대경로: 로컬은 Vite 프록시(→localhost:3001), 배포(Vercel)는 동일 도메인의 서버리스 함수
  const response = await axios.get('/api/shop', {
    params: { query, display: 10 },
    headers: authHeaders(),
  })
  const items = response.data.items
  if (!items || items.length === 0) return null
  // 1) 카테고리 일치 우선. 단, 분류가 하나도 안 맞으면 검색 결과를 그대로 사용한다.
  //    (LLM이 이미 해당 아이템으로 검색어를 만들었으므로, 셔츠자켓·블레이저처럼
  //     분류기가 다른 카테고리로 잡는 하이브리드도 빈 칸이 되지 않게 함)
  const matched = items.filter((item) => classify(item) === category)
  const pool = matched.length > 0 ? matched : items
  // 2) 최근 추천한 상품 제외
  const fresh = pool.filter((item) => !isRecent(item.productId))
  return fresh.length > 0 ? fresh : pool
}

// LLM에게 코디 설계 요청 (실패 시 호출부에서 룰 기반으로 폴백)
const fetchOutfitPlan = async (feel, rain, situation, gender, preferredItems, tone, fit, closet, day) => {
  const season = getSolarTerm().season
  const response = await axios.post('/api/outfit', {
    feel, rain, season, situation, gender, preferred: preferredItems, tone, fit, closet,
    // 하루 범위(일 최저/최고기온, 강수확률) — 하루종일 입을 한 벌 설계용
    dayMin: day?.min ?? null, dayMax: day?.max ?? null, rainProb: day?.pop ?? null,
  }, { headers: authHeaders() })
  const presets = response.data?.presets
  if (!Array.isArray(presets) || presets.length === 0) throw new Error('empty plan')
  return presets
}

export const fetchOutfitPresets = async (temp, situation, gender, preferredItems, rain = false, tone = '', fit = '', closet = [], day = {}) => {
  cleanHistory()
  const t = parseInt(temp, 10)
  const season = getSolarTerm().season

  // 0) 동일 조건 캐시 적중 시 즉시 반환 (LLM/네이버 재호출 생략)
  const cacheKey = JSON.stringify({ t, rain, situation, gender, tone, fit, season, preferredItems, closet, day })
  const cached = cacheRead(cacheKey)
  if (cached) return cached

  // 1) LLM이 코디 설계 → 실패(키 미설정/오류) 시 룰 기반 폴백
  let plan
  try {
    plan = await fetchOutfitPlan(t, rain, situation, gender, preferredItems, tone, fit, closet, day)
  } catch {
    plan = buildPresetQueries(t, situation, gender, preferredItems, rain)
  }

  // 보유 옷 id → 옷장 항목 매핑 (owned 해석용)
  const closetById = {}
  closet.forEach((it) => { closetById[it.id] = it })
  const ownedItem = (p, c) => {
    const id = p.owned?.[c]
    return id && closetById[id] ? closetById[id] : null
  }

  // plan 각 항목은 top/bottom/outer/shoes(검색어 문자열) 보유. LLM은 concept/reason도 포함.
  // 보유 옷으로 채운 카테고리는 네이버 검색을 생략한다.
  const queryCategory = {}
  plan.forEach((p) => {
    CATEGORIES.forEach((c) => {
      if (ownedItem(p, c)) return
      if (p[c]) queryCategory[p[c]] = c
    })
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

  // 카테고리 해석: 보유 옷이면 owned 객체, 아니면 네이버 상품
  const resolve = (p, c) => {
    const owned = ownedItem(p, c)
    if (owned) return { owned: true, name: owned.name, color: owned.color }
    return takeNext(p[c])
  }

  const presets = plan.map((p, i) => {
    const colors = { ...(p.colors || {}) }
    CATEGORIES.forEach((c) => {
      const owned = ownedItem(p, c)
      if (owned) colors[c] = owned.color // 보유 옷 색으로 칩 통일
    })
    const preset = {
      id: i + 1,
      concept: p.concept || '',
      reason: p.reason || '',
      tip: p.tip || '',
      colors,
      top: resolve(p, 'top'),
      bottom: resolve(p, 'bottom'),
      outer: resolve(p, 'outer'),
      shoes: resolve(p, 'shoes'),
    }
    CATEGORIES.forEach((c) => {
      if (preset[c] && preset[c].productId) addHistory(preset[c].productId)
    })
    return preset
  })

  cacheWrite(cacheKey, presets)
  return presets
}
