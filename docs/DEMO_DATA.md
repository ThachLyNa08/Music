# Dữ liệu để chạy lại demo MusicFlow

Repository GitHub chứa mã nguồn, schema/migration, tài liệu và một số catalog nhạc dạng CSV. Các dữ liệu lớn như database demo, semantic dataset, recommendation artifacts và media không nên commit trực tiếp vào GitHub.

## 1. Dữ liệu catalog nhạc có sẵn trong GitHub

Ba CSV catalog nguồn đang được giữ trong `docs/`:

```text
docs/music_database_kpop.csv
docs/music_database_usuk.csv
docs/music_database_vpop.csv
```

Đây là metadata/catalog sinh ra trong quá trình xây dựng kho nhạc. Các file có những trường như tiêu đề, nghệ sĩ, album, genre, URL nguồn, cover URL và file path media.

Lưu ý:

- Ba CSV này giúp đối chiếu nguồn catalog nhạc đã thu thập.
- Ba CSV này **không thay thế** MySQL database dump `musicflow_demo.sql`.
- Ba CSV này **không thay thế** semantic profile dùng bởi Semantic RAG.
- Ba CSV này **không thay thế** recommendation artifacts LightGCN V4 đã huấn luyện.

## 2. Dữ liệu bắt buộc để chạy demo đầy đủ

Một bộ bàn giao demo đầy đủ cần có:

| Nhóm | File/thư mục | Vị trí sau khi tải hoặc giải nén |
|---|---|---|
| Database demo | `musicflow_demo.sql` | `demo-data/musicflow_demo.sql` |
| Semantic RAG dataset | `song_semantic_profiles.csv` | `datasets/processed/semantic/profiles/song_semantic_profiles.csv` |
| Recommendation runtime V4 artifacts | hai JSON LightGCN V4 ở mục 3A nếu muốn tái tạo đúng recommendation đã chuẩn bị | `storage/recommendation/evaluation/v4/` |
| Media demo | audio, cover, vocal/instrumental nếu cần Karaoke | `apps/backend/uploads/` hoặc thư mục media tương ứng được DB trỏ tới |
| Tài khoản demo | `DEMO_ACCOUNTS.txt` | `demo-data/DEMO_ACCOUNTS.txt` hoặc gói bàn giao riêng |

`DEMO_ACCOUNTS.txt` chứa tài khoản demo để đăng nhập khi chấm. Không commit mật khẩu hoặc API key lên GitHub.

Nếu demo AI Playlist Semantic RAG, cần file:

```text
datasets/processed/semantic/profiles/song_semantic_profiles.csv
```

## 3. Recommendation V4 artifacts

`apps/backend/src/services/recommendationModel.service.js` đọc artifact V4 tại:

```text
storage/recommendation/evaluation/v4/
```

### 3A. Artifact phục vụ recommendation runtime V4

Hai artifact runtime cần đặt đúng vị trí nếu muốn demo phục vụ đúng recommendation LightGCN V4 đã chuẩn bị:

| Key | File |
|---|---|
| `serving` | `lightgcn_hybrid_serving_recs_v4.json` |
| `lightgcn` | `lightgcn_hybrid_recs_v4.json` |

Trong đường API chính, `recommendation.service.js` ưu tiên `serving` artifact rồi thử `lightgcn` artifact. Nếu thiếu file, chưa có entry hợp lệ cho user, lỗi JSON, hoặc sau khi xác thực MySQL không còn đủ bài hợp lệ, service vẫn fallback runtime sang:

- Content-Based
- cold-start/onboarding
- Most Popular

### 3B. Artifact phục vụ tái lập/đối chiếu thực nghiệm V4

Ba artifact dưới đây phục vụ tái lập pipeline, đối chiếu kết quả thực nghiệm và so sánh trong báo cáo V4. Không gọi ba file này là bắt buộc chỉ để mở runtime demo.

| Key | File |
|---|---|
| `bpr` | `bpr_hybrid_recs_v4.json` |
| `cb` | `content_based_recs_v4.json` |
| `popular` | `most_popular_recs_v4.json` |

Lưu ý vận hành:

