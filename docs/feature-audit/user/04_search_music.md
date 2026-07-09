# Tìm kiếm (Search)

## 1. Mục đích chức năng
Chức năng này giúp người dùng tìm kiếm bài hát, nghệ sĩ, album hoặc thể loại. Đặc biệt hỗ trợ hai chế độ: tìm kiếm thông thường (dùng thuật toán string matching/full-text) và tìm kiếm AI (AI Music Assistant - tự nhiên ngữ nghĩa) trực tiếp từ ô search.

## 2. Đối tượng sử dụng
- User: Tìm bài hát/nghệ sĩ mình muốn nghe.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành tốt.
- Giải thích: Giao diện search hiện đại, có gợi ý auto-complete (Suggestions) khi đang gõ. Backend query database sử dụng kỹ thuật matching phức tạp (score dựa trên title, artist, lyrics match) và hỗ trợ Alias thể loại. Chế độ AI Assistant gọi sang `aiAssistantApi.js` (hoặc Gemini) để phân tích yêu cầu bằng ngôn ngữ tự nhiên. 

## 4. Luồng xử lý tổng quát
1. Người dùng nhập vào ô tìm kiếm `/search`.
2. Frontend gọi API gợi ý `GET /api/songs/suggestions?q=` ngay khi đang gõ (debounce 250ms).
3. Backend phân tích từ khóa, trả về Top Suggestions gồm cả Bài hát, Nghệ sĩ, Album, Playlist.
4. Khi user nhấn Enter hoặc click nút Tìm, gọi API `GET /api/songs/search?q=`.
5. Controller tính điểm `match_score` qua nhiều logic SQL (bao gồm lọc bỏ dấu, ghép alias thể loại, lyrics text search) rồi trả về nhóm dữ liệu (songs, artists, albums, genres).
6. Nếu bật chế độ AI (`isAiMode`), frontend thay vì gọi search DB sẽ gọi POST qua AI Assistant API để parse "ngữ nghĩa" bài hát.
7. Frontend render `SongRow`, `ArtistCard`, `MediaCard` cho các kết quả, nhấn Play trực tiếp.

## 5. Luồng xử lý chi tiết
- **Trường hợp tìm có dấu/không dấu:** Backend gọi các helper `normalizeSearchText` và `compactSearchText` để đảm bảo tìm "Sơn Tùng" hay "son tung" đều ra kết quả chuẩn.
- **Trường hợp gõ thể loại (Genre Aliases):** Ví dụ gõ "kpop 4", backend tự động detect alias trả về nhóm nhạc thể loại "kpop-gen4" thay vì tìm string khô khan.
- **Trường hợp tìm lời bài hát (Lyrics Search):** Nếu query không khớp Title/Artist, nhưng có chữ nằm trong lyrics, điểm số `score` sẽ tăng và trích xuất đoạn `matchedSnippet` (câu hát chứa từ khóa).
- **Trường hợp AI Search Mode:** User nhập "Cho mình vài bài nhạc buồn mưa". AI Service dịch prompt sang SQL Filter (hoặc array song_id) -> trả lại list bài hát tương ứng để Play ngay.
- **Trường hợp Empty (Chưa gõ):** Hiển thị Top Artists phổ biến nhất hệ thống + Danh mục Thể loại đầy đủ (Browse Genres).

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/search/SearchView.vue
apps/frontend/src/api/song.js
apps/frontend/src/api/aiAssistant.js
```
- `SearchView.vue`: Chứa logic giao diện khổng lồ, xử lý Debounce gõ phím, AutoComplete dropdown, lưu Lịch sử tìm kiếm vào LocalStorage, toggle AI Mode.
- `api/song.js` & `api/aiAssistant.js`: Giao tiếp với backend.

## 7. Vị trí code backend
```txt
apps/backend/src/routes/song.routes.js
apps/backend/src/controllers/song.controller.js
```
- `song.routes.js`: Định nghĩa `/search`, `/suggestions`.
- `song.controller.js`: Xử lý cực kỳ tỉ mỉ các trường hợp tìm kiếm. Sử dụng điểm Score tuỳ chỉnh (Match Title = +120, Match Artist = +80, Lyrics = +45, Match Tokens = +30).

## 8. Vị trí code AI service nếu có
```txt
apps/ai-service/ (nếu có Gemini parsing logic)
apps/backend/src/routes/aiAssistant.routes.js
```
Chức năng này tích hợp sâu với **AI Music Assistant** (ngay trên Search bar). Frontend gọi `aiAssistantApi.music()`.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/songs/suggestions`| Gợi ý real-time khi gõ | Không (Optional) | `song.controller.js` |
| GET | `/api/songs/search` | Search full | Không (Optional) | `song.controller.js` |
| POST| `/api/ai-assistant/music` | Xử lý NLP qua search | Tùy chọn | `aiAssistant.routes.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `songs` | Đọc thông tin bài hát | Đọc | Lọc theo title, lyrics, duration |
| `artists` | Đọc thông tin nghệ sĩ | Đọc | Lọc theo name |
| `albums` | Đọc thông tin album | Đọc | Lọc theo title |
| `genres` | Ánh xạ Alias | Đọc | Map từ khóa sang slug |

## 11. Realtime / Socket.IO / Redis nếu có
Chức năng này chưa phát hiện sử dụng Socket.IO hoặc Redis caching (Nên dùng Redis cache cho suggestions).

## 12. Quyền truy cập và bảo mật
- APIs dùng `optionalAuthenticate` (Không đăng nhập vẫn search được, nhưng nếu có token sẽ check thêm trạng thái `is_liked` của từng bài hát).

## 13. Dữ liệu đầu vào và đầu ra
- Input: `?q=Sơn Tùng`, `&limit=15`.
- Output: `{ songs: [], artists: [], albums: [], genres: [] }`.

## 14. Loading / Empty / Error state trên giao diện
- **Loading:** Skeleton loading khi lấy Popular Artists ban đầu; Vòng tròn xoay khi Search & AI Search.
- **Empty:** Trả về "Không tìm thấy kết quả phù hợp cho..." kèm icon.
- **Error:** Nếu API AI lỗi -> Báo đỏ "AI Music Assistant đang gặp lỗi".

## 15. Điểm đã làm tốt
- Chấm điểm (Scoring) kết quả tìm kiếm rất tinh tế, ưu tiên kết quả chính xác cao và bài hit nhiều play_count.
- Xử lý No-Accent (Tiếng Việt không dấu) rất chuẩn ngay tại JS/NodeJS trước khi đẩy vào MySQL (tránh phụ thuộc Collation DB).
- Tích hợp AI ngay vào thanh search với Toggle "✦" rất tương lai.

## 16. Hạn chế hiện tại
- Câu query LIKE `%%` trên trường `lyrics` (LONGTEXT) trong MySQL sẽ là nút thắt cổ chai về performance nếu DB lên 100,000 bài hát.
- Thiếu Elasticsearch / Typesense.

## 17. Đề xuất hoàn thiện
- Về lâu dài, tính năng tìm kiếm qua Lyrics nên được chuyển sang Elasticsearch hoặc dùng MySQL FULLTEXT INDEX thay vì `LIKE %...%`.
- Thêm Redis cache cho các query phổ biến (Top 100 queries).

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/frontend/src/views/search/SearchView.vue`
- `apps/backend/src/routes/song.routes.js`
- `apps/backend/src/controllers/song.controller.js`
