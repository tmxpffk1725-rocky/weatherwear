-- WeatherWear 예시 시드 (문서용 — 운영 DB에는 넣지 않음)
-- 실제 가입은 앱의 /auth/signup으로 생성되며, password_hash는 bcrypt로 해시된다.
-- 아래는 user_data의 settings/closet/favorites JSON 구조 예시.
-- 작성일: 2026-06-30

-- 예시 계정 (password_hash는 'secret123'의 bcrypt 해시 자리표시자)
INSERT INTO users (email, password_hash, name, verified, created_at)
VALUES ('demo@example.com', '$2a$10$REPLACE_WITH_BCRYPT_HASH', '데모', 1, 1782800000000);

-- 예시 계정 데이터 (settings / closet / favorites JSON)
INSERT INTO user_data (user_id, settings, closet, favorites, updated_at)
VALUES (
  1,
  '{"gender":"남성","tone":"쿨톤","topSize":"L","bottomSize":"34","fit":"오버핏","preferredItems":{"top":["반팔","니트"],"bottom":["슬랙스"],"outer":["얇은자켓"],"shoes":["스니커즈"]}}',
  '[{"id":1,"name":"베이지 셔츠","category":"상의","color":"베이지","memo":""},{"id":2,"name":"네이비 슬랙스","category":"하의","color":"네이비","memo":""}]',
  '[]',
  1782800000000
);
