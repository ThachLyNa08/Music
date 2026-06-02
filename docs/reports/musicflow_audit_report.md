# BÁO CÁO RÀ SOÁT MUSICFLOW - CHỈ AUDIT, KHÔNG CHỈNH SỬA

Báo cáo này được thực hiện dưới vai trò Senior Fullstack Reviewer / QA Architect. Quá trình kiểm tra quét toàn bộ Frontend (Vue 3, Tailwind), Backend (Node.js, Express) và thiết kế Database.

---

## 1. Tổng quan tình trạng hệ thống

* **Mức độ hoàn thiện chung:** Hệ thống đạt khoảng **70-75%**. Các luồng cơ bản (Auth, Home, Player, Admin) đã hoạt động và kết nối dữ liệu thật. Giao diện (UI) khá chỉn chu, responsive tốt và bám sát thiết kế hiện đại của Spotify.
* **Các chức năng ổn:** Xác thực người dùng (Auth), quản lý phát nhạc (Player), Layout/Responsive, hệ thống quản trị Admin (quản lý người dùng, bài hát, nghệ sĩ, giao dịch rất chi tiết và an toàn), và luồng nghe nhạc cơ bản.
* **Các chức năng có nguy cơ lỗi:** 
  - Hệ thống gợi ý (Recommendation) hiện đang dùng hàm `RAND()` của SQL, có thể gây chậm (Performance/Bottleneck) nếu lượng bài hát lớn.
  - Chức năng Sync Music đọc từ CSV có rủi ro timeout nếu import số lượng cực lớn.
* **Các chức năng còn mock/stub (chỉ có giao diện, chưa có logic):** 
  - **AI Playlist Generator**
  - **Karaoke / Stem Separation**
  - **Premium / Thanh toán QR**

---

## 2. Danh sách lỗi nghiêm trọng cần ưu tiên

### 1. Luồng Premium / Thanh toán giả lập (Critical)
* **Khu vực:** Frontend & Backend (`PremiumView.vue`, `payment.routes.js`)
* **Mô tả vấn đề:** Chức năng nâng cấp Premium hiển thị QR Code giả bằng SVG. Không hề tạo order, không kết nối gateway (MoMo/VNPay/Stripe), đếm ngược bằng `setInterval` ở client và khi hết giờ chỉ hiện `alert()`. Backend route chỉ trả về thông báo tĩnh `{ message: 'payment routes' }`.
* **Luồng tái hiện:** Vào trang Premium -> Chọn gói -> Hiện mã QR -> Mã QR là icon tĩnh, không quét được -> Chờ 5 phút -> Báo lỗi.
* **Ảnh hưởng:** Nếu demo luận văn và giám khảo quét thử QR hoặc đòi xem lịch sử tạo đơn hàng, hệ thống sẽ bị lộ là giả mạo hoàn toàn.
* **Gợi ý hướng xử lý:** Tích hợp API tạo mã QR động của VietQR / MoMo, hoặc làm một luồng thanh toán giả lập có lưu data vào bảng `transactions` để kích hoạt Premium thật sự.

### 2. AI Playlist & Karaoke chỉ là Mockup UI (High)
* **Khu vực:** Frontend (`AiPlaylistView.vue`, `KaraokeView.vue`), Backend (`stem.routes.js`)
* **Mô tả vấn đề:** 
  - Trang **AI Playlist** khi nhập prompt và bấm Generate chỉ làm hiện ra danh sách 4 bài hardcode (VD: *Neural Grooves*, *Soft Circuit Rain*).
  - Trang **Karaoke** thì lời bài hát được fix cứng (*Mùa xuân sang có hoa anh đào...*), chỉnh volume slider không thực sự tách nhạc.
* **Luồng tái hiện:** Truy cập `/ai` hoặc `/karaoke` -> Thao tác trên giao diện -> Dữ liệu hiển thị không khớp thực tế.
* **Ảnh hưởng:** Chức năng được highlight là AI nhưng thực chất chưa tích hợp AI service nào. Mất điểm nặng nếu bị yêu cầu review logic tách stem hoặc gen playlist.
* **Gợi ý hướng xử lý:** Nối API gọi OpenAI/Gemini để gen danh sách bài hát cho AI Playlist. Với Karaoke, nếu không có AI server thì nên có một tool tách sẵn 1-2 bài demo để play 2 luồng audio cùng lúc.

