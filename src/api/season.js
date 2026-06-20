// 24절기 시작일(양력 근사치, 연도별 ±1일 오차 허용)과 시즌 키워드 매핑.
// 날짜 → 현재 절기 → 검색용 시즌 키워드(봄/여름/가을/겨울)를 산출한다.
const SOLAR_TERMS = [
  { name: '소한', month: 1, day: 6, season: '겨울' },
  { name: '대한', month: 1, day: 20, season: '겨울' },
  { name: '입춘', month: 2, day: 4, season: '봄' },
  { name: '우수', month: 2, day: 19, season: '봄' },
  { name: '경칩', month: 3, day: 6, season: '봄' },
  { name: '춘분', month: 3, day: 21, season: '봄' },
  { name: '청명', month: 4, day: 5, season: '봄' },
  { name: '곡우', month: 4, day: 20, season: '봄' },
  { name: '입하', month: 5, day: 6, season: '여름' },
  { name: '소만', month: 5, day: 21, season: '여름' },
  { name: '망종', month: 6, day: 6, season: '여름' },
  { name: '하지', month: 6, day: 21, season: '여름' },
  { name: '소서', month: 7, day: 7, season: '여름' },
  { name: '대서', month: 7, day: 23, season: '여름' },
  { name: '입추', month: 8, day: 8, season: '가을' },
  { name: '처서', month: 8, day: 23, season: '가을' },
  { name: '백로', month: 9, day: 8, season: '가을' },
  { name: '추분', month: 9, day: 23, season: '가을' },
  { name: '한로', month: 10, day: 8, season: '가을' },
  { name: '상강', month: 10, day: 24, season: '가을' },
  { name: '입동', month: 11, day: 8, season: '겨울' },
  { name: '소설', month: 11, day: 22, season: '겨울' },
  { name: '대설', month: 12, day: 7, season: '겨울' },
  { name: '동지', month: 12, day: 22, season: '겨울' },
]

// 오늘 날짜가 속한 절기를 반환. (연초 1/1~1/5는 작년 동지 구간 → 마지막 원소로 처리)
export const getSolarTerm = (date = new Date()) => {
  const key = (date.getMonth() + 1) * 100 + date.getDate()
  let current = SOLAR_TERMS[SOLAR_TERMS.length - 1] // 기본값: 동지
  for (const term of SOLAR_TERMS) {
    if (key >= term.month * 100 + term.day) current = term
  }
  return current // { name, season, ... }
}
