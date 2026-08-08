# System Playlist Node Cron

## Mục đích

`node-cron` giúp backend tự chạy System Playlist Scheduler khi backend đang hoạt động. Cron này gọi scheduler theo lịch cấu hình, ghi run log vào `system_playlist_generation_runs` với `trigger_source = scheduler`, và không phụ thuộc vào việc mở trang admin.

## Cách bật local

Trong `apps/backend/.env`:

```env
SYSTEM_PLAYLIST_CRON_ENABLED=true
SYSTEM_PLAYLIST_CRON_SCHEDULE=0 0 * * *
SYSTEM_PLAYLIST_CRON_TIMEZONE=Asia/Ho_Chi_Minh
SYSTEM_PLAYLIST_CRON_LOCK_TTL_MINUTES=120
SYSTEM_PLAYLIST_CRON_RUN_ON_STARTUP=false
SYSTEM_PLAYLIST_CRON_STARTUP_DELAY_SECONDS=10
```

## Catch-up khi backend khởi động

Cron `0 0 * * *` chỉ chạy nếu backend đang hoạt động tại đúng 00:00. Nếu backend tắt lúc 00:00 và được mở lại lúc 08:00 hoặc 16:00, cron sẽ chờ lần 00:00 tiếp theo.

Để tránh bỏ lỡ lịch khi backend khởi động sau 00:00, có thể bật:

```env
SYSTEM_PLAYLIST_CRON_RUN_ON_STARTUP=true
SYSTEM_PLAYLIST_CRON_STARTUP_DELAY_SECONDS=10
```

Cơ chế này đợi hết delay rồi chạy scheduler `--all-due` một lần. Nó chỉ kiểm tra các playlist đến lượt hoặc cần xử lý, không dùng `--force` và không làm mới toàn bộ. Cách này phù hợp cho local demo và server restart.

## Cách test nhanh

Có thể đổi schedule tạm sang mỗi 5 phút:

```env
SYSTEM_PLAYLIST_CRON_SCHEDULE=*/5 * * * *
```

Sau khi test xong phải đổi lại:

```env
SYSTEM_PLAYLIST_CRON_SCHEDULE=0 0 * * *
```

## Lưu ý

- `node-cron` chỉ chạy khi backend đang chạy.
- Nếu máy cá nhân tắt thì `node-cron` local không chạy.
- Nếu backend deploy trên server/VPS luôn bật thì `node-cron` sẽ tự chạy theo lịch.
- Cron tự động chỉ chạy chế độ `--all-due`.
- Cron tự động không dùng `--force`.
- Startup catch-up cũng không dùng `--force`.
- `--force` chỉ dùng test thủ công có kiểm soát.
- Scheduler có DB lock để tránh nhiều tiến trình cron chạy cùng lúc.

## Cách kiểm tra DB

```sql
SELECT
  id,
  trigger_source,
  scheduler_name,
  scheduled_for,
  mode,
  status,
  total_count,
  processed_count,
  success_count,
  failed_count,
  skipped_count,
  started_at,
  finished_at
FROM system_playlist_generation_runs
WHERE trigger_source = 'scheduler'
ORDER BY id DESC
LIMIT 10;
```

## Ý nghĩa trạng thái

- `success`: có target và xử lý thành công.
- `skipped`: đã kiểm tra nhưng không có mục cần xử lý.
- `failed`: lỗi khi chạy.
- `partial_success`: hoàn tất một phần.

## Câu đưa vào luận văn

"Hệ thống bổ sung cơ chế lập lịch bằng node-cron trong backend. Khi backend được khởi động, cron job sẽ tự động đăng ký lịch chạy và gọi scheduler vào thời điểm cấu hình, ví dụ 00:00 hằng ngày. Tác vụ này kiểm tra các nhóm playlist đến lượt và ghi nhận kết quả vào bảng system_playlist_generation_runs với trigger_source = scheduler. Cách triển khai này giúp hệ thống tự động kiểm tra/làm mới playlist khi backend đang hoạt động, đồng thời vẫn phân biệt được tác vụ tự động với thao tác bảo trì thủ công từ quản trị viên."