### 3. Tối ưu thuật toán Recommend bằng SQL RAND() (Medium)
* **Khu vực:** Backend (`recommendation.controller.js`)
* **Mô tả vấn đề:** API gen playlist gợi ý đang sử dụng truy vấn `ORDER BY is_followed_bonus DESC, RAND() LIMIT 20`. `RAND()` trên SQL bắt buộc DB phải duyệt toàn bộ bảng và cấp số ngẫu nhiên rồi mới sort.
* **Ảnh hưởng:** Gây sụt giảm hiệu năng nghiêm trọng (table scan) khi số lượng bài hát lên tới hàng chục nghìn.
* **Gợi ý hướng xử lý:** Có thể lấy danh sách ID bài hát thỏa mãn điều kiện trước, rồi chọn ngẫu nhiên ở tầng Application (Node.js) thay vì dùng `RAND()` trong DB.

---

## 3. Rà soát từng chức năng

| Module | Tình trạng | Chi tiết / Đánh giá |
|--------|------------|---------------------|
| **Auth** | 🟢 Tốt | Có mã hóa password, JWT, middleware `authenticate`. Router bảo vệ nghiêm ngặt (redirect guest về login, ép admin vào `/admin`). |
| **Player** | 🟢 Tốt | Global store (`PlayerStore`), đồng bộ tốt với component `PlayerBar`. Player ẩn hiện đúng logic, có queue, play, pause đầy đủ. |
| **Song card / Row** | 🟢 Tốt | Có component `SongRow.vue` chuẩn hóa, dùng chung cho nhiều nơi (Home, Playlist, Search). Tích hợp sẵn `SongActionMenu.vue`. |
| **Search** | 🟢 Tốt | Route và layout phân chia rõ ràng. Dữ liệu thật từ DB. |
| **Artist / Album** | 🟢 Tốt | Follow artist hoạt động. Controller `artist.controller.js` bắt logic fallback đầy đủ. API trả bài hát theo nghệ sĩ tốt. |
| **Playlist** | 🟢 Tốt | CRUD cho playlist người dùng (manual) tốt. Playlist hệ thống tự tạo khi user request home recommendations. |
| **Like / Favorite** | 🟢 Tốt | Bấm like/unlike call API ngay (`api.post/delete`). Trạng thái đồng bộ qua object `song.is_liked`. |
| **Recommendation** | 🟡 Khá | Có hệ thống fallback (khi chưa follow ai thì lấy popular, ko có genre pref thì lấy random). Tuy nhiên thuật toán gợi ý còn cơ bản. |
| **AI Playlist** | 🔴 Lỗi | **Hoàn toàn Mock.** Không có logic sinh playlist thật. Giao diện tĩnh. |
| **Karaoke / Stem** | 🔴 Lỗi | **Hoàn toàn Mock.** Fake UI, fake slider, fake lyrics. Backend rỗng. |
| **Premium** | 🔴 Lỗi | **Hoàn toàn Mock.** Không tạo đơn hàng, fake QR. Không update trường `premium_expires_at` của user tự động. |
| **Admin** | 🟢 Tốt | Rất chỉn chu. Thống kê dashboard thật. Quản lý entity (CRUD) kết hợp upload file hoạt động tốt, dùng transaction an toàn. Có soft delete cho bài hát. |
| **Profile** | 🟢 Tốt | Quản lý thông tin, avatar, lịch sử nghe (`total_listen_sec`). API update profile có sẵn. |

---

## 4. Rà soát responsive

| Màn hình | Vấn đề phát hiện | Component/Page liên quan | Mức độ | Gợi ý hướng xử lý |
|----------|------------------|--------------------------|---------|-------------------|
| **Mobile (390px)** | Grid chứa `ArtistCard`, `PlaylistCard` bị dồn nhỏ nếu không fix. | `HomeView.vue`, `LibraryView` | Low | Sử dụng Tailwind Grid linh hoạt (hiện tại đã dùng `grid-cols-2 sm:grid-cols-3` nên khá ổn định, cần test kĩ text overflow). |
| **Mobile (390px)** | `PlayerBar.vue` có thể che mất item cuối cùng của danh sách. | Layout App | Medium | Thêm `padding-bottom: 100px` (hoặc biến safe-area) vào container chính để tránh che khuất content. |
| **Tablet (768px)** | `SongActionMenu` có thể bị tràn khỏi màn hình nếu bấm ở sát góc dưới. | `SongActionMenu.vue` | Low | Đã có logic tự tính toán `x, y` tránh tràn màn hình (watch props.show), hoạt động tương đối tốt. |
| **Desktop (>1440px)** | Container giới hạn max-width. | Các Views | Low | Phù hợp với UI app nhạc, tránh UI bị giãn quá đà trên màn hình ultrawide. |

