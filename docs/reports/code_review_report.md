# Báo Cáo Đánh Giá Mã Nguồn & Logic Hệ Thống MusicFlow

Hệ thống **MusicFlow** là một nền tảng phát nhạc trực tuyến cá nhân hóa tích hợp trí tuệ nhân tạo (AI). Dự án được thiết kế theo kiến trúc Microservices phân rã gồm 3 thành phần chính:
1. **Frontend**: Vue.js 3 + Pinia + Vue Router + Tailwind CSS.
2. **Backend API**: Node.js + Express + MySQL + Redis + Socket.IO.
3. **AI Service**: Python + FastAPI + Spleeter (Tách âm thanh) + Collaborative Filtering (SVD) + LLM API (AI Playlist).

---

## 1. Cấu Trúc Cây Thư Mục (Directory Tree)

Cấu trúc thư mục của dự án được tổ chức khá rõ ràng và phân tách mô-đun tốt theo hướng microservices:

```text
d:\CaNhan\Luan_Van
├── ai-service/              # Dịch vụ Python FastAPI (AI & Xử lý âm thanh)
│   ├── app/
│   │   ├── api/             # [Trống] Định nghĩa các API endpoints
│   │   ├── core/            # [Trống] Cấu hình chung cho ứng dụng Python
│   │   ├── models/          # [Trống] Định nghĩa model AI & dữ liệu
│   │   ├── services/        # [Trống] Logic nghiệp vụ (tách nhạc, gợi ý)
│   │   └── main.py          # Entrypoint của FastAPI
│   └── requirements.txt     # Danh sách thư viện Python cần thiết
│
├── backend/                 # API Server Node.js (Express + Socket.IO)
│   ├── src/
│   │   ├── config/          # Cấu hình Database (MySQL) và Cache (Redis)
│   │   ├── controllers/     # Controller điều hướng logic nghiệp vụ
│   │   ├── middleware/      # Middleware xác thực (auth) và upload file
│   │   ├── models/          # [Trống] Định nghĩa model/schema (nếu dùng ORM)
│   │   ├── routes/          # Định nghĩa các routes API
│   │   ├── services/        # Services liên lạc bên ngoài (Spotify, Zing, Socket, Cron)
│   │   ├── utils/           # [Trống] Các hàm tiện ích
│   │   ├── app.js           # Khởi tạo Express & Middleware
│   │   └── server.js        # Khởi chạy HTTP Server & Socket.IO
│   ├── uploads/             # Thư mục lưu trữ file audio & ảnh bìa upload lên
│   ├── .env                 # File cấu hình biến môi trường backend
│   ├── migrate_notifications.js # Script tạo bảng thông báo
│   └── package.json         # Danh sách package Node.js
│
├── frontend/                # Single Page Application Vue.js 3
│   ├── src/
│   │   ├── api/             # Cấu hình Axios gọi API backend
│   │   ├── assets/          # Ảnh, logo, và các tệp tĩnh
│   │   ├── components/      # UI components dùng chung (Player, Sidebar, ...)
│   │   ├── layouts/         # Layout cho App & Admin
│   │   ├── router/          # Cấu hình định tuyến (Vue Router)
│   │   ├── stores/          # Quản lý State tập trung (Pinia: auth, player, theme...)
│   │   ├── views/           # Các trang giao diện chính (Home, Karaoke, Premium...)
│   │   ├── App.vue          # Root component
│   │   ├── main.js          # Entrypoint của Vue app
│   │   └── style.css        # Cấu hình Tailwind & Custom Styles
│   ├── index.html
│   ├── package.json
│   └── tailwind.config.js   # Cấu hình Tailwind CSS (Theme Glassmorphism)
│
├── musicflow_schema.sql     # Schema cơ sở dữ liệu MySQL hoàn chỉnh
└── seed_songs.sql           # Dữ liệu mẫu khởi tạo (Songs, Artists, History...)
```

