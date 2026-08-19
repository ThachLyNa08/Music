# Backend Scripts

Thư mục này chỉ giữ các script vận hành/bảo trì còn hữu ích cho phiên bản hiện tại. Chạy từ `apps/backend` để `.env` và các đường dẫn tương đối được nạp đúng.

## Quy tắc an toàn

- Không chạy import, migration, repair hoặc crawl/fetch hàng loạt nếu chưa kiểm tra database và tham số.
- Ưu tiên dry-run khi script hỗ trợ.
- Không đổi runtime URL `/uploads` hoặc di chuyển `apps/backend/uploads/`.
- Các harness kiểm thử theo từng vòng, file debug tạm, report sinh ra và backup repair cũ không được giữ trong source nộp.

## Nhóm script còn lại

- `admin/`: thao tác quản trị có kiểm soát.
- `audit/`: audit dữ liệu/file còn dùng được.
- `fetch/`: fetch avatar/cover.
- `health/`: kiểm tra nhanh database/runtime.
- `import/`: import/đồng bộ dữ liệu nhạc.
- `lyrics/`: crawl, normalize và import lyrics.
- `maintenance/`: audio features, semantic profiles, scheduler/recovery.
- `migrations/`: migration schema; `npm run migrate` sử dụng `migrations/migrate.js`.
- `playlist/`: seed playlist hệ thống.
- `repair/`: công cụ repair có chủ đích.
- `search/`: build/test lyrics search theo npm script.
- `tests/`: test kỹ thuật còn liên quan đến runtime hiện tại.

## Lệnh thường dùng

```powershell
npm run migrate
npm run migrate-region
npm run scheduler:audit
npm run scheduler:once
node scripts/health/test_db.js
```

Với script có khả năng ghi dữ liệu, đọc source và xác nhận `.env` trước khi chạy.
