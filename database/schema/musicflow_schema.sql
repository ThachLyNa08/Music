-- ============================================================
--  MusicFlow – Database Schema (MySQL 8.0+)
--  Hệ thống phát nhạc trực tuyến tích hợp AI
--  Bao gồm: 17 bảng, đầy đủ index, FK, comment
-- ============================================================

CREATE DATABASE IF NOT EXISTS musicflow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE musicflow;

-- ============================================================
-- NHÓM 1: QUẢN LÝ TÀI KHOẢN & NGƯỜI DÙNG
-- ============================================================

-- Bảng người dùng chính
CREATE TABLE users (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    display_name    VARCHAR(100)    NOT NULL,
    avatar_url      VARCHAR(500)    NULL,
    role            ENUM('user','admin') NOT NULL DEFAULT 'user',
    status          ENUM('active','locked') NOT NULL DEFAULT 'active',
    -- Thông tin gói Premium
    premium_plan_id INT UNSIGNED    NULL,           -- FK tới premium_plans (thêm sau)
    premium_expires_at DATETIME     NULL,           -- Thời điểm hết hạn Premium
    -- Thống kê tổng hợp (denormalized để truy vấn nhanh)
    total_listen_sec INT UNSIGNED   NOT NULL DEFAULT 0,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_email (email),
    INDEX idx_role  (role),
    INDEX idx_status (status)
) COMMENT='Tài khoản người dùng và admin hệ thống';


-- Bảng thể loại âm nhạc
CREATE TABLE genres (
    id      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name    VARCHAR(100)    NOT NULL,
    slug    VARCHAR(100)    NOT NULL UNIQUE,  -- e.g. 'lo-fi', 'k-pop'
    PRIMARY KEY (id)
) COMMENT='Thể loại âm nhạc (genre)';


-- Sở thích thể loại ban đầu của người dùng (Cold Start)
CREATE TABLE user_genre_preferences (
    user_id     INT UNSIGNED    NOT NULL,
    genre_id    INT UNSIGNED    NOT NULL,
    weight      TINYINT UNSIGNED NOT NULL DEFAULT 1, -- 1=đã chọn lúc đăng ký, tăng dần theo hành vi
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, genre_id),
    CONSTRAINT fk_ugp_user  FOREIGN KEY (user_id)  REFERENCES users  (id) ON DELETE CASCADE,
    CONSTRAINT fk_ugp_genre FOREIGN KEY (genre_id) REFERENCES genres (id) ON DELETE CASCADE
) COMMENT='Sở thích thể loại của người dùng – dùng cho Cold Start và Content-based Filtering';


-- Sở thích nghệ sĩ ban đầu của người dùng (Cold Start)
CREATE TABLE user_artist_preferences (
    user_id     INT UNSIGNED    NOT NULL,
    artist_id   INT UNSIGNED    NOT NULL,
    weight      TINYINT UNSIGNED NOT NULL DEFAULT 1,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, artist_id),
    CONSTRAINT fk_uap_user  FOREIGN KEY (user_id)  REFERENCES users  (id) ON DELETE CASCADE,
    CONSTRAINT fk_uap_artist FOREIGN KEY (artist_id) REFERENCES artists (id) ON DELETE CASCADE
) COMMENT='Sở thích nghệ sĩ của người dùng – dùng cho Cold Start';


-- ============================================================
-- NHÓM 2: NỘI DUNG ÂM NHẠC
-- ============================================================

-- Bảng nghệ sĩ
CREATE TABLE artists (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255)    NOT NULL,
    bio         TEXT            NULL,
    avatar_url  VARCHAR(500)    NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FULLTEXT INDEX ft_artist_name (name)
) COMMENT='Nghệ sĩ / ban nhạc';


