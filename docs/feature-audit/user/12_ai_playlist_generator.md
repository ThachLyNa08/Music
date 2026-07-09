# Trình Tạo AI Playlist (AI Playlist Generator)

## 1. Mục đích chức năng
Cho phép người dùng tạo ra một danh sách phát (Playlist) theo bất kỳ yêu cầu, bối cảnh, cảm xúc hoặc chủ đề nào bằng cách sử dụng ngôn ngữ tự nhiên (Vd: "Tạo cho tôi một list nhạc Việt Indie chill chill để làm việc lúc trời mưa"). Hệ thống AI sẽ phân tích ngữ nghĩa và trích xuất ra các bài hát phù hợp có sẵn trong cơ sở dữ liệu.

## 2. Đối tượng sử dụng
- User, Premium User.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thiện và tích hợp thực tế.
- Giải thích: Có sẵn Prompt Suggestions, Preview Playlist, và nút Save vào thư viện cá nhân. Tích hợp Provider là AI Service của MusicFlow hoặc API LLM (Gemini/Claude).

## 4. Luồng xử lý tổng quát
1. **Nhập Yêu cầu (Prompt):** User nhập văn bản hoặc chọn Suggestion.
2. **Phân tích Intent (`POST /api/ai-playlist/preview-intent`):** Backend gửi prompt sang LLM/Service. AI trích xuất (Extract) ra các trường như `genres`, `moods`, `eras`, `artists`, `keywords`, `language`.
3. **Matching DB (`POST /api/ai-playlist/preview`):** Dựa vào Intent đã trích xuất, Backend (Controller) viết câu SQL ghép các trọng số (Match score) để query vào bảng `songs`, `artists`, `genres`.
4. **Hiển thị Preview:** Trả về 20 bài hát có điểm Match cao nhất. Frontend hiển thị danh sách cho User nghe thử.
5. **Lưu Playlist (`POST /api/ai-playlist/save`):** Nếu User ưng ý, bấm Lưu. Backend insert bản ghi vào bảng `playlists` với `type = 'ai_generated'`.
6. **Tinh chỉnh (Refine):** Nếu User muốn đổi (VD: "Đổi sang nhạc Mỹ đi"), hệ thống gửi tiếp API `/refine` kèm theo Intent cũ và lịch sử hội thoại để AI sửa lại cấu hình truy vấn.

## 5. Luồng xử lý chi tiết
- **Trường hợp Fallback không dùng LLM:** Biến `useLLM=false` cho phép hệ thống sử dụng Heuristic Fallback (Quy tắc Regex/Keyword matching tĩnh ở backend) nếu AI API bị lỗi hoặc User không có Premium.
- **Tránh Trùng Lặp (Avoid Previous Songs):** Khi Refine, mảng `previousSongIds` được gửi kèm để câu lệnh SQL loại trừ (`NOT IN`) những bài User đã nghe thử ở step trước, giúp kết quả luôn mới mẻ.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/ai-playlist/AiPlaylistGeneratorView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/aiPlaylist.routes.js
apps/backend/src/controllers/aiPlaylist.controller.js
apps/backend/src/services/aiPlaylistIntent.service.js
apps/backend/src/services/aiPlaylist.service.js
```
- Core logic gọi LLM nằm ở `aiPlaylistIntent.service.js` (hoặc thông qua Python AI Service).

## 8. Vị trí code AI service nếu có
API LLM thực tế được tích hợp. AI Service có thể đóng vai trò Router gọi ra các provider LLM (Gemini/ChatGPT).

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| POST | `/api/ai-playlist/preview-intent`| Phân tích câu lệnh| Có | `aiPlaylist.controller.js` |
| POST | `/api/ai-playlist/preview`| Truy xuất danh sách| Có | `aiPlaylist.controller.js` |
| POST | `/api/ai-playlist/refine`| Tinh chỉnh danh sách| Có | `aiPlaylist.controller.js` |
| POST | `/api/ai-playlist/save`| Lưu thành playlist thật| Có | `aiPlaylist.controller.js` |

## 10. Database liên quan
- Đọc từ kho `songs`, `genres`, `artists`. Ghi vào `playlists` (`type='ai_generated'`, `source_prompt='...'`).

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng. LLM trả về nhanh (~1-3s) nên gọi dạng REST HTTP bình thường.

## 12. Quyền truy cập và bảo mật
- Yêu cầu Auth. Tuỳ cấu hình kinh doanh mà API phân tích LLM sâu có thể yêu cầu Premium.

## 13. Dữ liệu đầu vào và đầu ra
- Input: `{"prompt": "Nhạc vui vẻ buổi sáng", "useLLM": true}`.
- Output Intent: `{"moods": ["happy", "energetic"], "genres": ["pop"], "artists": []}`.

## 14. Loading / Empty / Error state trên giao diện
- Có Animation Loading (Hiệu ứng sóng AI) rất đẹp trong lúc đợi AI "suy nghĩ".

## 15. Điểm đã làm tốt
- Tách rời bước Intent Extraction (AI) và Song Matching (SQL Database). Tránh được điểm yếu "Hallucination" của LLM (LLM thường bịa ra bài hát không tồn tại trên hệ thống nếu yêu cầu nó trả trực tiếp danh sách bài hát).
- Hỗ trợ lưu trữ lại Context `intent` và `sourcePrompt` vào Database.

## 16. Hạn chế hiện tại
- Thuật toán Song Matching bằng SQL (LIKE/IN) phụ thuộc quá nhiều vào Metadata thủ công của Admin. Bài hát thiếu thẻ Tag sẽ khó lên xu hướng AI Playlist.

## 17. Đề xuất hoàn thiện
- Tích hợp Vector Database để Match trực tiếp Prompt của người dùng với Vector nhúng (Embedding) của bài hát.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra controller `aiPlaylist.controller.js`.
