# Ghi chú chuyển đổi tài liệu Recommendation từ V2 sang phiên bản hiện tại (V3)

## 1. Các nội dung V2 đã lỗi thời
- Lời khẳng định "Contextual Mood và Semantic" là cốt lõi (Core Engine) của hệ thống. Ở V3, nó đã lui về làm Supporting Component.
- Các metric cũ trong `final_semantic_v2_evaluation_report.md` đã bị vượt qua bởi dữ liệu của 200 users và catalog > 7000 bài hát.

## 2. Các nội dung V2 vẫn còn dùng
- Chuỗi xử lý (Pipeline) tách Semantic Profile (Bảng CSV `song_semantic_profiles.csv`). Vẫn dùng làm metadata cho Content-based Fallback.
- Logic Fallback dựa trên Mood (Rule-based).

## 3. Các khái niệm cần đổi tên
- "Hệ thống Semantic" -> "Lớp Phụ trợ Semantic (Supporting Layer)".
- "Mô hình V2" -> "BPR-MF V3".

## 4. Các file đã cập nhật
- `algorithm-evaluation.md`, `bpr-selection-report.md`, `experimental-data.md`, `serving.md`, `scheduler.md`, `daily-mix.md`, `weekly-mix.md`. (Đều đã được viết lại bằng số liệu V3).

## 5. Các file giữ lại làm lịch sử
- Nhóm `contextual-mood-*.md`.
- `song_semantic_profile_report.md`.
- `final_semantic_v2_evaluation_report.md`.

## 6. Các số liệu không còn dùng làm kết luận
- Các bảng Precision/Recall/NDCG cũ trước tháng 7/2026.

## 7. Các số liệu hiện tại được dùng
- Lấy từ `storage/recommendation/evaluation/v3/metrics/recommendation_final_semantic_v3_summary.json`. 
- Metric tiêu biểu: BPR-MF Precision@10 đạt 0.0985, NDCG@10 đạt 0.0978.

## 8. Checklist cập nhật luận văn
- Đổi các chương phân tích thuật toán trọng tâm sang tập trung vào BPR-MF. Giải thích Semantic chỉ dùng cho AI Playlist (Gemini) và Content-based reranking.
