# Checklist Kiểm thử & Bằng chứng Luận văn (Testing & Evidence Checklist)

## 1. Mục đích chức năng
Chỉa khóa quan trọng để xác nhận các tính năng trên đã chạy thật chứ không phải mã ảo. Dùng làm cơ sở để thu thập Minh chứng (Screenshot, DB Row, Console Log) chụp hình gắn vào Báo cáo Luận văn.

## 2. Đối tượng sử dụng
- Tester, Học viên làm báo cáo.

## 3. Trạng thái triển khai hiện tại
- (Tài liệu tổng hợp).

## 4. Danh sách các Mục cần Kiểm thử & Chụp ảnh (Evidence)

### Khối Kiến trúc & Cơ sở Dữ liệu
- [ ] Chụp màn hình sơ đồ EER Diagram của MySQL (Cho thấy hàng chục bảng kết nối với nhau).
- [ ] Chụp bảng `listening_history` chứa > 10.000 dòng dữ liệu mô phỏng.

### Khối Người dùng (Cơ bản)
- [ ] Chụp giao diện Giao diện Trình phát Nhạc (Player) đang chạy.
- [ ] Ảnh GIF màn hình Hát Karaoke với lời cuộn.
- [ ] Ảnh giao diện Tìm kiếm hiển thị đầy đủ Đề xuất (Suggest) có Highlight.
- [ ] Giao diện Thư viện Cá nhân (Liked Songs) đồng bộ trái tim đỏ.

### Khối Tính năng Nâng cao (Social & Premium)
- [ ] Cửa sổ Chat Realtime (Mở 2 Tab, chat qua lại, chụp log mạng Socket.IO).
- [ ] Nút Chia sẻ (Share Song) thả vào Box Chat.
- [ ] Quét mã QR SePay, chụp màn hình điện thoại đã trừ tiền, và chụp màn hình máy tính tự động bật Popup "Nạp thành công" mà không cần F5.

### Khối Trí tuệ Nhân tạo (AI & System)
- [ ] Màn hình AI Playlist: Nhập Prompt lạ, chụp lại kết quả trả về phù hợp ngữ nghĩa.
- [ ] Tab Admin AI Playlist Test: Chụp Log JSON chứa Intent Extraction của Gemini.
- [ ] Log Terminal của Server FastAPI: Hiện thanh Progress Bar (0-100%) khi đang cắt Beat/Vocal bằng Demucs. Chụp file MP3 Instrumental và Vocals sinh ra trong thư mục `uploads/stem`.
- [ ] Báo cáo Hiệu năng AI (Admin Panel): Chụp biểu đồ hoặc Bảng chỉ số Precision/Recall của Mô hình Gợi ý BPR-MF.

## 5. Những phần hạn chế (Nên ẩn đi trong Luận văn)
- Tính năng Follow/Đồng bộ Playlist chưa được thử nghiệm Tải Tải nặng (Load test).
- Giao diện Admin quản lý Cờ Taxonomy khá chuyên ngành, chỉ nên báo cáo kết quả thay vì sâu vào UI.

## 6. Công cụ sử dụng để Test
- Postman (Test API).
- JMeter (Nếu cần test áp lực hàng ngàn user lấy gợi ý cùng lúc).
- MySQL Workbench.
- Trình duyệt Chrome DevTools (Tab Network / WS).
