// LLM 코디 생성 (로컬 server.js와 Vercel 함수 api/outfit.js가 공유)
// Claude가 날씨·상황·취향에 맞는 코디 3세트를 설계하고 각 아이템의 네이버 검색어를 만든다.
const AnthropicMod = require('@anthropic-ai/sdk')
const Anthropic = AnthropicMod.default || AnthropicMod

const getModel = () => process.env.LLM_MODEL || 'claude-haiku-4-5'

// 구조화 출력 스키마 (검색어 문자열만 받음; outer는 더우면 빈 문자열)
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
          top: { type: 'string' },
          bottom: { type: 'string' },
          outer: { type: 'string' },
          shoes: { type: 'string' },
        },
        required: ['concept', 'reason', 'top', 'bottom', 'outer', 'shoes'],
      },
    },
  },
  required: ['presets'],
}

const SYSTEM = `당신은 한국의 패션 스타일리스트입니다. 주어진 날씨·상황·취향에 맞춰 서로 어울리는 코디 3세트를 제안합니다.

규칙:
- 각 세트는 top(상의)/bottom(하의)/outer(아우터)/shoes(신발)로 구성. 각 값은 네이버 쇼핑에서 검색할 한국어 검색어입니다.
- 검색어는 "성별 + 구체 아이템 + (색/핏)" 형태로 간결하게. 예: "남성 베이지 옥스포드 셔츠", "남성 네이비 슬랙스".
- 한 세트 안에서 색과 스타일이 서로 어울리도록 조율하세요.
- 체감온도에 맞는 두께·소재를 고르세요(더운데 기모/패딩 금지, 추운데 반팔 금지).
- 더워서 아우터가 불필요하면 outer는 빈 문자열("")로 두세요.
- 비가 오면 샌들·스웨이드는 피하고 방수/바람막이류를 고려하세요.
- season(절기 기준 계절) 트렌드를 반영하세요.
- 사용자 선호 아이템을 우선 반영하되, 날씨에 안 맞으면 적절히 대체하세요.
- concept은 짧은 컨셉명, reason은 "왜 이 코디인지" 한 문장(한국어).
- 세트 3개는 서로 다른 컨셉으로 다양하게 만드세요.`

async function generateOutfit(context) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 1500,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `조건(JSON):\n${JSON.stringify(context)}\n\n이 조건에 맞는 코디 3세트를 만들어줘.`,
      },
    ],
  })
  const block = response.content.find((b) => b.type === 'text')
  const data = JSON.parse(block ? block.text : '{}')
  return Array.isArray(data.presets) ? data.presets : []
}

module.exports = { generateOutfit }