-- Bảng album
CREATE TABLE albums (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    artist_id       INT UNSIGNED    NOT NULL,
    genre_id        INT UNSIGNED    NULL,
    title           VARCHAR(255)    NOT NULL,
    cover_url       VARCHAR(500)    NULL,
    release_date    DATE            NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,  -- Trạng thái hiển thị
    release_status  ENUM('draft','scheduled','published','hidden') NOT NULL DEFAULT 'published',
    release_at      DATETIME        NULL,
    published_at    DATETIME        NULL,
    resubmission_count INT          NOT NULL DEFAULT 0,
    can_resubmit    TINYINT(1)      NOT NULL DEFAULT 1,
    resubmit_locked_reason TEXT     NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_album_artist FOREIGN KEY (artist_id) REFERENCES artists (id) ON DELETE CASCADE,
    CONSTRAINT fk_album_genre  FOREIGN KEY (genre_id)  REFERENCES genres  (id) ON DELETE SET NULL,
    INDEX idx_album_artist (artist_id),
    FULLTEXT INDEX ft_album_title (title)
) COMMENT='Album âm nhạc';


-- Bảng bài hát (trung tâm của hệ thống)
CREATE TABLE songs (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    album_id        INT UNSIGNED    NULL,
    artist_id       INT UNSIGNED    NOT NULL,
    genre_id        INT UNSIGNED    NULL,
    title           VARCHAR(255)    NOT NULL,
    duration_sec    SMALLINT UNSIGNED NOT NULL DEFAULT 0,   -- Thời lượng bài hát (giây)
    audio_url       VARCHAR(500)    NOT NULL,               -- Đường dẫn file audio trên storage
    cover_url       VARCHAR(500)    NULL,                   -- Ảnh bìa riêng (override album)
    lyrics          LONGTEXT        NULL,                   -- Lời bài hát (plain text có timestamp)
    tempo           FLOAT           NULL,                   -- BPM – dùng cho Content-based Filtering
    language        VARCHAR(20)     NULL,                   -- 'vi', 'en', 'ko', ...
    play_count      INT UNSIGNED    NOT NULL DEFAULT 0,     -- Tổng lượt nghe
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,  -- Trạng thái hiển thị (dùng kết hợp release_status)
    release_status  ENUM('draft','scheduled','published','hidden') NOT NULL DEFAULT 'published',
    release_at      DATETIME        NULL,
    published_at    DATETIME        NULL,
    resubmission_count INT          NOT NULL DEFAULT 0,
    can_resubmit    TINYINT(1)      NOT NULL DEFAULT 1,
    resubmit_locked_reason TEXT     NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_song_album  FOREIGN KEY (album_id)  REFERENCES albums  (id) ON DELETE SET NULL,
    CONSTRAINT fk_song_artist FOREIGN KEY (artist_id) REFERENCES artists (id) ON DELETE CASCADE,
    CONSTRAINT fk_song_genre  FOREIGN KEY (genre_id)  REFERENCES genres  (id) ON DELETE SET NULL,
    INDEX idx_song_artist    (artist_id),
    INDEX idx_song_genre     (genre_id),
    INDEX idx_song_play_count(play_count DESC),
    FULLTEXT INDEX ft_song_title (title)
) COMMENT='Bài hát – bảng trung tâm của hệ thống';


-- ============================================================
-- NHÓM 3: HÀNH VI NGHE NHẠC & TƯƠNG TÁC
-- ============================================================

-- Lịch sử nghe nhạc (implicit feedback cho thuật toán gợi ý)
CREATE TABLE listening_history (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         INT UNSIGNED    NOT NULL,
    song_id         INT UNSIGNED    NOT NULL,
    -- Dữ liệu hành vi
    completion_rate FLOAT           NOT NULL DEFAULT 0.0,   -- Tỷ lệ % bài hát đã nghe (0.0 – 1.0)
    skip_at_sec     SMALLINT        NULL,                   -- Giây thứ mấy bỏ qua (NULL = không skip)
    source          VARCHAR(50)     NOT NULL DEFAULT 'unknown',
    -- Source values: 'search', 'recommend', 'playlist', 'artist_page', 'album_page', 'ai_playlist'
    -- Implicit rating tính từ: completion_rate * 3 + (liked ? 2 : 0) + (not_skipped ? 0.5 : 0)
    implicit_rating FLOAT           NOT NULL DEFAULT 0.0,
    listened_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_lh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_lh_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE,
    INDEX idx_lh_user_time (user_id, listened_at DESC),
    INDEX idx_lh_song      (song_id),
    INDEX idx_lh_time      (listened_at DESC)
) COMMENT='Lịch sử nghe nhạc – nguồn dữ liệu chính cho thuật toán gợi ý SVD';


