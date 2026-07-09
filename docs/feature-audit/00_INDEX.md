# Danh mục Tài liệu Kỹ thuật Chức năng (Feature Audit Index)

Dưới đây là danh sách toàn bộ 47 tài liệu kỹ thuật rà soát chức năng của hệ thống MusicFlow, được phân loại theo đối tượng sử dụng: Người dùng (User), Quản trị viên (Admin), và Hệ thống/AI (System). Tổng cộng có 51 file nếu tính cả nhóm tổng hợp (Root).

## Nhóm Người dùng (User) - 15 chức năng
1. [01_auth_register_login.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/01_auth_register_login.md) - Xác thực, Đăng nhập, Đăng ký.
2. [02_user_profile.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/02_user_profile.md) - Cập nhật Thông tin Hồ sơ.
3. [03_music_playback_player_queue.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/03_music_playback_player_queue.md) - Trình phát nhạc, Hàng đợi (Queue).
4. [04_search_music.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/04_search_music.md) - Màn hình Tìm kiếm cơ bản.
5. [05_song_artist_album_detail.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/05_song_artist_album_detail.md) - Chi tiết Bài hát, Nghệ sĩ, Album.
6. [06_playlist_management.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/06_playlist_management.md) - Quản lý Playlist cá nhân.
7. [08_library_liked_recently_played.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/08_library_liked_recently_played.md) - Thư viện Cá nhân (Đã thích, Nghe gần đây).
8. [09_search_and_ai_search.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/09_search_and_ai_search.md) - Thuật toán Tìm kiếm Nhạc và Gợi ý.
9. [10_user_profile_and_statistics.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/10_user_profile_and_statistics.md) - Thống kê nghe nhạc Cá nhân.
10. [11_premium_payment.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/11_premium_payment.md) - Thanh toán Premium (SePay/VietQR).
11. [12_ai_playlist_generator.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/12_ai_playlist_generator.md) - Trình Tạo AI Playlist (Gemini LLM Intent).
12. [13_karaoke_lyrics_view.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/13_karaoke_lyrics_view.md) - Giao diện Hát Karaoke (Cuộn lời đồng bộ).
13. [14_notifications.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/14_notifications.md) - Thông báo hệ thống (Notification).
14. [15_messaging_chat.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/15_messaging_chat.md) - Tin nhắn trực tiếp và Nghe Chung.
15. [16_public_playlist_share_clone.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/user/16_public_playlist_share_clone.md) - Chia sẻ và Nhân bản (Clone) Playlist Công khai.

## Nhóm Quản trị viên (Admin) - 15 chức năng
1. [01_admin_auth_and_route_guard.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/01_admin_auth_and_route_guard.md) - Bảo mật Admin (Route Guard).
2. [02_admin_dashboard.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/02_admin_dashboard.md) - Bảng điều khiển (Dashboard).
3. [03_admin_manage_users.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/03_admin_manage_users.md) - Quản lý Danh sách Người dùng.
4. [04_admin_user_detail.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/04_admin_user_detail.md) - Chi tiết Người dùng (Theo dõi Hành vi).
5. [05_admin_manage_songs.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/05_admin_manage_songs.md) - Quản lý Kho Bài hát.
6. [06_admin_song_detail.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/06_admin_song_detail.md) - Chi tiết & Chẩn đoán Bài hát.
7. [07_admin_manage_artists_albums.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/07_admin_manage_artists_albums.md) - Quản lý Nghệ sĩ (Tự động Sync).
8. [08_admin_manage_genres_taxonomy.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/08_admin_manage_genres_taxonomy.md) - Quản lý Thể loại (Taxonomy Flag).
9. [09_admin_manage_playlists.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/09_admin_manage_playlists.md) - Kiểm toán System Playlists.
10. [10_admin_payments.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/10_admin_payments.md) - Quản lý Giao dịch dòng tiền (SePay).
11. [11_admin_premium.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/11_admin_premium.md) - Cấp/Hủy Gói cước Premium.
12. [12_admin_recommendation_model.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/12_admin_recommendation_model.md) - Theo dõi Đánh giá Mô hình AI (Preview).
13. [13_admin_ai_playlist_test.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/13_admin_ai_playlist_test.md) - Sandbox Kiểm thử LLM AI Playlist.
14. [14_admin_data_quality.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/14_admin_data_quality.md) - Giám sát Chất lượng dữ liệu (Data Quality).
15. [15_admin_system_health.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/admin/15_admin_system_health.md) - Trạng thái Sức khỏe Hệ thống (API Uptime).

## Nhóm Hệ thống / AI / Chạy ngầm (System) - 17 chức năng
1. [01_system_architecture.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/01_system_architecture.md) - Kiến trúc Hệ thống (Frontend/Node/FastAPI).
2. [02_database_schema.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/02_database_schema.md) - Thiết kế Cơ sở Dữ liệu MySQL.
3. [03_auth_jwt_refresh_token.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/03_auth_jwt_refresh_token.md) - Cơ chế Authentication & Token.
4. [04_listening_history_tracking.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/04_listening_history_tracking.md) - Engine Theo dõi Hành vi Lịch sử Nghe.
5. [07_ai_playlist_pipeline.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/07_ai_playlist_pipeline.md) - Pipeline Tạo Playlist với LLM (Node.js).
6. [07_music_recommendation_system.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/07_music_recommendation_system.md) - Thuật toán Đề xuất Nhạc (Daily Mix).
7. [08_lyrics_pipeline.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/08_lyrics_pipeline.md) - Chuỗi xử lý Lời bài hát.
8. [09_stem_separation_pipeline.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/09_stem_separation_pipeline.md) - Pipeline Tách Stem (Vocal/Beat) bằng Demucs.
9. [10_payment_webhook_flow.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/10_payment_webhook_flow.md) - Luồng xử lý Webhook SePay.
10. [11_socketio_realtime.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/11_socketio_realtime.md) - Kiến trúc Mạng Socket.IO Realtime.
11. [12_redis_cache_and_session.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/12_redis_cache_and_session.md) - Hệ thống Đệm (Redis Cache).
12. [13_scheduler_cron_jobs.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/13_scheduler_cron_jobs.md) - Tác vụ Lập lịch (Cronjobs).
13. [14_uploads_and_media_storage.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/14_uploads_and_media_storage.md) - Lưu trữ File vật lý đa phương tiện.
14. [15_audio_features_pipeline.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/15_audio_features_pipeline.md) - Phân tích Đặc trưng Âm thanh (MIR).
15. [16_security_and_permissions.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/16_security_and_permissions.md) - Luồng Bảo mật và Guard.
16. [17_error_handling_and_fallbacks.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/17_error_handling_and_fallbacks.md) - Xử lý Lỗi và Dự phòng (Fallback).
17. [18_testing_and_evidence_checklist.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/system/18_testing_and_evidence_checklist.md) - Danh mục Kiểm thử và Bằng chứng Luận văn.

---
## Tài liệu tổng hợp (Root)
- [01_OVERVIEW.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/01_OVERVIEW.md) - Tổng quan dự án MusicFlow.
- [99_COVERAGE_CHECK.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/99_COVERAGE_CHECK.md) - Kiểm tra độ phủ tài liệu chi tiết.
- [98_FINAL_SUMMARY.md](file:///d:/CaNhan/Luan_Van/docs/feature-audit/98_FINAL_SUMMARY.md) - Báo cáo tổng kết đợt rà soát.
