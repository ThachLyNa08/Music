# Hệ thống Tách Beat và Hát Karaoke (Stem Separation Pipeline)

## 1. Mục đích chức năng
Cho phép người dùng biến bất kỳ bài hát nào có sẵn trên hệ thống thành phiên bản Karaoke (không có giọng hát) bằng cách tách nguồn âm thanh (stem separation). Sau đó, người dùng có thể tải beat (đối với tài khoản Premium) hoặc trực tiếp hát Karaoke trên trình duyệt.

## 2. Đối tượng sử dụng
- User: Yêu cầu tách beat, hát Karaoke.
- Premium User: Tải file Instrumental (Beat) chất lượng cao về máy.
- System/AI Service: Đảm nhận chạy thuật toán Demucs nặng nề.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành rất tốt và tích hợp đầy đủ.
- Giải thích: Flow bất đồng bộ (Asynchronous) hoàn chỉnh. Frontend gọi API yêu cầu tách (Request), Backend sinh Job đưa vào Queue chờ. Backend báo sang AI Service qua `httpx`. AI Service (FastAPI) nhận job, fork subprocess chạy `demucs`, cập nhật tiến độ (progress 5%, 15%, 85%, 100%) liên tục về Backend thông qua Callback URL. Backend sau đó đẩy thông báo Realtime qua Socket.IO để Frontend hiển thị thanh tiến trình. Khi hoàn thành, Frontend tự chuyển sang màn hình Karaoke.

## 4. Luồng xử lý tổng quát
1. **Frontend (User Action):** Bấm "Hát Karaoke" ở bài hát bất kỳ.
2. **Backend (`POST /api/stem/songs/:id/separate`):** Kiểm tra xem bài hát đã có stem (Vocals/Instrumental) trong thư mục uploads hay chưa. Nếu đã có, trả về kết quả ngay (Cache-hit). Nếu chưa, tạo bản ghi `stem_separation_jobs` (trạng thái `pending`).
3. **Chuyển giao AI Service:** Backend gửi request POST đến `http://ai-service/api/stem/jobs` với đường dẫn file audio gốc, thư mục lưu kết quả, và URL callback.
4. **AI Service (`main.py`):**
   - Fork một task background chạy lệnh `python -m demucs --two-stems=vocals -n htdemucs ...`
   - Gọi callback liên tục báo % progress về backend (`PATCH /api/stem/internal/jobs/:jobId`).
   - Sau khi Demucs tách xong, dời 2 file `vocals.mp3` và `instrumental.mp3` sang thư mục yêu cầu (`output_dir`).
5. **Callback hoàn tất:** AI Service gọi callback với status `completed`.
6. **Backend & Socket:** Backend nhận status `completed`, cập nhật DB, dùng `Socket.IO` emit `stem:job-completed` cho user. Đồng thời sinh thông báo hệ thống (Notification).