-- Lượt thích bài hát (explicit feedback)
CREATE TABLE song_likes (
    user_id     INT UNSIGNED    NOT NULL,
    song_id     INT UNSIGNED    NOT NULL,
    liked_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, song_id),
    CONSTRAINT fk_sl_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_sl_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE,
    INDEX idx_sl_song (song_id)
) COMMENT='Bài hát được người dùng thích (Like) – explicit feedback với trọng số cao';


-- ============================================================
-- NHÓM 4: DANH SÁCH PHÁT (PLAYLIST)
-- ============================================================

-- Bảng playlist
CREATE TABLE playlists (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED    NOT NULL,
    name        VARCHAR(255)    NOT NULL,
    cover_url   VARCHAR(500)    NULL,
    description TEXT            NULL,
    -- Loai tong quat cua playlist:
    -- 'manual' = nguoi dung tu tao
    -- 'ai'     = playlist tao bang AI
    -- 'system' = playlist he thong; loai cu the luu trong system_key
    type        ENUM('manual','ai','system')
                NOT NULL DEFAULT 'manual',
    is_public   BOOLEAN         NOT NULL DEFAULT FALSE,
    is_system   BOOLEAN         NOT NULL DEFAULT FALSE,
    system_key  VARCHAR(100)    NULL,
    ai_prompt   TEXT            NULL,
    ai_intent_json LONGTEXT     NULL,
    ai_provider VARCHAR(50)     NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_pl_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_pl_user (user_id),
    INDEX idx_pl_type (type),
    INDEX idx_pl_public (is_public),
    UNIQUE KEY unique_user_system_key (user_id, system_key)
) COMMENT='Danh sách phát – cả thủ công lẫn tự động';


-- Bài hát trong playlist (nhiều-nhiều)
CREATE TABLE playlist_songs (
    playlist_id INT UNSIGNED    NOT NULL,
    song_id     INT UNSIGNED    NOT NULL,
    position    SMALLINT UNSIGNED NOT NULL DEFAULT 0,       -- Thứ tự bài hát trong playlist
    added_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, song_id),
    CONSTRAINT fk_ps_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
    CONSTRAINT fk_ps_song     FOREIGN KEY (song_id)     REFERENCES songs     (id) ON DELETE CASCADE,
    INDEX idx_ps_position (playlist_id, position)
) COMMENT='Bài hát trong playlist (với thứ tự)';


-- ============================================================
-- NHÓM 5: HỆ THỐNG GỢI Ý (RECOMMENDATION ENGINE)
-- ============================================================

-- Kết quả gợi ý đã tính toán (cache từ Python service)
CREATE TABLE recommendations (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED    NOT NULL,
    song_id     INT UNSIGNED    NOT NULL,
    score       FLOAT           NOT NULL,                   -- Điểm dự đoán từ SVD hoặc cosine similarity
    method      VARCHAR(50)     NOT NULL,
    -- method values: 'svd_cf', 'content_based', 'cold_start_trending'
    computed_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  DATETIME        NOT NULL,                   -- Thời điểm hết hạn (computed_at + TTL)
    PRIMARY KEY (id),
    CONSTRAINT fk_rec_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_rec_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE,
    INDEX idx_rec_user_score (user_id, score DESC),
    INDEX idx_rec_expires    (expires_at)
) COMMENT='Kết quả gợi ý tính toán bởi Python service, đồng bộ với Redis cache';


