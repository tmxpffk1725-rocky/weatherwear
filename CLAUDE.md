# WeatherWear — 프로젝트 가이드 (CLAUDE.md)

오늘 날씨에 맞는 옷차림(코디)을 AI가 추천하고 네이버 쇼핑 구매로 연결하는 **날씨 기반 의류 추천 웹앱**. 회원제(이메일 로그인 + 이메일 인증), 계정별 옷장·찜·설정 동기화. 모바일 최적화 웹, 모노크롬 블랙 디자인.

- 배포: https://weatherwear-jade.vercel.app (master 푸시 시 Vercel 자동 재배포)
- GitHub: https://github.com/tmxpffk1725-rocky/weatherwear
- 산출물: `docs/`(기획서·요구사항·기능·DB·품질보안·정책결정 xlsx + DDL/seed/README). 기능·정책·DB 변경 시 해당 산출물 본문 + 변경이력 시트를 갱신할 것.

## 아키텍처

세 부분으로 나뉘어 있다. 헷갈리지 말 것:

1. **프론트엔드** — React 19 + Vite, 순수 CSS(.jsx, TypeScript 아님). Vercel 배포. `src/`.
2. **추천 함수** — Vercel 서버리스 `api/*.js`(CommonJS). `api/outfit.js`(Claude로 코디 설계), `api/shop.js`(네이버 쇼핑 프록시). `lib/outfit.js`를 공유. 로컬 개발은 `server.js`(Express, 3001)가 같은 엔드포인트를 제공 + Vite 프록시.
3. **계정/동기화/날씨 백엔드** — `backend/`(Node + Express + SQLite). **오라클 클라우드 VM에서 별도 운영**. 인증·계정 데이터·날씨 프록시 담당. Vercel과 무관.

프론트는 추천(`/api/shop`,`/api/outfit`, 상대경로 → Vercel)과 백엔드(`/auth/*`,`/api/state|settings|closet|favorites|weather` → `VITE_API_BASE`, 기본 오라클 VM)를 **각각** 호출한다.

## 기술 스택

- 프론트: React 19, Vite 8, 순수 CSS. `src/api/`(weather/shop/backend/favorites/closet/colors/season/location/history), `src/pages/`(HomePage/ClosetPage/SettingPage/AuthPage).
- 추천 LLM: Claude API `claude-haiku-4-5`(env `LLM_MODEL`로 변경 가능), 구조화 출력. `@anthropic-ai/sdk`. 룰 기반 폴백(`src/api/shop.js`의 TEMP_RANGE + 24절기).
- 상품: 네이버 쇼핑검색 API(프록시). 날씨: 기상청 단기예보(공공데이터) — **백엔드 프록시 + 격자 30분 캐시**. GPS + OpenStreetMap Nominatim 역지오코딩. 24절기(`src/api/season.js`).
- 백엔드: Node 20, Express, better-sqlite3, bcryptjs, jsonwebtoken, express-rate-limit, nodemailer(Gmail).
- package.json은 CommonJS(`"type":"module"` 없음).

## 명령어

```bash
npm run dev        # Vite 개발 서버
npm run dev:all    # server.js(프록시) + vite 동시 (concurrently)
npm run build      # 프로덕션 빌드(머지 전 항상 확인)
npm run server     # 로컬 백엔드 프록시(server.js, 3001)
```

`backend/`는 별도: `cd backend && npm install --omit=dev && node server.js` (운영은 오라클 VM에서 systemd).

## 배포

- **프론트**: master 푸시 → Vercel 자동 재배포. PR마다 프리뷰(단, 프리뷰는 백엔드 CORS 미허용이라 로그인 불가 — 실동작은 프로덕션에서).
- **추천 함수**: `api/*.js`도 Vercel이 함께 배포. env(Vercel): `NAVER_CLIENT_ID/SECRET`, `ANTHROPIC_API_KEY`, `LLM_MODEL`, `JWT_SECRET`(백엔드와 동일 값 — 추천 API 토큰 검증용, 미설정 시 배포 환경에서 추천 500).
- **백엔드(오라클 VM)**: 코드 변경 후 VM에서 갱신
  ```bash
  cd ~/weatherwear && git checkout master && git pull && cd backend \
    && npm install --omit=dev && sudo systemctl restart weatherwear
  ```
  - https는 Caddy 자동 인증서, 도메인은 nip.io(IP 기반). systemd 서비스명 `weatherwear`.
  - 운영 정보(IP·SSH·env 위치 등)는 비밀이라 저장소에 두지 않음 — 별도 메모리/보안 채널 참조.

## 환경변수 (값은 절대 커밋 금지, .env는 gitignore)

- 프론트/Vercel: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `LLM_MODEL`, `JWT_SECRET`(백엔드와 동일 값), `VITE_API_BASE`(기본값 백엔드 주소 하드코딩)
- 백엔드(VM, `/etc/weatherwear-backend.env`): `JWT_SECRET`, `FRONTEND_ORIGINS`, `PORT`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `KMA_KEY`

## 작업 규칙

- **워크플로**: master에서 직접 작업 금지. 기능 브랜치 → PR → CI(빌드)·Vercel 체크 → 머지(자동 배포). 커밋·푸시·PR은 사용자가 요청할 때.
- **디자인**: 모던 미니멀 / 모노크롬 블랙(흰 바탕 + 검정 포인트). 색상 12팔레트(`src/api/colors.js`)를 옷장·추천 색칩에 공유.
- **추천**: LLM 우선 + 룰 기반 폴백. 옷장·피부톤·핏·하루범위(일 최고/최저·강수확률) 반영. 카드는 항상 정확, LLM 설명 문구는 가끔 슬립(허용).
- **날씨/추천 회복력**: 날씨 실패 시 캐시(stale)→수동 기온 선택. 추천 결과 localStorage 30분 캐시. 외부 API HTTP 에러(429/5xx)는 재시도 말고 즉시 폴백(쿼터 절약).
- **데이터 저장**: 옷장·찜·설정은 **계정 DB(백엔드)** 가 정본 → 기기 간 동기화. localStorage엔 로그인 토큰·캐시만.
- **비밀**: 모든 키는 env. 채팅/커밋에 키 노출 금지. 노출 시 재발급.

## 미구현/주의

- 비밀번호 재설정(이메일) — 없음(이메일 인프라는 있음, 추가 가능). DB 자동 백업 — 없음(단일 VM). 개인정보처리방침·약관·모니터링 — 없음.
- 기상청 공공 API는 호출 한도·일시 장애가 있음(프록시 캐시로 완화). 한도 소진 시 자정 KST 리셋.
