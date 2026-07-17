# Báo Cáo Rà Soát Kiến Trúc và Mã Nguồn Hệ Thống MusicFlow

Báo cáo này đóng vai trò là "nguồn sự thật kỹ thuật" (Ground Truth) để phục vụ cho việc viết luận văn. Tất cả các nhận định dưới đây đều được rút ra từ việc rà soát trực tiếp mã nguồn, database schema, và cấu trúc thư mục thực tế của dự án, bỏ qua các tài liệu thiết kế (docs) có thể đã lỗi thời.

---

## A. Tổng quan kiến trúc thực tế

Hệ thống được thiết kế theo kiến trúc hướng dịch vụ (Service-Oriented Architecture) với 3 thành phần chính:

*   **Frontend**: Ứng dụng Single Page Application (SPA) sử dụng **Vue 3**, **Vite**, **Vue Router**, **Pinia**, và **TailwindCSS**. Thư mục chính nằm tại `apps/frontend/`.
*   **Backend**: RESTful API Server xây dựng bằng **Node.js** và **Express.js**. Có tích hợp **Socket.IO** (trong `apps/backend/src/server.js`) để xử lý các sự kiện realtime (như polling thanh toán, trạng thái stem separation). Thư mục chính: `apps/backend/`.
*   **AI Service**: Microservice phụ trợ chạy bằng **Python** và **FastAPI** (trong `apps/ai-service/`).

**Cơ sở dữ liệu & Hạ tầng:**
*   **Database chính**: **MySQL 8.0+**. Lược đồ CSDL nằm tại `database/schema/musicflow_schema.sql` và các file migration trong `database/migrations/`.
*   **Cache & Session**: Có sử dụng **Redis** (cấu hình tại `apps/backend/src/config/redis.js` và được khai báo trong `package.json`).
*   **Message Queue**: **KHÔNG** sử dụng RabbitMQ hay Kafka thực sự. Việc xử lý hàng đợi (như tách âm stem_jobs) được lưu trữ trạng thái trực tiếp trong bảng `stem_jobs` của MySQL và xử lý qua Background Task / Polling.
*   **Lưu trữ Media (Audio/Images)**: Các tệp âm thanh, ảnh bìa, và tệp hệ thống đang được lưu trữ cục bộ trực tiếp trên máy chủ tại thư mục `apps/backend/uploads/` hoặc `storage/`. **Chưa tìm thấy mã nguồn** cấu hình S3 hay CDN.
*   **Vector Database**: **KHÔNG** sử dụng FAISS hay Vector DB (như Pinecone, Milvus). Tìm kiếm ngữ nghĩa (Semantic RAG) đang được xử lý bằng một In-Memory Index (được nạp từ tệp CSV `datasets/processed/semantic/profiles/song_semantic_profiles.csv` qua `semanticRag.service.js`).

---

## B. Rà soát vai trò và phân quyền

Trong hệ thống tồn tại 3 role chính được khai báo ở CSDL và Middleware: `user`, `admin`, `artist` (được cập nhật qua file migration `artist_accounts_and_invitations.sql`).

**1. Khách và Người dùng (User)**
*   **Route đăng nhập**: `/login`. Frontend tự động chặn người dùng vãng lai khỏi các route yêu cầu đăng nhập.
*   **Backend Middleware**: Xác thực bằng JWT thông qua `authenticate` middleware (`apps/backend/src/middleware/auth.middleware.js`).

**2. Nghệ sĩ (Artist)**
*   **Route đăng nhập**: Nghệ sĩ có trang đăng nhập riêng `/artist/login`. (Route ở frontend: `apps/frontend/src/router/index.js`).
*   **Luồng xử lý Role**: Có tồn tại role `artist`. Nếu đăng nhập không đúng tài khoản, Middleware và Router Guard sẽ tự chuyển hướng. Trả 403 ở backend nếu gọi API sai quyền.
*   **Trạng thái kích hoạt**: Có áp dụng cơ chế `must_change_password` (hoặc `mustChangePassword`) cho tài khoản nghệ sĩ mới được Admin tạo (kiểm tra rõ trong Router Guard của Vue `router.beforeEach`).
*   **Artist Studio**: Layout của Artist gồm các trang: Tổng quan (Dashboard), Hồ sơ nghệ sĩ, Bài hát, Album. Trang thống kê (Stats) được điều hướng ngược về Dashboard (không tách riêng). Có tính năng liên kết `artist_id` qua Middleware `requireArtist`.

