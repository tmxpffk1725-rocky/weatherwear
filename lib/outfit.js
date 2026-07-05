// LLM 코디 생성 (로컬 server.js와 Vercel 함수 api/outfit.js가 공유)
// Claude가 날씨·상황·취향에 맞는 코디를 설계하고 각 아이템의 네이버 검색어를 만든다.
//
// 설계 포인트:
//  · LLM의 역할은 "계획"까지 — 실제 상품은 프론트가 네이버에서 검색한다.
//    (LLM이 상품·가격을 지어내면 안 되므로 역할을 분리)
//  · 구조화 출력(json_schema): 응답을 스키마에 강제해 "항상 파싱 가능한 JSON"을 보장.
//    자유 텍스트 파싱의 불안정함이 없다. 색도 18팔레트 이름만 나오도록 프롬프트로 제약.
//  · 모델은 env(LLM_MODEL)로 교체 가능 — 기본 Haiku(이 작업은 짧은 구조화 출력이라
//    상위 모델 대비 품질 차이가 작고 3배 저렴·2.5배 빠름을 실측으로 확인).
const AnthropicMod = require('@anthropic-ai/sdk')
const Anthropic = AnthropicMod.default || AnthropicMod

const getModel = () => process.env.LLM_MODEL || 'claude-haiku-4-5'

// 구조화 출력 스키마 — 세트별 {컨셉·이유·팁·카테고리별 검색어·색·보유옷 id}.
// (검색어 문자열만 받음; outer는 더우면 빈 문자열)
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    presets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          concept: { type: 'string' },
          reason: { type: 'string' },
          tip: { type: 'string' },
          top: { type: 'string' },
          bottom: { type: 'string' },
          outer: { type: 'string' },
          shoes: { type: 'string' },
          colors: {
            type: 'object',
            additionalProperties: false,
            properties: {
              top: { type: 'string' },
              bottom: { type: 'string' },
              outer: { type: 'string' },
              shoes: { type: 'string' },
            },
            required: ['top', 'bottom', 'outer', 'shoes'],
          },
          owned: {
            type: 'object',
            additionalProperties: false,
            properties: {
              top: { type: 'string' },
              bottom: { type: 'string' },
              outer: { type: 'string' },
              shoes: { type: 'string' },
            },
            required: ['top', 'bottom', 'outer', 'shoes'],
          },
        },
        required: ['concept', 'reason', 'tip', 'top', 'bottom', 'outer', 'shoes', 'colors', 'owned'],
      },
    },
  },
  required: ['presets'],
}

