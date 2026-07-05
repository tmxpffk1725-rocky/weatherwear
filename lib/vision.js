// 옷 사진 분석 (로컬 server.js와 Vercel 함수 api/vision.js가 공유)
// Claude 비전이 사진 1장에서 {category, color, name}을 추출한다.
// 사용자가 확인·수정 후 저장하는 프리필 용도 — 자동 저장하지 않는다.
const AnthropicMod = require('@anthropic-ai/sdk')
const Anthropic = AnthropicMod.default || AnthropicMod

const getModel = () => process.env.VISION_MODEL || 'claude-haiku-4-5'

// ⚠️ src/api/colors.js 팔레트, lib/outfit.js 프롬프트의 18색과 이름을 일치시킬 것.
const COLOR_NAMES = ['블랙', '화이트', '그레이', '네이비', '베이지', '브라운', '카키', '블루', '그린', '레드', '핑크', '옐로우', '와인', '민트', '퍼플', '오렌지', '아이보리', '차콜']

// ClosetPage의 카테고리·종류 어휘와 통일 (추천 매칭이 잘 되도록)
const CATEGORY_NAMES = ['상의', '하의', '아우터', '신발']
const ITEM_VOCAB = {
  '상의': ['반팔', '민소매', '셔츠', '카라티', '긴팔', '맨투맨', '후드티', '니트', '가디건', '두꺼운니트', '기모티'],
  '하의': ['반바지', '린넨바지', '슬랙스', '면바지', '청바지', '조거팬츠', '와이드팬츠', '기모바지'],
  '아우터': ['바람막이', '얇은자켓', '가디건', '자켓', '트렌치코트', '코트', '가죽자켓', '패딩'],
  '신발': ['샌들', '슬리퍼', '스니커즈', '운동화', '로퍼', '구두', '부츠', '어그부츠'],
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    category: { type: 'string', enum: CATEGORY_NAMES },
    color: { type: 'string', enum: COLOR_NAMES },
    name: { type: 'string' },
  },
  required: ['category', 'color', 'name'],
}

const SYSTEM = `당신은 의류 사진을 분석해 옷장 등록 정보를 추출합니다.

규칙:
- category: 사진 속 옷이 상의/하의/아우터/신발 중 무엇인지.
- color: 옷의 주된 색을 다음 18색 중 가장 가까운 것으로: ${COLOR_NAMES.join(', ')}. 무늬가 있으면 바탕색 기준.
- name: 옷 종류를 나타내는 짧은 한국어. 가능하면 다음 어휘에서 고르세요 — ${Object.entries(ITEM_VOCAB).map(([c, v]) => `${c}: ${v.join('/')}`).join(' · ')}. 어휘에 없으면 흔한 명칭으로 짧게(예: "청자켓"). 색 이름은 name에 넣지 마세요.
- 옷이 여러 벌이면 가장 크게/중앙에 보이는 한 벌 기준.
- 사진이 옷이 아니면 가장 그럴듯한 추정으로 채우세요(사용자가 수정합니다).`

// image: base64 문자열(데이터 URL 아님), mediaType: image/jpeg 등
async function analyzeClothing(image, mediaType) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 200,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
          { type: 'text', text: '이 옷의 category, color, name을 추출해줘.' },
        ],
      },
    ],
  })
  // 구조화 출력 모드에서는 text 블록 내용이 곧 스키마에 맞는 JSON 문자열이다
  const block = response.content.find((b) => b.type === 'text')
  return JSON.parse(block ? block.text : '{}')
}

module.exports = { analyzeClothing }
