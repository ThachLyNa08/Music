# Recommendation trong MusicFlow

Thư mục này chỉ giữ tài liệu của pipeline recommendation đang dùng trong phiên bản hiện tại của MusicFlow.

## Kiến trúc hiện tại

Luồng chính:

```text
Implicit feedback / onboarding
          ↓
Candidate generation
          ↓
LightGCN Hybrid + Content-Based / fallback
          ↓
Re-ranking theo mức độ phù hợp và đa dạng
          ↓
Tempo-aware layer khi có ngữ cảnh thời điểm / hoạt động
          ↓
Recommendation / Daily Mix / Weekly Mix / System Playlist
```

LightGCN Hybrid được dùng làm mô hình gợi ý lõi cho người dùng có đủ lịch sử. BPR-MF Hybrid vẫn được giữ trong phần đánh giá để so sánh. Với người dùng mới hoặc khi model không sẵn sàng, hệ thống dùng onboarding, Content-Based và các tầng fallback từ dữ liệu thật trong cơ sở dữ liệu.

## Tài liệu nên đọc

- `v4/RECOMMENDATION_V4_REPORT.md`: kết quả đánh giá các phương pháp V4.
- `v4/recommendation_v4_architecture.mmd`: sơ đồ kiến trúc recommendation V4.
- `v4/recommendation_v4_flow.mmd`: luồng xử lý recommendation V4.
- `TEMPO_AWARE_RECOMMENDATION.md`: lớp xếp hạng lại theo BPM, năng lượng và ngữ cảnh nghe.
- `ai_playlist_rag_notes.md`: Semantic RAG của AI Playlist Generator.
- `serving.md`: luồng phục vụ recommendation ở backend.
- `daily-mix.md`, `weekly-mix.md`: cách tạo playlist tự động.
- `scheduler.md`: lịch làm mới Daily Mix và Weekly Mix.

## Lưu ý

Các báo cáo V2/V3, audit nội bộ, migration notes và tài liệu thử nghiệm cũ đã được loại khỏi repository để tránh nhầm với kiến trúc hiện tại. Dữ liệu đánh giá lịch sử vẫn có thể xem qua Git history khi cần.