- Đường API recommendation chính dùng `tryLoadArtifact(...)` theo từng artifact để fallback mềm.
- Nếu gọi trực tiếp `modelService.load()`, loader có thể yêu cầu đủ các artifact đã khai báo trong `recommendationModel.service.js`.
- `bpr_hybrid_recs_v4.json` là artifact so sánh/evaluation V4, không phải model serving chính.

## 4. Cấu trúc gói dữ liệu khuyến nghị

Nếu muốn người chấm chỉ tải một file, có thể tạo `MusicFlow-demo-data.zip` với cấu trúc:

```text
MusicFlow-demo-data.zip
├─ demo-data/
│  ├─ musicflow_demo.sql
│  └─ DEMO_ACCOUNTS.txt
├─ datasets/
│  └─ processed/semantic/profiles/song_semantic_profiles.csv
├─ storage/
│  └─ recommendation/evaluation/v4/
│     ├─ lightgcn_hybrid_serving_recs_v4.json
│     ├─ lightgcn_hybrid_recs_v4.json
│     ├─ bpr_hybrid_recs_v4.json
│     ├─ content_based_recs_v4.json
│     └─ most_popular_recs_v4.json
└─ apps/backend/uploads/
   └─ ... audio, cover, vocal, instrumental ...
```

Giải nén file ZIP ngay tại thư mục gốc repository để các đường dẫn được khôi phục đúng vị trí.

PowerShell:

```powershell
Expand-Archive .\MusicFlow-demo-data.zip -DestinationPath . -Force
```

## 5. Import database demo

Tạo database nếu chưa có:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS musicflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Import dump:

```powershell
cmd /c "mysql -u root -p musicflow < demo-data\musicflow_demo.sql"
```

Sau đó cấu hình `apps/backend/.env` với đúng tài khoản MySQL và chạy:

```powershell
cd apps\backend
npm ci
npm run migrate
```

`npm run migrate` giúp đồng bộ các cột/index mới nếu dump được tạo trước lần cập nhật schema gần nhất.

## 6. Kiểm tra dữ liệu sau khi giải nén

Từ thư mục gốc repository:

```powershell
Test-Path .\demo-data\musicflow_demo.sql
Test-Path .\datasets\processed\semantic\profiles\song_semantic_profiles.csv
Test-Path .\storage\recommendation\evaluation\v4\lightgcn_hybrid_serving_recs_v4.json
Test-Path .\storage\recommendation\evaluation\v4\lightgcn_hybrid_recs_v4.json
Test-Path .\apps\backend\uploads
```

Với gói demo đầy đủ, các lệnh kiểm tra thành phần cần demo phải trả `True`.

Nếu cần tái lập hoặc đối chiếu thực nghiệm V4, kiểm tra thêm:

```powershell
Test-Path .\storage\recommendation\evaluation\v4\bpr_hybrid_recs_v4.json
Test-Path .\storage\recommendation\evaluation\v4\content_based_recs_v4.json
Test-Path .\storage\recommendation\evaluation\v4\most_popular_recs_v4.json
```

Kiểm tra database:

```powershell
mysql -u root -p -D musicflow -e "SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS songs FROM songs; SELECT COUNT(*) AS interactions FROM listening_history;"
```

## 7. Tài khoản demo

Không lưu mật khẩu tài khoản demo trong GitHub public. Khi nộp, file `DEMO_ACCOUNTS.txt` trong gói dữ liệu nên có tối thiểu:

```text
USER_EMAIL=...
USER_PASSWORD=...
PREMIUM_EMAIL=...
PREMIUM_PASSWORD=...
ARTIST_EMAIL=...
ARTIST_PASSWORD=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
COLD_START_EMAIL=...
COLD_START_PASSWORD=...
```

Các tài khoản phải tồn tại trong chính `musicflow_demo.sql` được bàn giao.

## 8. Nếu chỉ muốn chạy source tối thiểu

Có thể chạy schema trong `database/schema/musicflow_schema.sql`, migration và seed nhỏ trong `database/seeds/`. Cách này dùng để xác nhận ứng dụng khởi động, **không tái tạo đầy đủ dữ liệu và kết quả demo luận văn**.