---

## 5. Rà soát UI/UX consistency

* **Component đồng bộ:** Các component lặp lại như thẻ bài hát đã được chuẩn hóa vào `SongRow.vue` và Menu 3 chấm gom vào `SongActionMenu.vue` -> Rất tốt, tránh code trùng lặp.
* **Màu sắc & Style:** Gradient cover, Dark Mode (#181818, #282828), màu xanh lá Spotify (#1ed760) được dùng xuyên suốt tạo cảm giác premium và thống nhất.
* **Empty/Loading/Error State:** `HomeView.vue` có skeleton loading spinner và Empty State *"Chưa có gợi ý nào"* đẹp, trực quan, có call-to-action dẫn ra trang `/search`.
* **Trải nghiệm Admin:** Rất lạ khi thiết kế logic *"nếu là admin thì cấm truy cập frontend app (bị redirect sang `/admin`)"*. Thường admin vẫn nên xem được app như user thường.

---

## 6. Danh sách nơi còn mock/hardcode/stub

| File / Component | Nội dung đang mock | Ảnh hưởng đến demo | Nên thay bằng dữ liệu/API nào |
|------------------|--------------------|--------------------|-------------------------------|
| `AiPlaylistView.vue` | Array `suggestions`, `generatedTracks` (Neural Grooves...) | Cao. Dễ bị lộ chức năng AI là giả. | Gọi API (ví dụ OpenAI) phân tích prompt -> Trả về mảng bài hát từ DB hợp với keyword. |
| `KaraokeView.vue` | Lyrics tĩnh (Mùa xuân sang...), 4 bài gợi ý hardcode, nút tải Beat chỉ alert(). | Cao. Chức năng khó, lộ là làm giả. | API backend dùng Spleeter/Demucs tách nhạc. Gắn file lrc thật. |
| `PremiumView.vue` | QR SVG giả, timer đếm ngược `setInterval` ở client, không sinh transaction. | Cao. Bị kiểm tra quy trình thanh toán là tạch. | Tích hợp VietQR tĩnh lấy nội dung ck, check webhoook/callback tự cập nhật DB `transactions`. |
| `payment.routes.js` | API trả về JSON `message: 'payment routes'` | Trung bình. | Logic tạo payment url và webhook cập nhật VIP. |
| `stem.routes.js` | API trả về JSON `message: 'stem routes'` | Trung bình. | Logic gửi file vào Python server xử lý. |

---

## 7. Checklist đề xuất trước khi demo luận văn

**🔴 Bắt buộc sửa trước demo (Khắc phục tính chân thực của app):**
- [ ] **Thanh toán:** Cần làm cho việc mua Premium có sinh đơn hàng vào bảng `transactions` (cho dù là thanh toán giả lập). Sau đó, `premium_expires_at` của user phải được cộng thêm thời gian.
- [ ] **AI Playlist:** Thay đổi mảng cứng thành lấy dữ liệu thật (Ví dụ: Query bài hát theo keyword prompt, gọi là "Smart Search" thay vì AI Generate nếu không kịp làm AI).
- [ ] **Karaoke:** Tạm thời ẩn tính năng kéo volume Stem nếu không có server tách beat thực sự. Đổi thành hát cùng lyrics (nếu có data lyrics).

**🟡 Nên sửa nếu còn thời gian (Tối ưu hóa hệ thống):**
- [ ] **Admin guard:** Cho phép tài khoản Admin duyệt app Music bình thường, chỉ thêm nút "Trang Quản Trị" thay vì khóa cấm Admin nghe nhạc.
- [ ] **Performance SQL:** Đổi logic gen gợi ý từ `ORDER BY RAND()` sang lấy list ID, đảo ngẫu nhiên bằng JS array shuffle, sau đó mới select chi tiết.
- [ ] **Padding Bottom cho Player:** Đảm bảo thêm padding-bottom tầm 100px-120px vào Layout chính để PlayerBar không che mất dữ liệu ở các list dài (Home, Search).

**🟢 Có thể để làm hướng phát triển tương lai:**
- Tích hợp mô hình AI Stem Separation thật sự bằng Python (Demucs/Spleeter) qua message queue (RabbitMQ/Redis).
- Chạy Recommendation Engine (Machine Learning) thật sự thay vì Query dựa theo Genre ID.
- Realtime notification cho payment callback bằng Socket.io.