### Nhận xét cấu trúc thư mục:
* **Ưu điểm**: Phân vùng chức năng rất trực quan. Backend đi theo mô hình **Route - Controller - Service** chuẩn chỉ. Frontend tổ chức theo mô hình **Store - Router - View - Component** hiện đại của Vue 3.
* **Nhược điểm/Điểm cần lưu ý**:
  * Các thư mục `models` và `utils` trong `backend/src/` hiện đang trống, vì backend đang dùng raw SQL query trực tiếp qua `mysql2/promise` thay vì dùng các thư viện ORM như Sequelize hay Prisma.
  * Các thư mục trong `ai-service/app/` (như `api`, `services`, `models`, `core`) hoàn toàn trống rỗng, tức là phần AI chưa được triển khai mã nguồn thực tế.

---

## 2. Review Chi Tiết Logic Các Chức Năng

### 2.1. Xác thực & Phân quyền (Auth & Middlewares)
* **Tệp liên quan**: [auth.controller.js](file:///d:/CaNhan/Luan_Van/backend/src/controllers/auth.controller.js), [auth.middleware.js](file:///d:/CaNhan/Luan_Van/backend/src/middleware/auth.middleware.js).
* **Đánh giá logic**:
  * **Đăng ký (Register)**: Sử dụng Database Transaction để đảm bảo tính toàn vẹn dữ liệu khi tạo User đồng thời lưu sở thích thể loại (`user_genre_preferences`) và nghệ sĩ (`user_artist_preferences`) phục vụ cho Cold Start gợi ý nhạc. Password được băm bằng `bcryptjs` với salt rounds = 12 rất an toàn.
  * **Token Pair**: Hệ thống sử dụng cặp `accessToken` (JWT) lưu ngắn hạn và `refreshToken` lưu trong Redis (thời hạn 30 ngày) để duy trì phiên đăng nhập và thu hồi token khi đăng xuất (`logout`).
  * **Phân quyền**: Có middleware `requireAdmin` kiểm tra `req.user.role === 'admin'` để bảo vệ các API quản trị (upload bài hát, xem dashboard...).
* **Lỗ hổng / Vấn đề tiềm ẩn**:
  * Chưa có cơ chế gửi email xác nhận đăng ký hoặc khôi phục mật khẩu.
  * Việc lưu trữ `refreshToken` trên Redis là rất tốt cho việc thu hồi nhanh, nhưng cần quản lý chặt chẽ trường hợp Redis bị down để server không bị crash.

### 2.2. Nhóm Chức Năng Phát Nhạc & Tìm Kiếm (Music Player & Stream)
* **Tệp liên quan**: [player.js](file:///d:/CaNhan/Luan_Van/frontend/src/stores/player.js), [zingmp3.service.js](file:///d:/CaNhan/Luan_Van/backend/src/services/zingmp3.service.js), [spotify.service.js](file:///d:/CaNhan/Luan_Van/backend/src/services/spotify.service.js).
* **Đánh giá logic**:
  * Trình phát nhạc hỗ trợ 3 nguồn âm thanh đa dạng:
    1. **Local Audio**: File nhạc được admin upload lên hệ thống (được lưu tại `backend/uploads/audio/`).
    2. **Zing MP3**: Tích hợp thông qua gói `zingmp3-api` / `zingmp3-api-next`, tự động crawl thông tin bài hát và lấy link streaming 128kbps/320kbps động.
    3. **Spotify**: Tích hợp tài khoản Spotify cá nhân của người dùng, sử dụng **Spotify Web Playback SDK** trên frontend để phát trực tiếp thông qua API chính thống của Spotify.
  * **Cơ chế Player**: Pinia store `player.js` quản lý vòng đời phát nhạc, tự động chuyển bài (`next()`), bật/tắt shuffle/repeat, quản lý danh sách chờ (queue). Khi một bài hát thuộc nguồn Zing MP3 được kích hoạt mà chưa có link streaming, store sẽ gọi API backend `/api/zing/stream/:id` để lấy link mới nhất.

---

## 3. Các Chức Năng Bị Thiếu hoặc Chỉ Là Mockup (Gaps & Stubs)

Qua việc kiểm tra sâu mã nguồn, có một số chức năng cốt lõi của luận văn tốt nghiệp hiện **chỉ được viết giao diện tĩnh (mockup) trên frontend** hoặc **tạo routes trống (stub) trên backend**:

### 3.1. Ghi Lịch Sử Nghe Nhạc (`listening_history`)
* **Hiện trạng**: 
  * Schema SQL có bảng `listening_history` dùng để lưu hành vi của người dùng (completion_rate, liked, not_skipped, implicit_rating...).
  * Frontend **hoàn toàn không có** logic gửi tracking event khi bài hát đang phát hoặc kết thúc.
  * Backend **không có** route hay controller nào để ghi dữ liệu vào bảng này.
* **Hệ quả**: Thuật toán gợi ý cá nhân hóa (Collaborative Filtering SVD) sẽ không có dữ liệu đầu vào để học, khiến tính năng cốt lõi của luận văn bị vô hiệu hóa.

### 3.2. Dịch vụ AI (`ai-service` & `recommendation.routes.js`)
* **Hiện trạng**:
  * File [main.py](file:///d:/CaNhan/Luan_Van/ai-service/app/main.py) trong `ai-service` khóa toàn bộ các router AI (`recommend`, `stem`, `playlist`).
  * Backend route [recommendation.routes.js](file:///d:/CaNhan/Luan_Van/backend/src/routes/recommendation.routes.js) chỉ trả về chuỗi tĩnh `{ message: 'recommendation routes' }`.
* **Hệ quả**: Giao diện "Dành cho bạn" (nhạc gợi ý cá nhân hóa) chưa có luồng lấy dữ liệu thực tế từ thuật toán SVD.

### 3.3. Tách Âm Thanh Karaoke AI (Spleeter)
* **Hiện trạng**:
  * Giao diện [KaraokeView.vue](file:///d:/CaNhan/Luan_Van/frontend/src/views/karaoke/KaraokeView.vue) chứa giao diện điều chỉnh âm lượng Vocal/Instrumental, nhưng dữ liệu bài hát và nút tải Beat đều là tĩnh.
  * Backend route [stem.routes.js](file:///d:/CaNhan/Luan_Van/backend/src/routes/stem.routes.js) chỉ là một stub rỗng.
  * Chưa có hàng đợi xử lý tác vụ tách nhạc bất đồng bộ (mặc dù trong DB đã thiết kế bảng `stem_jobs`).

### 3.4. Tạo Playlist Bằng Trí Tuệ Nhân Tạo (AI Playlist Generator)
* **Hiện trạng**:
  * Giao diện [AiPlaylistView.vue](file:///d:/CaNhan/Luan_Van/frontend/src/views/ai/AiPlaylistView.vue) hoàn toàn hardcode danh sách bài hát trả về (`Neural Grooves`, `Soft Circuit Rain`, `Midnight Prompt`...) và không thực hiện bất cứ lệnh gọi API nào đến backend.
  * Cả backend và `ai-service` chưa thiết kế APIs để nhận prompt từ người dùng và gọi các LLM API (như Claude hoặc Gemini) để phân tích ra tham số JSON.

### 3.5. Thanh Toán Nâng Cấp Gói Premium
* **Hiện trạng**:
  * Giao diện [PremiumView.vue](file:///d:/CaNhan/Luan_Van/frontend/src/views/premium/PremiumView.vue) chạy bộ đếm ngược 5 phút giả lập và hiển thị một mã QR tĩnh dạng SVG placeholder.
  * Backend [payment.routes.js](file:///d:/CaNhan/Luan_Van/backend/src/routes/payment.routes.js) chỉ là stub.
  * Chưa tích hợp cổng thanh toán VNPay hay MoMo thực tế, cũng như thiếu webhook nhận sự kiện thanh toán thành công để cập nhật trạng thái Premium của user qua Socket.IO.

---

## 4. Nhận Xét Về Thiết Kế Giao Diện (Theme & CSS)

* **Thiết kế hiện tại**:
  * Dự án đang sử dụng phong cách **Glassmorphism sáng (Light Glassmorphic)** với các tông màu pastel dịu mát: nền xám nhạt (`#f4f7f6`), màu chủ đạo tím (`#a29bfe`), điểm nhấn hồng (`#fd79a8`) và xanh dương (`#74b9ff`).
  * Giao diện được cấu trúc phẳng, sử dụng mờ đục backdrop blur và viền kính để tạo chiều sâu.
* **Sự lệch pha với tài liệu thiết kế**:
  * Trong thư mục gốc có tệp `DESIGN-spotify.md` mô tả một hệ thống tối toàn diện (Near-black Immersive theme) tương tự như Spotify. 
  * Hiện tại ứng dụng Vue.js **không** đi theo mô hình tối này, mà sử dụng hoàn toàn bảng màu pastel sáng. Tuy nhiên, style hiện tại vẫn đảm bảo tính thẩm mỹ cao, bóng bẩy và hiện đại.

---

## 5. Đề Xuất Kế Hoạch Hoàn Thiện Hệ Thống

Để chuẩn bị tốt nhất cho việc báo cáo luận văn, hệ thống cần được bổ sung các kết nối logic thực tế thay vì sử dụng mockup. Dưới đây là lộ trình đề xuất cụ thể:

### Bước 1: Hiện thực hóa tính năng ghi nhận lịch sử nghe nhạc (Tracking API)
1. **Frontend (`player.js`)**: Viết một hàm `trackPlaybackProgress` kích hoạt định kỳ hoặc khi kết thúc bài hát (nghe được > 30 giây hoặc hết bài) để gửi thông số `completion_rate`, `source`, `not_skipped` lên backend.
2. **Backend**: 
   * Viết thêm route POST `/api/songs/:id/listen` trong [song.routes.js](file:///d:/CaNhan/Luan_Van/backend/src/routes/song.routes.js).
   * Trong Controller, thực hiện tính toán `implicit_rating` từ hành vi của người dùng và chèn bản ghi vào bảng `listening_history`. Đồng thời, cập nhật trường `total_listen_sec` của user để phục vụ hiển thị ở trang cá nhân.

### Bước 2: Xây dựng AI Service (Python FastAPI)
1. **Recommendation Engine**:
   * Sử dụng thư viện `scikit-surprise` để cài đặt thuật toán Collaborative Filtering SVD.
   * Viết API endpoint `/api/recommend/retrain` nhận dữ liệu từ MySQL, huấn luyện mô hình SVD và lưu trữ điểm gợi ý vào bảng `recommendations`.
   * Viết API endpoint `/api/recommend/:userId` để lấy danh sách 20 bài hát được gợi ý nhiều nhất.
2. **Stem Separation**:
   * Tích hợp thư viện `Spleeter` để tách file âm thanh thành 2 nguồn: `vocals.mp3` và `instrumental.mp3`.
   * Viết API nhận yêu cầu tách nhạc, xử lý bất đồng bộ bằng hàng đợi (Celery hoặc BackgroundTasks của FastAPI) và cập nhật trạng thái vào bảng `stem_jobs`.
3. **AI Playlist Generator**:
   * Tích hợp thư viện OpenAI/Gemini/Claude SDK.
   * Viết API nhận prompt văn bản tiếng Việt từ người dùng, gọi LLM phân tích ra cấu trúc JSON (genres, mood, tempo...) để truy vấn các bài hát tương tự từ cơ sở dữ liệu MySQL và trả về.

### Bước 3: Đồng bộ luồng API từ Node.js sang Python AI Service
1. Cập nhật các route của backend Node.js (`/api/recommend`, `/api/stem`, `/api/ai-playlist`) để thực hiện proxy gọi sang Python AI Service bằng `axios`, nhận kết quả và cập nhật trạng thái trong database MySQL/Redis.
2. Thiết lập cơ chế đẩy sự kiện thời gian thực (Real-time Socket.IO) khi một tiến trình tách nhạc (Stem Separation) hoàn thành để hiển thị link tải beat cho người dùng ngay lập tức.

### Bước 4: Hoàn thiện luồng thanh toán Premium (VNPay Sandbox)
1. Sử dụng thư viện tạo link thanh toán VNPay Sandbox trên Backend Node.js. Khi người dùng chọn gói, Backend gọi VNPay để lấy URL thanh toán, đồng thời tạo mã QR tương ứng với URL này.
2. Viết API Route Webhook (IPN URL) để nhận phản hồi từ VNPay khi người dùng chuyển khoản thành công.
3. Khi nhận được IPN thành công, Backend cập nhật trường `premium_expires_at` của User trong DB và phát đi sự kiện Socket.IO `premium_activated` để chuyển trạng thái giao diện của người dùng sang Premium ngay lập tức.
