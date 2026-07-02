// SQLite 초기화 (1GB VM에 가벼운 단일 파일 DB)
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

// 기존 DB에 누락 컬럼 추가 (있으면 무시)
try { db.exec('ALTER TABLE users ADD COLUMN name TEXT') } catch { /* 이미 존재 */ }
try { db.exec('ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0') } catch { /* 이미 존재 */ }
try { db.exec('ALTER TABLE users ADD COLUMN verify_token TEXT') } catch { /* 이미 존재 */ }
try { db.exec('ALTER TABLE users ADD COLUMN reset_token TEXT') } catch { /* 이미 존재 */ }
try { db.exec('ALTER TABLE users ADD COLUMN reset_expires INTEGER') } catch { /* 이미 존재 */ }

module.exports = db
