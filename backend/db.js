// SQLite 초기화 (1GB VM에 가벼운 단일 파일 DB)
//
// 왜 SQLite인가: 무료 1GB VM에 별도 DB 서버(Postgres 등)를 띄울 메모리 여유가 없고,
// 이 규모(단일 서버·수천 사용자)에선 파일 DB로 충분하다. 백업도 파일 복사 수준으로 단순.
//
// 왜 옷장·찜·설정을 JSON 문자열(블롭)로 저장하나: 앱이 이 데이터를 항상 "통째로"
// 읽고 쓰기 때문(부분 쿼리 불필요). 정규화 테이블로 쪼개면 조인만 늘고 이득이 없다.
//
// WAL 모드: 쓰기 중에도 읽기가 막히지 않는 저널링 방식. 대신 백업 시 -wal 파일까지
// 고려해야 해서 백업 스크립트는 파일 복사가 아닌 sqlite3 .backup 명령을 쓴다.
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'weatherwear.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    settings TEXT,
    closet TEXT,
    favorites TEXT,
    updated_at INTEGER NOT NULL
  );
`)

// 가벼운 마이그레이션: 기능 추가로 생긴 컬럼을 기존 DB에 보충 (이미 있으면 에러 무시).
// 마이그레이션 도구 없이 "기동 시 스키마 맞추기"로 충분한 규모라 이 방식을 택했다.
try { db.exec('ALTER TABLE users ADD COLUMN name TEXT') } catch { /* 이미 존재 */ }
try { db.exec('ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0') } catch { /* 이미 존재 */ }
try { db.exec('ALTER TABLE users ADD COLUMN verify_token TEXT') } catch { /* 이미 존재 */ }
try { db.exec('ALTER TABLE users ADD COLUMN reset_token TEXT') } catch { /* 이미 존재 */ }
try { db.exec('ALTER TABLE users ADD COLUMN reset_expires INTEGER') } catch { /* 이미 존재 */ }

module.exports = db