-- Log tái huấn luyện mô hình
CREATE TABLE model_training_logs (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    triggered_by    ENUM('scheduler','admin') NOT NULL DEFAULT 'scheduler',
    triggered_by_id INT UNSIGNED    NULL,                   -- Admin user_id nếu trigger thủ công
    started_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    DATETIME        NULL,
    status          ENUM('running','success','failed') NOT NULL DEFAULT 'running',
    precision_at_k  FLOAT           NULL,                   -- Kết quả Precision@K
    ndcg_score      FLOAT           NULL,                   -- Kết quả NDCG
    notes           TEXT            NULL,                   -- Log lỗi nếu thất bại
    PRIMARY KEY (id)
) COMMENT='Log quá trình retrain mô hình gợi ý SVD';


-- ============================================================
-- NHÓM 6: TÁCH NGUỒN ÂM THANH – KARAOKE AI
-- ============================================================

-- Hàng đợi xử lý tách âm thanh bằng Spleeter
CREATE TABLE stem_jobs (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id             INT UNSIGNED    NOT NULL,
    song_id             INT UNSIGNED    NOT NULL,
    status              ENUM('queued','processing','completed','failed')
                        NOT NULL DEFAULT 'queued',
    progress_pct        TINYINT UNSIGNED NOT NULL DEFAULT 0, -- Tiến độ 0-100%
    -- Kết quả sau khi tách xong
    vocals_url          VARCHAR(500)    NULL,                -- URL file giọng hát
    instrumental_url    VARCHAR(500)    NULL,                -- URL file nhạc nền
    error_message       TEXT            NULL,                -- Lỗi nếu thất bại
    -- Cache: kết quả lưu 7 ngày
    cache_expires_at    DATETIME        NULL,
    requested_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at        DATETIME        NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_sj_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_sj_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE,
    INDEX idx_sj_user   (user_id),
    INDEX idx_sj_status (status),
    INDEX idx_sj_song   (song_id)
) COMMENT='Hàng đợi và kết quả xử lý tách âm thanh bằng Spleeter';


-- ============================================================
-- NHÓM 7: THANH TOÁN & GÓI PREMIUM
-- ============================================================

-- Danh muc goi Premium
CREATE TABLE premium_plans (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name            VARCHAR(255)    NOT NULL,
    description     TEXT            NULL,
    price           DECIMAL(12,0)   NOT NULL,
    duration_days   INT UNSIGNED    NOT NULL,
    features        JSON            NULL,
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) COMMENT='Cac goi dich vu Premium';


CREATE TABLE user_subscriptions (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id         INT UNSIGNED    NOT NULL,
    plan_id         INT UNSIGNED    NOT NULL,
    status          ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
    start_date      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date        DATETIME        NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_us_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_us_plan FOREIGN KEY (plan_id) REFERENCES premium_plans (id) ON DELETE CASCADE,
    INDEX idx_us_user_status (user_id, status)
) COMMENT='Lịch sử đăng ký gói Premium của người dùng';

CREATE TABLE ai_playlists (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id         INT UNSIGNED    NOT NULL,
    prompt_text     TEXT            NOT NULL,
    extracted_params JSON           NULL,
    playlist_id     INT UNSIGNED    NULL,
    status          ENUM('processing','completed','failed') NOT NULL DEFAULT 'processing',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_aip_user     FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_aip_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE SET NULL,
    INDEX idx_aip_user (user_id)
) COMMENT='Log yeu cau tao playlist bang AI va ket qua phan tich prompt';

CREATE TABLE ai_playlist_generation_history (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED    NOT NULL,
    prompt      TEXT            NOT NULL,
    target_count INT            NOT NULL DEFAULT 20,
    actual_count INT            NOT NULL DEFAULT 0,
    status      ENUM('preview','saved','failed') NOT NULL DEFAULT 'preview',
    playlist_id INT UNSIGNED    NULL,
    provider    VARCHAR(50)     NULL,
    intent_json LONGTEXT        NULL,
    preview_snapshot_json LONGTEXT NULL,
    error_message TEXT          NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_aiph_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_aiph_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE SET NULL,
    INDEX idx_ai_playlist_history_user_created (user_id, created_at),
    INDEX idx_ai_playlist_history_playlist (playlist_id)
) COMMENT='Lich su preview AI Playlist dang snapshot de xem lai va luu sau';


