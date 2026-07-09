# Tìm kiếm và AI Search (Search Music)

## 1. Mục đích chức năng
Giúp người dùng tìm thấy bài hát, nghệ sĩ, album hoặc playlist một cách nhanh chóng qua từ khóa. Bao gồm tính năng Suggestion (Gợi ý gõ) và Search Results phân loại.

## 2. Đối tượng sử dụng
- User, Guest.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành tìm kiếm cơ bản (Semantic / Exact Match / Full-text).
- Hỗ trợ loại bỏ dấu tiếng Việt để tìm kiếm dễ dàng (ví dụ "son tung" ra "Sơn Tùng").

## 4. Luồng xử lý tổng quát
1. **Gợi ý nhanh (Suggestions):** User vừa gõ vào ô search (Debounce 300ms), frontend gọi `GET /api/songs/suggestions?q=...`. Backend trả về ngay Top 4 Songs, Top 3 Artists, Top 2 Albums khớp nhất.
2. **Kết quả đầy đủ (Full Search):** User bấm Enter, chuyển sang trang `/search/:query`. Frontend gọi `GET /api/songs/search?q=...`.
3. **Phân tích truy vấn (Backend):** 
   - Hàm `normalizeSearchText` loại bỏ dấu tiếng Việt (`Đ` -> `D`, bỏ dấu thanh).
   - Hàm `getGenreKeyFromQuery` nhận diện các alias (ví dụ gõ "nhạc việt" -> `vpop-mainstream`).
   - Query SQL chạy song song tìm kiếm trên bảng `songs`, `artists`, `albums`, `genres` sử dụng mệnh đề `LIKE`.
4. **Chấm điểm (Scoring):** Các bài hát khớp Tên (Title) được điểm cao hơn bài hát khớp Lời (Lyrics). Hiển thị kết quả giảm dần theo điểm.

## 5. Luồng xử lý chi tiết
- **Trường hợp tìm qua Lời bài hát:** Nếu không khớp Title/Artist, SQL sẽ tìm trong cột `lyrics`. Nếu khớp, trả về đoạn `matchedSnippet` (cắt 60 ký tự trước/sau từ khóa) để bôi đậm (highlight) trên giao diện.
- **Trường hợp AI Semantic Search:** Nếu cấu hình (Future), backend có thể đẩy query "bài hát thất tình" sang Vector Database (Milvus/Pinecone) để lấy ra bài hát theo ý nghĩa. Hiện tại mới đang dùng Regex/Like.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/search/SearchView.vue
apps/frontend/src/components/common/TopBar.vue (chứa thanh Search bar)
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/song.routes.js
apps/backend/src/controllers/song.controller.js (Hàm searchSongs, getSuggestions)
```

## 8. Vị trí code AI service nếu có
Chưa áp dụng Vector Search ở cấp độ API công khai.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/songs/suggestions?q=`| Tìm nhanh (Dropdown) | Optional | `song.controller.js` |
| GET | `/api/songs/search?q=`| Tìm sâu, trả full list | Optional | `song.controller.js` |

## 10. Database liên quan
- Tra cứu bảng `songs`, `artists`, `albums`, `genres`. (Chủ yếu là mệnh đề `LIKE %keyword%`).

## 11. Realtime / Socket.IO / Redis nếu có
Không có.

## 12. Quyền truy cập và bảo mật
- API công khai (Guest có thể search). Nếu có user token thì trả về thêm trạng thái `is_liked`.

## 13. Dữ liệu đầu vào và đầu ra
- Input: String `q`.
- Output: Object `{ songs: [], artists: [], albums: [], genres: [] }`.

## 14. Loading / Empty / Error state trên giao diện
- Hiển thị "Không tìm thấy kết quả phù hợp" nếu mảng rỗng.
- Hiển thị Skeleton cho từng danh mục trong lúc chờ API.

## 15. Điểm đã làm tốt
- Logic tính điểm `_score` ở Backend rất tốt (Ưu tiên khớp Title 120 điểm > khớp Artist 80 điểm > khớp Lyrics 45 điểm).
- Xử lý tốt chữ tiếng Việt không dấu (Non-accented fallback).

## 16. Hạn chế hiện tại
- Lạm dụng câu lệnh `LIKE '%...%'` dẫn đến việc không tận dụng được Index của MySQL, Full Table Scan có thể làm chậm hệ thống khi DB lên trăm ngàn bài hát.

## 17. Đề xuất hoàn thiện
- Áp dụng ElasticSearch hoặc Meilisearch chuyên biệt cho Text Search.
- Áp dụng Vector Database để search ngữ nghĩa (Ví dụ gõ "Nhạc đám cưới" tự ra bài "Hơn cả yêu").

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra hàm `searchSongs` với thuật toán scoring `_score` trong `song.controller.js`.
