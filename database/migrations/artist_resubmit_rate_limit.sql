-- Khởi tạo Migration: artist_resubmit_rate_limit.sql
-- Thêm các cột cho tính năng rate limit gửi lại nội dung

-- 1. Thêm cột vào bảng songs
ALTER TABLE songs
  ADD COLUMN resubmission_count INT NOT NULL DEFAULT 0,
  ADD COLUMN can_resubmit TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN resubmit_locked_reason TEXT NULL;

-- 2. Thêm cột vào bảng albums
ALTER TABLE albums
  ADD COLUMN resubmission_count INT NOT NULL DEFAULT 0,
  ADD COLUMN can_resubmit TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN resubmit_locked_reason TEXT NULL;