**3. Quản trị viên (Admin)**
*   **Route đăng nhập**: `/admin/login`.
*   **Backend Middleware**: `requireAdmin` kiểm tra `role === 'admin'`.

**4. Người dùng Premium**
*   **Backend Middleware**: `requirePremium` kiểm tra trường `premiumExpiresAt` của User để cấp quyền tải Stem hoặc nghe nhạc giới hạn.

---

## C. Rà soát chức năng User

Đa số các tính năng của người dùng cuối đã được triển khai:

| Chức năng | Trạng thái thực tế | Bằng chứng Code / DB |
| :--- | :--- | :--- |
| **Đăng ký, đăng nhập** | Đã triển khai | `auth.routes.js`, `auth.controller.js` |
| **Chọn sở thích (Cold Start)** | Đã triển khai | Bảng `user_genre_preferences`, `user_artist_preferences` |
| **Tìm kiếm cơ bản** | Đã triển khai | Bảng `songs` (FULLTEXT INDEX ft_song_title) |
| **Phát nhạc / Hàng chờ** | Đã triển khai | Component Player, Vuex/Pinia Player Store (`apps/frontend/src/views/player/`) |
| **Thích bài hát** | Đã triển khai | Bảng `song_likes` |
| **Lịch sử nghe** | Đã triển khai | Bảng `listening_history` (Ghi nhận implicit feedback) |
| **Thư viện / Playlist cá nhân**| Đã triển khai | `playlist.routes.js`, bảng `playlists` |
| **Nhắn tin / Chat** | Đã triển khai (Một phần) | Bảng `chat_messages.sql`, `message.controller.js` |
| **System Playlists** | Đã triển khai | Cronjobs tạo playlist định kỳ (Daily, Weekly) |
| **OAuth (Mạng xã hội)** | Chỉ có giao diện/route trống | `SpotifyCallback.vue` (Chưa có Google/FB login) |

---

## D. Rà soát Search thường và AI Search

Phân biệt rõ chức năng của hệ thống thực tế:

1.  **Tìm kiếm thường (Search)**:
    Tìm kiếm dựa trên truy vấn Full-Text Search trong MySQL. Người dùng biết cụ thể tên bài/ca sĩ mình muốn tìm. Việc tìm kiếm không dấu/có dấu được xử lý qua collation của MySQL `utf8mb4_unicode_ci`.
2.  **AI Search / AI Playlist Generator**:
    Triển khai tính năng tạo danh sách phát thông minh theo ngữ cảnh (Ví dụ: "Nhạc tập gym KPOP"). Quá trình này được đặt tên là "AI Playlist", cho phép người dùng mô tả tâm trạng/hoạt động để tạo ra 1 playlist hoàn chỉnh thay vì chỉ trả về 1 bài hát duy nhất.

---

## E. Rà soát AI Playlist Generator và Semantic RAG

Tính năng AI Playlist đã được lập trình hoàn chỉnh dựa trên pipeline RAG kết hợp Recommendation:

*   **Pipeline thực tế**: (File `apps/backend/src/services/aiPlaylist.service.js`)
    1. Parse Prompt thành Intent (dùng Google GenAI API).
    2. Gọi `semanticRag.service.js` để tìm các profile bài hát tương đồng (RAG In-memory).
    3. Lọc danh sách ứng viên từ Database (kiểm tra public, playability).
    4. Xếp hạng lại (Rerank) sử dụng BPR Score và Intent mapping.
    5. Preview Playlist.
    6. Lưu (Save) playlist vào bảng `playlists` (type = `ai`).
*   **Dữ liệu RAG**: File profile được đọc trực tiếp từ tệp `datasets/processed/semantic/profiles/song_semantic_profiles.csv` và load In-Memory (Sử dụng hàm `loadIndex()`).
*   **Xếp hạng (Rerank)**: Sử dụng các tiêu chí từ file CSV (`mood_tags`, `situation_tags`, `lyrical_keywords`) kết hợp với hàm `scoreDocument`.
*   **Đánh giá**: Hoàn toàn **không dùng** Vector DB (FAISS/Pinecone) mà tự viết thuật toán tính điểm token/phrase bằng mảng/Map.

