# Tài liệu Hệ thống Gợi ý (Recommendation)

Thư mục này chứa toàn bộ báo cáo, thiết kế thuật toán và kiến trúc của hệ thống Gợi ý Âm nhạc MusicFlow. Dựa trên số liệu đánh giá V3 mới nhất, mô hình lõi đang được sử dụng là **BPR-MF**.

## Nhóm Hiện Tại (Current / V3)
- `01_CURRENT_RECOMMENDATION_SYSTEM.md` - Tổng quan kiến trúc hiện tại.
- `02_V2_TO_CURRENT_MIGRATION_NOTES.md` - Ghi chú sự khác biệt V2 và V3.
- `algorithm-evaluation.md` - Đánh giá thuật toán V3 (Metric chính).
- `bpr-selection-report.md` - Báo cáo lý do chọn BPR-MF.
- `experimental-data.md` - Bộ dữ liệu giả lập 200 User.
- `serving.md` - Luồng API và Controller.
- `scheduler.md` - Hẹn giờ chạy tiến trình tạo Playlist.
- `daily-mix.md`, `weekly-mix.md` - Chức năng Auto-playlist.
- `final_recommendation_v3_evaluation_report.md` - Báo cáo kết quả đánh giá V3 chi tiết.

## Nhóm Lịch sử (Legacy / V2)
*Lưu ý: Các tài liệu này phản ánh giai đoạn V2 (dựa chủ yếu vào Semantic/Contextual Mood) và hiện được giữ lại để làm minh chứng quá trình phát triển.*
- `contextual-mood-evaluation.md`
- `contextual-mood-playlists.md`
- `contextual-mood-recommendation.md`
- `song_semantic_profile_report.md`
- `final_semantic_v2_evaluation_report.md`

## Hướng dẫn cho Báo cáo Luận văn
> [!IMPORTANT]
> Hãy sử dụng số liệu từ `final_recommendation_v3_evaluation_report.md` và `bpr-selection-report.md` làm nền tảng khoa học cho chương Đề xuất Hệ thống Gợi ý. Tuyệt đối không dùng lại các bảng Precision/Recall của báo cáo V2.
