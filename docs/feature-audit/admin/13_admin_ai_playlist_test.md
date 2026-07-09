# Test Mô hình Sinh Playlist AI (Admin AI Playlist Test)

## 1. Mục đích chức năng
Trang công cụ ẩn dành riêng cho kỹ sư (Admin/Developer) để kiểm thử (Test/Debug) prompt và thuật toán lấy Playlist từ AI. So sánh kết quả trả về khi đổi cấu hình LLM mà không làm ảnh hưởng đến thư viện playlist thực tế.

## 2. Đối tượng sử dụng
- Admin.

## 3. Trạng thái triển khai hiện tại
- Đã triển khai route `POST /api/admin/ai-playlist-test/preview`.
- Giải thích: Admin có thể nhập chuỗi Prompt và bắt hệ thống phân tích. Kết quả trả về giống hệt như màn hình AI Playlist của User nhưng có thêm các thẻ Log chi tiết (JSON thô) hiển thị rõ `intent`, `keywords`, và `SQL Query` được tạo ra để Developer bắt bệnh lỗi (Vd: Tại sao gõ "nhạc buồn" lại ra nhạc Sơn Tùng).

## 4. Luồng xử lý tổng quát
1. **Gửi Yêu cầu (`POST /api/admin/ai-playlist-test/preview`):** Admin gửi Prompt.
2. **Gọi LLM Extraction:** Trích xuất Intent (Sử dụng service `aiPlaylistIntent.service.js`).
3. **Hiển thị Log thô:** Thay vì chỉ hiện Bài hát, API trả về cả Object Intent `{ moods: [], genres: [], ...}` và danh sách bài được Match, kèm Điểm số Match (Score).
4. **Không Ghi Nhận User ID:** Không lưu vào DB, không trừ hạn mức Premium.

## 5. Luồng xử lý chi tiết
- **Trường hợp Thử nghiệm Trọng số (Score Tuning):** Nếu thuật toán `LIKE '%buồn%'` được 5 điểm, `mood = sad` được 10 điểm. Trang Test sẽ hiển thị cột Break-down điểm của từng bài hát để kỹ sư điều chỉnh.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/AiPlaylistTestView.vue (Hoặc Tab ẩn trong Dashboard)
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js (dòng 57)
apps/backend/src/controllers/admin_ai_playlist_test.controller.js
```

## 8. Vị trí code AI service nếu có
Kiểm tra hiệu suất kết nối đến Gemini / OpenAI API.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| POST | `/api/admin/ai-playlist-test/preview`| Sandbox Test AI | Admin | `admin_ai_playlist_test.controller.js`|

## 10. Database liên quan
- Tra cứu bảng `songs`, `genres`, `artists` (Read-only).

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- Middleware `requireAdmin`.

## 13. Dữ liệu đầu vào và đầu ra
- Output chi tiết hơn API thường: `{ intent: {...}, sqlLog: "...", items: [...] }`.

## 14. Loading / Empty / Error state trên giao diện
- Hiển thị TreeView JSON cho các chuỗi Log.

## 15. Điểm đã làm tốt
- Xây dựng tư duy Sandbox cho Developer ngay trong lòng ứng dụng Production, rất tuyệt vời để Tinh chỉnh (Fine-tune) tính năng.

## 16. Hạn chế hiện tại
- Chưa có tính năng Lưu Preset Test (Lưu lại 10 mẫu câu Test Case, mỗi lần sửa code chỉ cần bấm 1 nút là chạy lại cả 10 câu để xem có bị Regression - Lỗi hồi quy - không).

## 17. Đề xuất hoàn thiện
- Thêm cơ chế Regression Testing bằng cách cho phép Upload file CSV chứa các Prompt test.

## 18. Bằng chứng mã nguồn đã kiểm tra
Kiểm tra khai báo route ở `admin.routes.js` dòng 57.
