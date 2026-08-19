# Dữ liệu để chạy lại demo MusicFlow

Repository GitHub chỉ chứa mã nguồn, schema/migration và các script cần thiết. Các dữ liệu lớn như database demo, semantic dataset, artifact recommendation và media không commit trực tiếp vào GitHub để tránh repository quá lớn.

## 1. Thư mục dữ liệu lớn

Thư mục Google Drive dùng để bàn giao dữ liệu luận văn:

https://drive.google.com/drive/folders/1CB_ZKqI-5H6pEKiS0QVh3I8pVON5F5Bj

**Trước khi nộp chính thức, cần bảo đảm trong thư mục trên có các file sau:**

| Nhóm | Tên file đề xuất | Sau khi tải / giải nén |
| --- | --- | --- |
| Database demo | `musicflow_demo.sql` | Đặt tại `demo-data/musicflow_demo.sql` rồi import vào MySQL |
| Semantic dataset | `musicflow_semantic_dataset.zip` | Giải nén để có `datasets/processed/semantic/profiles/song_semantic_profiles.csv` |
| Recommendation/model artifacts | `musicflow_recommendation_artifacts.zip` | Giải nén để khôi phục cây `storage/` và/hoặc artifact V4 theo đúng cấu trúc gói |
| Media demo | `musicflow_media_demo.zip` | Giải nén để khôi phục `apps/backend/uploads/` |
| Tài khoản demo | `DEMO_ACCOUNTS.txt` | Chỉ bàn giao trong Drive/gói nộp; không commit mật khẩu lên GitHub |

> Lần rà soát repository ngày 19/08/2026 chưa tìm thấy các gói lớn trên Drive theo các tên chuẩn ở bảng trên. Vì vậy cần upload chúng trước khi xem bộ bàn giao là hoàn chỉnh.

## 2. Dữ liệu catalog tham khảo hiện có

File catalog đang có trên Drive:

https://docs.google.com/spreadsheets/d/1mFFem2BlYohi1sXhDUB7_Q5B5JI_78m5/edit?usp=drivesdk

File này là dữ liệu catalog tham khảo, **không thay thế** cho `musicflow_demo.sql`, semantic dataset, recommendation artifacts hoặc media demo.

## 3. Cấu trúc gói dữ liệu khuyến nghị

Nếu muốn người chấm chỉ tải một file, nên tạo `MusicFlow-demo-data.zip` có cấu trúc:

```text
MusicFlow-demo-data.zip
├─ demo-data/
│  ├─ musicflow_demo.sql
│  └─ DEMO_ACCOUNTS.txt
├─ datasets/
│  └─ processed/semantic/profiles/song_semantic_profiles.csv
├─ storage/
│  └─ ... artifact recommendation/model ...
└─ apps/backend/uploads/
   └─ ... audio, cover, vocal, instrumental ...
```

Giải nén file ZIP ngay tại thư mục gốc repository để các đường dẫn được khôi phục đúng vị trí.

PowerShell:

```powershell
Expand-Archive .\MusicFlow-demo-data.zip -DestinationPath . -Force
```

## 4. Import database demo

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

## 5. Kiểm tra dữ liệu sau khi giải nén

Từ thư mục gốc repository:

```powershell
Test-Path .\demo-data\musicflow_demo.sql
Test-Path .\datasets\processed\semantic\profiles\song_semantic_profiles.csv
Test-Path .\storage
Test-Path .\apps\backend\uploads
```

Kết quả mong đợi với gói demo đầy đủ: tất cả trả về `True`.

Kiểm tra database:

```powershell
mysql -u root -p -D musicflow -e "SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS songs FROM songs; SELECT COUNT(*) AS interactions FROM listening_history;"
```

## 6. Tài khoản demo

Không lưu mật khẩu tài khoản demo trong GitHub public. Khi nộp, file `DEMO_ACCOUNTS.txt` trong Drive/gói dữ liệu nên có tối thiểu:

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

## 7. Nếu chỉ muốn chạy source tối thiểu

Có thể chạy schema trong `database/schema/musicflow_schema.sql`, migration và seed nhỏ trong `database/seeds/`. Cách này dùng để xác nhận ứng dụng khởi động, **không tái tạo đầy đủ dữ liệu và kết quả demo luận văn**.
