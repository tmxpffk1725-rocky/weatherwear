-- WeatherWear DB 스키마 (SQLite / better-sqlite3)
-- 정본: backend/db.js (앱 기동 시 CREATE TABLE IF NOT EXISTS + 누락 컬럼 ALTER로 적용)
-- 작성일: 2026-06-30

-- 사용자 계정
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    UNIQUE NOT NULL,
  password_hash TEXT    NOT NULL,          -- bcrypt 해시(평문 금지)
  name          TEXT,                      -- 회원가입 시 이름
  verified      INTEGER NOT NULL DEFAULT 0,-- 이메일 인증 여부(0/1)
  verify_token  TEXT,                      -- 이메일 인증 토큰(인증 후 NULL)
  created_at    INTEGER NOT NULL           -- epoch millis
);

-- 계정별 데이터(1:1). 옷장·찜·설정은 JSON 문자열로 저장
CREATE TABLE IF NOT EXISTS user_data (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings   TEXT,    -- 설정 JSON {gender,tone,topSize,bottomSize,fit,preferredItems}
  closet     TEXT,    -- 옷장 JSON [{id,name,category,color,memo}]
  favorites  TEXT,    -- 찜 JSON [{id,savedAt,situation,temp,items}]
  updated_at INTEGER NOT NULL
);

-- 참고:
-- · 인증 토큰(JWT)은 DB 비저장(클라이언트 localStorage 보관)
-- · 날씨/추천/상품은 외부 API(기상청·Claude·네이버)라 DB 비저장
--   (날씨는 백엔드 메모리 캐시, 추천은 프론트 localStorage 30분 캐시)
