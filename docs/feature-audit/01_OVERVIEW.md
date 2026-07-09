# Tổng quan Dự án MusicFlow (Project Overview)

## 1. Giới thiệu
MusicFlow là một nền tảng phát trực tuyến âm nhạc (Music Streaming Platform) tiên tiến, được xây dựng với kiến trúc Microservices kết hợp với Trí tuệ nhân tạo (AI). Dự án không chỉ dừng lại ở việc phát nhạc cơ bản mà còn mở rộng ra các tính năng mạng xã hội, phòng nghe chung, hệ thống gợi ý bài hát thông minh và công cụ tách âm thanh (Karaoke).

## 2. Kiến trúc Công nghệ
- **Frontend:** Vue 3 (Composition API), Vite, Pinia, Vue Router. (Kiến trúc SPA).
- **Backend:** Node.js, Express.js. Xử lý logic nghiệp vụ, quản lý trạng thái JWT, phục vụ API.
- **Database:** MySQL (Sử dụng Connection Pool, Raw Queries).
- **AI & Workers:** Python, FastAPI. Xử lý các mô hình Học máy (Machine Learning) như Matrix Factorization, Audio Feature Extraction, và Stem Separation (Demucs).
- **Realtime:** Socket.IO.

## 3. Các phân hệ chính (Modules)

### 3.1. Phân hệ Người dùng (Core User Experience)
- Trình phát nhạc (Player) với Hàng đợi thông minh và Lời bài hát cuộn.
- Thư viện cá nhân: Bài hát đã thích, Lịch sử nghe, Theo dõi Nghệ sĩ.
- Mạng xã hội: Chat trực tiếp (Direct Message), Nghe cùng nhau (Listen Together), Chia sẻ bài hát/Playlist.
- Tìm kiếm: Tìm kiếm linh hoạt với cơ chế chấm điểm (Scoring) và chống lỗi dấu tiếng Việt.

### 3.2. Phân hệ AI & Cá nhân hóa
- **Daily Mix / Recommendation:** Đề xuất bài hát bằng mô hình Học máy (BPR-MF) dựa trên lịch sử nghe.
- **AI Playlist Generator:** Sử dụng Generative AI (LLM - Gemini/Claude) để hiểu câu lệnh tự nhiên của người dùng và dịch thành lệnh truy vấn bài hát phù hợp trong DB.
- **Stem Separation:** Sử dụng AI để tách Beat và Vocal, tạo nền tảng cho tính năng Hát Karaoke.

### 3.3. Phân hệ Quản trị (Admin Panel)
- Trang tổng quan (Dashboard) với các biểu đồ trực quan về doanh thu và hoạt động hệ thống.
- Quản lý Dữ liệu (Music Data Tools): Rà soát file âm thanh lỗi, thiếu ảnh cover, tự động đồng bộ (Sync) thông tin nghệ sĩ từ các nguồn bên ngoài.
- Quản lý Người dùng và Gói cước (Premium).
- Quản lý Sức khỏe Mô hình AI (AI Recommendation & Stem Jobs).

### 3.4. Phân hệ Thanh toán (Payment)
- Tích hợp cổng thanh toán SePay / VietQR.
- Cơ chế Webhook nhận thông báo nạp tiền tự động và Realtime đẩy về cho khách hàng qua Socket.IO.

## 4. Mục tiêu của bộ tài liệu Feature Audit
Bộ tài liệu (Nằm trong thư mục `docs/feature-audit/`) đóng vai trò:
1. **Rà soát mã nguồn:** Ghi nhận thực trạng của codebase so với bản thiết kế ban đầu.
2. **Cung cấp Bằng chứng:** Là cơ sở lập luận để đưa vào Báo cáo Luận văn Tốt nghiệp.
3. **Chỉ nam cho Developer:** Giúp người mới (Onboarding) nhanh chóng hiểu được một tính năng A đang nằm ở dòng code nào và tương tác với Bảng DB nào.

## 5. Danh mục
Vui lòng tham khảo file `00_INDEX.md` để xem toàn bộ 40+ tài liệu chi tiết cho từng ngóc ngách của hệ thống.