---

## F. Rà soát hệ thống gợi ý bài hát (Recommendation Engine)

Hệ thống cung cấp thuật toán gợi ý dùng BPR-MF (Bayesian Personalized Ranking - Matrix Factorization) kết hợp Content-based.

*   **Hành vi ghi nhận**: DB có bảng `listening_history` lưu trữ `completion_rate`, `skip_at_sec`, và nguồn nghe. Thuật toán tự nội suy `implicit_rating`.
*   **Model load**: Backend nạp model tĩnh tại `recommendationModel.service.js` (load từ file `storage/recommendation/models/bpr_mf_latest.json` hoặc thư mục Final).
*   **Retraining**: Được thực hiện qua Scheduler (cronjob) hoặc Admin trigger (`admin_recommendation.controller.js`), tiến hành offline retraining bằng service bên ngoài hoặc ghi nhận lại vào `model_training_logs`. **Không có Retrain Realtime**.

---

## G. Rà soát Playlist tự động (System Playlists)

*   **Các loại Playlist**: Hệ thống hỗ trợ sinh playlist tự động: *Daily Mix, Weekly Mix, Mood Mix, Trending Playlist*.
*   **Cơ chế sinh**: Được tạo định kỳ bằng `node-cron` qua file `scheduler.service.js`. Logs chạy được lưu tại bảng CSDL (thông qua `systemPlaylistRunLog.service.js`).
*   **Trạng thái DB**: Bảng `system_playlist_generation_runs` dùng để trace tiến độ.

---

## H. Rà soát Artist Studio và Kiểm duyệt nội dung

Quy trình quản lý nội dung giữa Nghệ sĩ và Admin khá toàn diện:

1.  **Nghệ sĩ Upload**: Có trang `ArtistSongsView.vue`. Khi tải lên bài hát hoặc tạo album, trạng thái release_status sẽ được đưa về `draft` hoặc `scheduled` hoặc `pending_review` (Kiểm tra trong `database/migrations/migration_release_status.sql`).
2.  **Admin Duyệt**: Có màn hình quản lý bài chờ duyệt (`admin_artist_song_review.controller.js`). Admin có quyền phê duyệt (cập nhật thành `published`) hoặc từ chối (bắt buộc nhập lý do).
3.  **Hồ sơ Nghệ sĩ**: Admin cấp tài khoản, nghệ sĩ có trang chỉnh sửa hồ sơ. 
4.  **Album Nghệ sĩ**: Được liên kết (album_id). Album không thể gửi duyệt nếu rỗng, phải có bài hát được gán `album_id`. Bài hát đã thuộc album khác không thể chọn lại.

---

## I. Rà soát Admin

Module Admin rất hoàn thiện, với các chức năng tương ứng trong thư mục `apps/backend/src/controllers/`:
*   `adminDashboard.service.js`: Thống kê KPI.
*   `admin_users.controller.js` / `admin_artist_account.controller.js`: Quản lý người dùng, nghệ sĩ.
*   `admin_music_data_tools.controller.js` / `admin_artist_song_review.controller.js`: Quản lý bài hát, duyệt bài hát chờ duyệt.
*   `admin_stem_jobs.controller.js`: Quản lý hàng đợi tách nhạc AI.
*   `admin_premium.controller.js` / `admin_payments.controller.js`: Quản lý giao dịch, gói cước.
*   `admin_lyrics.controller.js`: Quản lý lời bài hát, đồng bộ LRC.

---

## J. Rà soát Premium và Thanh toán

*   Hệ thống cho phép mua gói Premium qua cơ chế **Chuyển khoản QR code** sử dụng cổng **SePay**.
*   **Bằng chứng code**: File `sepayPoller.service.js` thực hiện việc chạy polling các giao dịch từ API SePay định kỳ để kích hoạt tài khoản VIP cho người dùng (Sử dụng Socket.IO để báo cho client khi thanh toán thành công).
*   **Hạn chế**: KHÔNG có mã nguồn tích hợp VNPay, MoMo trực tiếp (không dùng SDK của họ), hay Stripe, PayPal. Bảng `premium_plans` lưu các gói.