## 5. Luồng xử lý chi tiết
- **Trường hợp Trùng lặp (Idempotency):** Nếu 2 user cùng bấm Tách 1 bài hát cùng lúc, hệ thống kiểm tra nếu đã có job `pending/processing` cho bài đó thì chỉ join vào chờ chung (không gọi AI Service lần 2 gây quá tải).
- **Trường hợp Bảo mật Callback:** Callback từ AI Service về Backend được bảo vệ bởi header `x-stem-callback-token`, đảm bảo không bị giả mạo trạng thái từ bên ngoài.
- **Trường hợp Fallback / Lỗi AI:** Nếu file Audio lỗi hoặc AI Service chết nửa chừng, callback `failed` sẽ được gọi. Backend cập nhật DB `error_message` và đẩy Socket báo lỗi cho frontend.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/karaoke/KaraokeView.vue
```
- Giao diện có thanh Progress Bar, nhận event Socket để cập nhật. Khi 100% tự động tải trình phát Karaoke với LRC/Plain lyrics sync và file audio instrumental.

## 7. Vị trí code backend
```txt
apps/backend/src/routes/stem.routes.js
apps/backend/src/controllers/stem.controller.js
apps/backend/src/services/stem.service.js
```
- `stem.service.js` là hạt nhân, xử lý logic kiểm tra Job tồn tại, lấy đường dẫn public, và trigger HTTP POST qua AI.
- Controller có middleware chặn quyền tải beat cho tài khoản Premium (`getInstrumentalDownload`).

## 8. Vị trí code AI service
```txt
apps/ai-service/app/main.py
```
- Sử dụng framework Demucs của Facebook/Meta (cụ thể là model `htdemucs` - Hybrid Transformer).
- Xử lý cô lập qua `tempfile` chống đụng độ file khi chạy nhiều luồng.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| POST | `/api/stem/songs/:id/separate`| Yêu cầu tách | Có | `stem.controller.js` |
| GET | `/api/stem/songs/:id/latest`| Lấy Job hiện tại của User| Có | `stem.controller.js` |
| PATCH | `/api/stem/internal/jobs/:id`| Callback từ AI Service | Auth (Token nội bộ)| `stem.controller.js` |
| GET | `/api/stem/jobs/:id/download/instrumental`| Tải file Beat | Premium | `stem.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `stem_separation_jobs` | Theo dõi tiến độ tách | Đọc/Ghi | status: pending/processing/completed/failed |
| `song_stems` | Bộ cache Stem vĩnh viễn | Đọc/Ghi | Tránh tách lại những bài người trước đã tách |

## 11. Realtime / Socket.IO / Redis nếu có
- Sử dụng Socket.IO (`getIo().to(userRoom)`) liên tục emit `% progress` để làm thanh tiến trình chạy mượt trên giao diện.

## 12. Quyền truy cập và bảo mật
- Nghe Karaoke: Tất cả user đăng nhập.
- Tải file MP3 Beat (`downloadInstrumental`): Hàm `isPremiumUser()` kiểm tra nếu hạn Premium chưa hết thì cho phép tải qua `res.download()`.

## 13. Dữ liệu đầu vào và đầu ra
- API request separation không cần body, chỉ cần `songId`.
- AI Service callback Payload: `{ "status": "processing", "progress": 15, "vocals_url": "...", "instrumental_url": "..." }`.

## 14. Loading / Empty / Error state trên giao diện
- Giao diện có thông báo lỗi nếu AI sập. Nếu bài hát chưa có audio (audio URL lỗi) thì báo ngay từ backend mà không đẩy sang AI.

## 15. Điểm đã làm tốt
- Thiết kế hệ thống Background Task + Polling/Socket.IO rất chuyên nghiệp, tránh việc HTTP Timeout vì tách stem mất từ 1-3 phút.
- Quản lý file ngăn nắp (`uploads/stems/:songId/`).
- Tích hợp Notifications (Cái chuông góc phải) để báo cho User khi tách xong (lỡ User chuyển trang đi chỗ khác lúc đang tách).

## 16. Hạn chế hiện tại
- Demucs ăn rất nhiều CPU/RAM. FastAPI chạy bằng `subprocess` dễ dẫn tới sập server (OOM - Out of memory) nếu nhiều User request tách cùng lúc.
- Chưa có Message Queue (RabbitMQ/Celery) thực thụ cho AI Service, mới đang dùng BackgroundTasks của FastAPI (giới hạn ở mức single-instance).

## 17. Đề xuất hoàn thiện
- Đưa RabbitMQ hoặc Celery/Redis vào AI Service để giới hạn Worker (chỉ chạy song song tối đa 1-2 task Demucs).
- Hỗ trợ model nhẹ hơn cho máy cấu hình yếu (ví dụ Spleeter thay vì htdemucs).

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/backend/src/services/stem.service.js`
- `apps/backend/src/controllers/stem.controller.js`
- `apps/ai-service/app/main.py`