const SYSTEM = `당신은 한국의 패션 스타일리스트입니다. 주어진 날씨·상황·취향에 맞춰 서로 어울리는 코디 3세트를 제안합니다.

규칙:
- 각 세트는 top(상의)/bottom(하의)/outer(아우터)/shoes(신발)로 구성. 각 값은 네이버 쇼핑에서 검색할 한국어 검색어입니다.
- 검색어는 "성별 + 색 + 아이템" 형태로 간결하게. 예: "남성 베이지 셔츠", "남성 네이비 슬랙스".
- 검색어는 네이버 쇼핑에서 결과가 충분히 나오도록 일반적으로. 색은 1개만, 너무 세부적인 핏·소재·희귀 조합("루즈핏 옥스포드 더블", 색 2개 등)은 피하세요. 아이템 명칭은 흔한 단어로(예: "블레이저"보다 "자켓", "롱슬리브 티셔츠"보다 "긴팔티").
- 한 세트 안에서 색과 스타일이 서로 어울리도록 조율하세요.
- 체감온도에 맞는 두께·소재를 고르세요(더운데 기모/패딩 금지, 추운데 반팔 금지).
- dayMin(일 최저기온)·dayMax(일 최고기온)이 주어지면, **하루 종일(아침~저녁) 한 벌로 입을 코디**를 그 범위에 맞게 설계하세요. 일교차가 크면(약 8도 이상) 벗고 입기 쉬운 **레이어링**(가디건·셔츠·얇은 자켓 등 탈착 가능한 아우터)을 우선하고, tip에 "아침엔 걸치고 낮엔 벗으세요"처럼 시간대별 착용법을 안내하세요. 일교차가 작으면 굳이 레이어링을 강요하지 마세요.
- rainProb(강수확률, %)이 주어지고 높으면(약 50% 이상) 방수·바람막이류를 고려하고 우산 휴대를 tip에 넣으세요. 스웨이드·캔버스처럼 비에 약한 소재는 피하세요.
- 더워서 아우터가 불필요하면 outer는 빈 문자열("")로 두세요.
- 비가 오면 샌들·스웨이드는 피하고 방수/바람막이류를 고려하세요.
- season(절기 기준 계절) 트렌드를 반영하세요.
- 사용자 선호 아이템을 우선 반영하되, 날씨에 안 맞으면 적절히 대체하세요.
- situation에 맞는 복장 격식을 지키세요. 특히 '운동'이면 운동복만 구성: 상의는 기능성 티셔츠(반팔/긴팔)·맨투맨·후드집업, 하의는 트레이닝팬츠·조거팬츠·반바지·레깅스, 아우터는 바람막이·후드집업(불필요하면 ""), 신발은 운동화·러닝화만. 셔츠·니트·슬랙스·청바지·자켓·코트·로퍼·구두·부츠는 운동에 금지. 선호 아이템·보유 옷이 운동에 안 맞으면 무시하고 운동복으로 추천하세요. 검색어 예: "남성 기능성 반팔티", "남성 트레이닝 반바지", "남성 러닝화". 반대로 출근·데이트에는 트레이닝복·레깅스를 쓰지 마세요.
- closet(보유 옷, 각 항목은 {id, category, name, color})이 주어지면: 각 카테고리에서 날씨·코디에 어울리는 보유 옷이 있으면 그것을 사용하고 새로 추천하지 마세요. 사용한 경우 owned[카테고리]에 그 옷의 id를 넣고, 해당 검색어(top/bottom 등)는 빈 문자열(""), colors[카테고리]는 그 옷의 color로 맞추세요. 보유 옷을 안 쓰는(=새로 사는) 카테고리는 owned 값을 빈 문자열("")로 두고 평소처럼 검색어를 만드세요.
- 보유 옷을 최대한 활용해 "있는 옷 + 부족한 것만 구매" 코디가 되게 하되, 보유 옷이 날씨/컨셉에 안 맞으면 무리해서 쓰지 말고 새로 추천하세요. closet이 비어 있으면 owned는 모두 "".
- owned로 사용하는 보유 옷은 reason·tip·colors에서 반드시 그 옷의 실제 이름·색을 그대로 쓰세요. 옷장에 없는 이름이나 다른 색으로 바꿔 부르지 마세요(예: 보유 옷이 "베이지 셔츠"면 "화이트 반팔티"로 묘사 금지).
- 각 아이템의 색을 colors(top/bottom/outer/shoes)에 한국어 색 이름으로 명시하세요. 반드시 다음 18색 중에서만 고르세요: 블랙, 화이트, 그레이, 네이비, 베이지, 브라운, 카키, 블루, 그린, 레드, 핑크, 옐로우, 와인, 민트, 퍼플, 오렌지, 아이보리, 차콜.
- colors의 색과 검색어(top/bottom 등)에 쓴 색은 동일하게 맞추세요(예: top 검색어가 "남성 베이지 셔츠"면 colors.top은 "베이지").
- 한 세트 3~4개 색은 서로 어울리는 조합으로 고르세요(무채색 1~2개 + 포인트색 1개 식으로 과하지 않게). 아우터가 없으면 colors.outer는 빈 문자열("").
- tone(피부톤)을 색 선택에 반영하세요. 쿨톤이면 네이비·그레이·블루·블랙 등 푸른 기 도는 색, 웜톤이면 베이지·브라운·카키 등 따뜻한 색을 우선하세요.
- fit(선호 핏)을 검색어와 조율에 반영하세요. 오버핏이면 넉넉한 실루엣, 슬림핏이면 깔끔한 핏, 와이드면 와이드 팬츠 등. 단 검색어는 여전히 일반적으로(핏 키워드는 핵심 아이템에만 가볍게).
- concept은 짧은 컨셉명, reason은 "왜 이 코디인지"를 날씨·피부톤·상황 근거로 구체적인 한 문장(한국어).
- tip은 착장·스타일링 포인트 한 문장(한국어). 예: "셔츠는 살짝 풀어 레이어링하고 바지는 발목이 보이게 접으세요." 같이 실제로 입을 때 도움이 되는 조언.
- 여러 세트를 만들 때는 서로 다른 컨셉으로 다양하게 만드세요.`

async function generateOutfit(context) {
  // count(생성할 세트 수, 기본 3)·exclude(겹치지 않게 할 기존 컨셉)는 프롬프트 제어용이라
  // 조건 JSON에는 넣지 않고 분리한다. 세트가 적으면 max_tokens도 줄여 생성을 빠르게.
  const { count = 3, exclude = [], ...cond } = context
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: getModel(),
    max_tokens: count <= 1 ? 700 : 1500,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `조건(JSON):\n${JSON.stringify(cond)}\n\n이 조건에 맞는 코디 ${count}세트를 만들어줘.`
          + (exclude.length ? `\n단, 다음 컨셉과는 겹치지 않게 서로 다른 컨셉으로 만들어줘: ${exclude.join(', ')}` : ''),
      },
    ],
  })
  // 구조화 출력 모드에서는 text 블록 내용이 곧 스키마에 맞는 JSON 문자열이다
  const block = response.content.find((b) => b.type === 'text')
  const data = JSON.parse(block ? block.text : '{}')
  return Array.isArray(data.presets) ? data.presets : [] // 형태가 어긋나면 빈 배열 → 호출부가 룰 폴백
}

module.exports = { generateOutfit }