---

## K. Rà soát Karaoke và Stem Separation

*   **Stem Separation**: Cho phép người dùng tách riêng lời/nhạc nền để hát Karaoke. Code backend lưu trạng thái vào bảng `stem_jobs`. 
*   **Công nghệ lõi**: Trong file `apps/ai-service/requirements.txt` có khai báo `demucs>=4.0.1` (Spleeter đã bị comment out `# spleeter==2.3.2`). Vậy AI Service sử dụng Demucs.
*   **Hàng đợi**: Xử lý bằng việc ghi nhận trạng thái vào MySQL thay vì dùng RabbitMQ. File output (vocals/instrumental) được lưu trữ trực tiếp vào thư mục upload.
*   **Karaoke UI**: Có giao diện `KaraokeView.vue`. Lời bài hát đồng bộ thời gian (LRC) được xử lý qua `lyrics.controller.js`.
*   **Quyền lợi Premium**: Người dùng thường có giới hạn số lần tải/tách stem. Lọc quyền thông qua `requirePremium`.

---

## L. Các nội dung dễ "Overclaim" (Cần điều chỉnh khi viết báo cáo)

Dưới đây là các tính năng **KHÔNG TỒN TẠI** hoặc **CHƯA ĐỦ BẰNG CHỨNG** trong code, tuyệt đối không nên đưa vào luận văn như một tính năng cốt lõi đã hoàn thiện để tránh bị hội đồng phản biện:

1.  **OAuth (Đăng nhập Google/Facebook)**: Chưa được tích hợp ở Backend. (Chỉ thấy thư viện thao tác Spotify API `SpotifyCallback.vue` chứ không dùng OAuth2 SSO cho đăng nhập người dùng thực tế).
2.  **Lưu trữ Cloud (AWS S3, Cloudinary)** và **CDN**: Không có. Mọi tệp tin upload đang nằm tại ổ cứng cục bộ (`uploads/` hoặc `storage/`).
3.  **Vector Database (FAISS, Milvus, Pinecone)**: Không sử dụng. Semantic RAG dùng In-memory index array.
4.  **Microservices phân tán quy mô lớn**: Thực tế chỉ có 2 services (1 Node.js, 1 Python) chạy chung cơ sở hạ tầng. Không có Gateway, Service Discovery, hay K8S config phức tạp trong code.
5.  **Hàng đợi message nâng cao (RabbitMQ, Kafka)**: Không có code. Sử dụng CSDL MySQL làm bảng lưu trạng thái hàng đợi (Polling queue).
6.  **Realtime Retraining (Recommendation)**: Không có thuật toán học tăng cường thời gian thực, mà sử dụng cơ chế Offline Retraining chạy định kỳ.
7.  **Adaptive Bitrate Streaming (HLS/DASH)** / **Lossless Streaming**: Hệ thống chỉ serve static audio file, không encode ra nhiều bitrate `.m3u8` hoặc phân phối DRM.
8.  **Thanh toán thẻ quốc tế / VNPay SDK**: Đang dùng nền tảng quét mã QR (SePay).
9.  **Mobile App Độc lập**: Hệ thống chỉ cung cấp Web Application (PWA/Responsive), không thấy codebase của iOS/Android độc lập.

---

## M. Bảng tổng hợp các Module phục vụ viết Luận văn

### 1. Bảng Trạng Thái Actor
| Actor | Quyền Hạn Thực Tế Được Triển Khai |
| :--- | :--- |
| **Khách (Guest)** | Xem trang landing, duyệt nhạc, nghe thử, bị chặn khi truy cập tính năng cá nhân. |
| **Người dùng** | Đăng ký, nghe nhạc, thích bài hát, tạo playlist, AI playlist generator, xem lời. |
| **Người dùng Premium** | Sử dụng Karaoke, không bị giới hạn giới hạn khi tách Stem âm thanh. |
| **Nghệ sĩ** | Xem Dashboard, đăng tải bài hát (chờ duyệt), yêu cầu tạo Album, cập nhật hồ sơ (đăng nhập lần đầu phải đổi mật khẩu). |
| **Admin** | Toàn quyền CRUD, phê duyệt bài hát nghệ sĩ (approved/rejected), quản lý thanh toán, xem Dashboard logs. |
| **Hệ thống AI/Cron** | Tự động sinh playlist Daily/Weekly (Scheduler), chạy Poller thanh toán SePay, Batch training recommendation. |