-- ============================================================
-- DỮ LIỆU MẪU KHỞI TẠO (Seed Data)
-- ============================================================

-- Thể loại âm nhạc cơ bản
INSERT INTO genres (name, slug) VALUES
    ('Lo-fi',           'lo-fi'),
    ('Ballad',          'ballad'),
    ('EDM',             'edm'),
    ('Pop',             'pop'),
    ('R&B',             'rnb'),
    ('Jazz',            'jazz'),
    ('Rock',            'rock'),
    ('Hip-hop',         'hip-hop'),
    ('Classical',       'classical'),
    ('V-pop',           'v-pop'),
    ('K-pop',           'k-pop'),
    ('Indie',           'indie');

-- Gói Premium
-- TEST PRICE for local payment testing. Replace with production price before release.
INSERT INTO premium_plans (name, duration_days, price, features) VALUES
    ('Standard 1 tháng', 30,  1000,  '{"stem_download_limit": 10, "stem_duration_limit": null}'),
    ('Standard 3 tháng', 90,  2000, '{"stem_download_limit": 10, "stem_duration_limit": null}'),
    ('Pro 1 năm',        365, 9000, '{"stem_download_limit": null, "stem_duration_limit": null}');

-- Tài khoản Admin mặc định (password cần hash trước khi dùng thực tế)
INSERT INTO users (email, password_hash, display_name, role) VALUES
    ('admin@musicflow.vn', '$2b$12$CHANGE_THIS_HASH', 'Admin MusicFlow', 'admin');


-- ============================================================
-- VIEW HỖ TRỢ PHÂN TÍCH
-- ============================================================

-- View top bài hát trending trong tuần
CREATE OR REPLACE VIEW v_trending_songs_weekly AS
SELECT
    s.id,
    s.title,
    s.audio_url,
    s.cover_url,
    a.name AS artist_name,
    g.name AS genre_name,
    COUNT(lh.id)          AS listen_count_week,
    AVG(lh.completion_rate) AS avg_completion
FROM songs s
JOIN artists a ON s.artist_id = a.id
LEFT JOIN genres g ON s.genre_id = g.id
JOIN listening_history lh ON lh.song_id = s.id
    AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
WHERE s.is_active = TRUE
  AND (
    s.release_status = 'published'
    OR (
      s.release_status = 'scheduled'
      AND s.release_at IS NOT NULL
      AND s.release_at <= NOW()
    )
  )
GROUP BY s.id, s.title, s.audio_url, s.cover_url, a.name, g.name
ORDER BY listen_count_week DESC;


-- View thống kê hành vi nghe nhạc của người dùng (dùng cho trang cá nhân)
CREATE OR REPLACE VIEW v_user_stats AS
SELECT
    u.id AS user_id,
    u.display_name,
    COUNT(DISTINCT lh.song_id)          AS unique_songs_heard,
    SUM(ROUND(s.duration_sec * lh.completion_rate)) AS total_listen_sec,
    COUNT(DISTINCT DATE(lh.listened_at)) AS active_days,
    g.name                               AS top_genre
FROM users u
LEFT JOIN listening_history lh ON lh.user_id = u.id
LEFT JOIN songs s ON s.id = lh.song_id
LEFT JOIN genres g ON g.id = s.genre_id
GROUP BY u.id, u.display_name, g.name;

-- B?ng th�ng b�o h? th?ng
CREATE TABLE notifications (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id         INT UNSIGNED    NOT NULL,
    title           VARCHAR(255)    NOT NULL,
    message         TEXT            NOT NULL,
    type            ENUM('new_song', 'system', 'playlist', 'premium') NOT NULL DEFAULT 'system',
    link            VARCHAR(500)    NULL,
    is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_noti_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_noti_user (user_id),
    INDEX idx_noti_read (is_read)
) COMMENT='Th�ng b�o h? th?ng cho ng�?i d�ng';
