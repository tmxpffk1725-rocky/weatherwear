# WeatherWear 백엔드 (오라클 클라우드)

이메일/비밀번호 로그인 + 계정별 데이터(설정·옷장·찜) 동기화 API.
오라클 클라우드 Always Free VM에서 Node + SQLite로 실행. 프론트(Vercel)가 이 API를 호출한다.

## 엔드포인트
- `POST /auth/signup` `{email, password}` → `{token, email}`
- `POST /auth/login` `{email, password}` → `{token, email}`
- `GET /auth/me` (Bearer) → `{email}`
- `GET /api/state` (Bearer) → `{settings, closet, favorites}`
- `PUT /api/settings|closet|favorites` (Bearer) `{value}` → `{ok:true}`
- `GET /health` → `{ok:true}`

인증: `Authorization: Bearer <JWT>` (만료 30일).

## VM 배포 개요
1. `git clone` 후 `cd backend && npm install --omit=dev`
2. `/etc/weatherwear-backend.env` 작성 (`.env.example` 참고, `JWT_SECRET`은 `openssl rand -hex 32`)
3. systemd 서비스로 `node server.js` 상시 실행 (127.0.0.1:3000)
4. Caddy가 `https://<도메인>` → `localhost:3000` 리버스 프록시 (자동 인증서)

서버는 `127.0.0.1`에만 바인딩 — 외부 노출은 Caddy(HTTPS)를 통해서만.
