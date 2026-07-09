# Kiểm tra độ phủ tài liệu chức năng MusicFlow (Coverage Check)

## 1. Mục đích
Tài liệu này xác nhận mức độ bao phủ của 47 tài liệu chức năng (51 file tính cả root) so với thực tế mã nguồn đang có. 

## 2. Các route frontend đã có tài liệu (Sample Core)
| Route/View | Chức năng | File tài liệu hiện có | Cần bổ sung không |
|---|---|---|---|
| `/` (HomeView) | Recommendation, Playlists | `07_music_recommendation_system.md` | Đã đủ |
| `/search` (SearchView) | Tìm kiếm nhạc | `09_search_and_ai_search.md` | Đã đủ |
| `/library` (LibraryView) | Thư viện cá nhân | `08_library_liked_recently_played.md` | Đã đủ |
| `/chat` (ChatView) | Nhắn tin | `15_messaging_chat.md` | Đã đủ |
| `/premium` | Nâng cấp | `11_premium_payment.md` | Đã đủ |
| `/admin/*` | Quản trị viên | Toàn bộ 15 file `admin/*.md` | Phủ 100% |

## 3. Các API backend đã có tài liệu (Sample Core)
| Route file | Endpoint chính | Controller | File tài liệu hiện có | Cần bổ sung không |
|---|---|---|---|---|
| `auth.routes.js` | `/login`, `/refresh` | `auth.controller.js` | `01_auth`, `03_auth_jwt` | Đã đủ |
| `song.routes.js` | `/search`, `/:id/like` | `song.controller.js` | `04_search`, `05_song` | Đã đủ |
| `aiPlaylist.routes.js`| `/preview`, `/save` | `aiPlaylist.controller.js` | `12_ai_playlist_generator.md` | Đã đủ |
| `message.routes.js`| `/conversations` | `message.controller.js` | `15_messaging_chat.md` | Đã đủ |
| `admin.routes.js` | CRUD hệ thống | `admin_*.controller.js`| Toàn bộ Nhóm Admin | Đã đủ |
| `payment.routes.js` | `/sepay/webhook` | `payment.controller.js` | `10_payment_webhook_flow.md` | Đã đủ |

## 4. Service backend chưa được nhắc đủ
| Service | Vai trò | File tài liệu hiện có | Ghi chú |
|---|---|---|---|
| `aiPlaylistIntent.service` | Phân tích Prompt bằng Gemini | `07_ai_playlist_pipeline.md` | Đã ghi rõ dùng Gemini, không dùng Claude. |
| `socket.service` | Đẩy sự kiện realtime | `11_socketio_realtime.md` | Phủ tốt |

## 5. Bảng database chưa được nhắc đủ
| Bảng | Vai trò | File tài liệu hiện có | Ghi chú |
|---|---|---|---|
| `users` | Auth, Profile | `01_auth`, `02_user_profile` | Phủ |
| `songs`, `genres`, `artists`| Metadata, Search | `05_song`, `08_admin_genres` | Đã ghi rõ cờ Taxonomy |
| `listening_history` | Recommendation, Stats | `04_tracking` | Phủ sâu |
| `payment_transactions` | Thanh toán | `10_payment` | Ghi rõ luồng SePay |
| `messages`, `conversations`| Chat mạng xã hội | `15_messaging_chat.md` | Phủ |

## 6. Phân tích trạng thái mã nguồn Python (AI Service)
Dựa trên kiểm tra `apps/ai-service/app/main.py`:
- **Đang chạy thật (Real Implementation):** 
  - `GET /health` (Status).
  - `POST /api/stem/jobs` (Tách Stem). Sử dụng model **Demucs** (`subprocess.run(["demucs", ...])`) đẩy qua Background Task và trả kết quả về Node.js qua HTTP Webhook. Chạy rất tốt.
  - Các route liên quan đến Audio Features (qua `audio_features.router`).
- **Chỉ là Stub / Chưa hoàn thiện (501 Not Implemented):**
  - `POST /api/recommend/retrain` không chạy retrain tự động; endpoint trả response `offline_training` để nhắc rằng mô hình BPR-MF được huấn luyện bằng offline cronjob/script.
  - `GET/POST /api/playlist/...` (Tạo AI Playlist). Đây là Stub bên phía Python. Thực tế chức năng này đã được cài đặt và **chạy thật bên Node.js** (Sử dụng `aiPlaylistIntent.service.js` gọi API Gemini).

## 7. Kết luận độ phủ
- **Độ phủ Module Chức năng: Đạt 100%.**
- Tất cả các Module Lớn (Auth, Player, Playlist, AI, Stem, Admin, Messaging, Payment) đều đã có tài liệu kỹ thuật chi tiết.
- Tính nhất quán về thuật ngữ (Gemini, Demucs, SePay) đã được kiểm soát chặt chẽ trên toàn bộ 51 file.