### 2. Bảng Cấu trúc Dữ liệu chính
| Bảng CSDL | Vai trò / Tính năng liên quan |
| :--- | :--- |
| `users`, `artists` | Quản lý người dùng, nghệ sĩ. Chứa `role`, `status`. Liên kết bảng account. |
| `songs`, `albums` | Quản lý âm nhạc cốt lõi. Chứa `release_status`, `play_count`, `duration_sec`, `audio_url`. |
| `listening_history` | Lưu lại số giây nghe thực tế, % hoàn thành bài hát. Là Implicit Rating cho BPR-MF. |
| `playlists`, `ai_playlists`| Lưu playlist cá nhân, AI Generated Playlist. |
| `user_subscriptions` | Lưu giao dịch, thông tin gói Premium và thời hạn (`end_date`). |
| `stem_jobs` | Quản lý tiến trình tách giọng hát Demucs AI, lưu trạng thái queued/completed. |

---

## N. Kết luận báo cáo & Hướng dẫn Cập nhật Luận văn

Dựa vào việc đối chiếu mã nguồn thực tế, tài liệu luận văn cần được điều chỉnh để phản ánh **trung thực** các kỹ thuật đã được làm.

**1. Những tính năng chắc chắn đã làm (Tự tin đưa vào báo cáo chính)**:
*   Xây dựng Web Music Streaming với UI/UX bằng Vue 3. Quản lý Router Guard phân quyền.
*   Hệ thống gợi ý bài hát theo hành vi (SVD / BPR-MF) sử dụng luồng Offline training.
*   Tính năng tạo Playlist tự động bằng AI (Semantic RAG kết hợp với Intent parsing).
*   Chức năng Karaoke và tách nhạc (Vocals/Instrumentals) sử dụng Demucs.
*   Artist Studio và luồng kiểm duyệt nội dung của Admin hoàn thiện (Approval/Rejection flow).
*   Tích hợp thanh toán gói Premium qua cổng quét mã VietQR tự động bằng SePay + Socket.IO.

**2. Những chức năng triển khai một phần (Cần ghi chú rõ là mức độ cơ bản)**:
*   Nhắn tin / Chat (Có API lưu tin nhắn, chia sẻ thực thể nhưng không phải hệ thống nhắn tin realtime quá quy mô).

**3. Đề xuất bố cục cho Luận văn (Cập nhật dựa trên Source Code)**:
*   **Chương 1 & 2 (Tổng quan và Kiến trúc)**: Cần thay đổi sơ đồ kiến trúc hạ tầng. Gỡ bỏ các block liên quan đến Cloud/S3, Message Queue phức tạp (Kafka/RabbitMQ), Vector Database chuyên dụng. Tập trung mô tả kiến trúc monolith API Server (Node) kết nối với Microservice AI (FastAPI). 
*   **Phần Recommendation**: Giải thích rõ hệ thống lưu vết hành vi nghe của user (`completion_rate`), sinh điểm ngầm định (implicit rating) và chạy Offline Training định kỳ. Hệ thống load file model tĩnh JSON lên bộ nhớ RAM của Server Node.js để dự đoán Realtime thay vì train Realtime.
*   **Phần AI RAG (AI Playlist)**: Phải miêu tả việc tận dụng In-Memory array lookup dựa trên tệp `song_semantic_profiles.csv` và thuật toán `scoreDocument` do chính tác giả xây dựng để xử lý "Contextual Text Search", tránh ghi "Sử dụng Vector Database" vì hội đồng sẽ hỏi tới việc cấu hình/tích hợp Vector DB thực tế.
*   **Phần Stem Separation**: Thay vì ghi "Spleeter", hãy cập nhật là "Demucs" do mã nguồn Python đang import Demucs.
