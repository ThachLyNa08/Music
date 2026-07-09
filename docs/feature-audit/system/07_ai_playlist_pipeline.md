# Luồng xử lý Sinh Playlist AI (AI Playlist Pipeline)

## 1. Mục đích chức năng
Mô tả quy trình Backend xử lý chuỗi (Prompt) văn bản tiếng Việt của người dùng thông qua mô hình ngôn ngữ lớn (LLM - Large Language Model) để tạo ra danh sách phát âm nhạc mang tính cá nhân hóa.

## 2. Đối tượng sử dụng
- System (Pipeline).

## 3. Trạng thái triển khai hiện tại
- Đã được triển khai với 2 hướng xử lý (LLM và Heuristic).
- Giải thích: Tại `aiPlaylistIntent.service.js`, hệ thống kết nối với Google Gemini AI (Hoặc Claude/OpenAI tùy biến).

## 4. Luồng xử lý tổng quát
1. **Lọc Input (Sanitize):** Bỏ ký tự xấu, kiểm tra giới hạn độ dài.
2. **Kích hoạt LLM (Nếu `useLLM = true`):**
   - Backend gọi API của Provider (Ví dụ: `gemini-pro`).
   - Gửi System Prompt (Định hình ngữ cảnh: "Bạn là một chuyên gia âm nhạc phân tích ý định...").
   - Yêu cầu AI trả về duy nhất định dạng JSON Schema chuẩn hóa: `{ "genres": [], "moods": [], "eras": [], "language": "", "keywords": [] }`.
3. **Phân tích Heuristic (Nếu `useLLM = false`):**
   - Dùng Regex tìm từ khóa: Nếu thấy "buồn" -> add `sad` vào moods. Thấy "trẻ" -> add `v-pop`.
4. **Xây dựng SQL Động (Dynamic Query Building):**
   - Từ Object Intent nhận được, Backend nối chuỗi SQL. 
   - Ví dụ: `WHEN genres.name IN ('Pop') THEN 5 ELSE 0`. `WHEN songs.title LIKE '%tình yêu%' THEN 2 ELSE 0`.
5. **Truy vấn DB (Execution):** Chạy lệnh SQL, order by `_score` DESC, trả về mảng bài hát.

## 5. Luồng xử lý chi tiết
- **Trường hợp Hallucination của AI:** Rất khó tránh khỏi việc AI trả về Format sai JSON (Ví dụ: nó nói "Đây là JSON của bạn: { ... }"). Code tại Backend (Service) phải dùng Regex để móc đúng cặp dấu ngoặc nhọn `{ ... }` từ đoạn văn bản Text thuần để `JSON.parse` tránh lỗi Crash Server.

## 6. Vị trí code frontend
Không áp dụng.

## 7. Vị trí code backend
```txt
apps/backend/src/services/aiPlaylistIntent.service.js
apps/backend/src/services/aiPlaylist.service.js
```

## 8. Vị trí code AI service nếu có
Gọi thẳng API SaaS API (Gemini/OpenAI), chưa host LLM Local do tốn kém VRAM.

## 9. API liên quan
Không áp dụng.

## 10. Database liên quan
Bảng `songs`, `artists`, `genres`.

## 11. Realtime / Socket.IO / Redis nếu có
Redis có thể cache lại Cặp (Prompt -> JSON Intent) để lần sau User gõ đúng câu đó thì không cần tốn tiền gọi API Gemini nữa.

## 12. Quyền truy cập và bảo mật
- Khóa API Key (Gemini API Key) trong file `.env`. Tuyệt đối không để lộ ở client-side (Frontend).

## 13. Dữ liệu đầu vào và đầu ra
(Đã miêu tả ở các phần trước).

## 14. Loading / Empty / Error state trên giao diện
Không áp dụng.

## 15. Điểm đã làm tốt
- Kỹ thuật "Prompt Engineering" ép LLM trả JSON và bóc tách Regex rất chắc tay (Robust). 
- Thuật toán Heuristic dự phòng là giải pháp kỹ thuật xuất sắc để app vẫn chạy tốt khi API Key hết tiền.

## 16. Hạn chế hiện tại
- Truy xuất bằng SQL LIKE và trọng số cứng (Hardcoded scores) vẫn mang tính Heuristic cao, phụ thuộc nhiều vào khả năng viết SQL của lập trình viên hơn là sự thông minh thực sự của AI.

## 17. Đề xuất hoàn thiện
- Triển khai Embedding Model: Biến Bài hát và Prompt thành Vector nhiều chiều. Dùng hàm Cosine Similarity trong Milvus DB để so khớp. Đảm bảo chính xác 100% ngữ nghĩa.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã đọc controller và suy diễn logic chuẩn từ `aiPlaylistIntent.service.js`.
