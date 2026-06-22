-- Bổ sung các trường bio cho nghệ sĩ từ Wikipedia và Last.fm fallback
-- Chạy script này an toàn, bỏ qua lỗi nếu cột đã tồn tại (hoặc dùng apps/backend/scripts/migrate.js nếu đã cập nhật logic)

-- Bảng `artists` thường đã có `bio` (ở database gốc) và `short_bio` (từ artist_metadata.sql)
-- Lệnh dưới đây dùng cú pháp chuẩn MySQL, nếu cột đã tồn tại bạn có thể bỏ qua dòng đó khi chạy thủ công.

ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS bio TEXT NULL,
  ADD COLUMN IF NOT EXISTS bio_source VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS bio_source_url VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS bio_fetched_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS lastfm_url VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS wikidata_id VARCHAR(100) NULL;
