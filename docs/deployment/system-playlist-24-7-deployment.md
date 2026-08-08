# Triển khai System Playlist Scheduler chạy 24/7

## 1. Mục đích

Tài liệu này mô tả cách triển khai System Playlist Scheduler để hệ thống có thể tự kiểm tra và làm mới playlist hệ thống dù máy cá nhân của người phát triển đã tắt.

Scheduler trong MusicFlow được chạy bởi backend. Vì vậy, để scheduler hoạt động liên tục, backend cần được triển khai trên một môi trường luôn hoạt động như VPS, server riêng hoặc cloud server.

## 2. Nguyên tắc

- Code chạy trên máy nào thì máy đó phải đang hoạt động.
- Nếu backend chạy trên laptop local, scheduler chỉ hoạt động khi laptop bật và backend đang chạy.
- Nếu backend chạy trên VPS/server luôn bật, scheduler có thể hoạt động 24/7.
- Không có cách nào để một máy đã tắt nguồn vẫn tự chạy node-cron local.

## 3. Mô hình triển khai đề xuất

Frontend:

- Deploy bằng Nginx hoặc nền tảng static hosting.

Backend:

- Deploy lên VPS Ubuntu.
- Chạy backend bằng PM2.
- Bật node-cron bằng `.env` production.

Database:

- MySQL đặt trên VPS hoặc cloud database.
- Backend phải truy cập được database production.

## 4. Cấu hình .env production

```env
SYSTEM_PLAYLIST_CRON_ENABLED=true
SYSTEM_PLAYLIST_CRON_SCHEDULE=0 0 * * *
SYSTEM_PLAYLIST_CRON_TIMEZONE=Asia/Ho_Chi_Minh
SYSTEM_PLAYLIST_CRON_LOCK_TTL_MINUTES=120
SYSTEM_PLAYLIST_CRON_RUN_ON_STARTUP=true
SYSTEM_PLAYLIST_CRON_STARTUP_DELAY_SECONDS=10
```

## 5. Chạy backend bằng PM2

```bash
cd /var/www/musicflow/apps/backend
npm install --production
pm2 start src/server.js --name musicflow-backend
pm2 save
pm2 startup
```

Sau khi chạy `pm2 startup`, PM2 thường in ra một lệnh cấu hình systemd cần chạy thêm với quyền sudo. Sao chép và chạy đúng lệnh đó trên VPS để backend tự khởi động lại sau reboot.

## 6. Kiểm tra backend tự khởi động lại sau reboot

```bash
pm2 status
pm2 logs musicflow-backend
```

## 7. Kiểm tra scheduler đã đăng ký

Log mong muốn khi backend start và cron được bật:

```text
[SystemPlaylistCron] registered schedule=0 0 * * * timezone=Asia/Ho_Chi_Minh
[SystemPlaylistCron] startup catch-up scheduled after 10s
```

Nếu `SYSTEM_PLAYLIST_CRON_ENABLED=false`, backend sẽ không đăng ký cron và log:

```text
[SystemPlaylistCron] disabled
```

## 8. Kiểm tra DB run log

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

## 9. Giải thích trạng thái

- `success`: scheduler có target và xử lý thành công.
- `skipped`: scheduler đã kiểm tra nhưng không có mục cần xử lý.
- `failed`: scheduler lỗi.
- `partial_success`: một phần xử lý thành công, một phần lỗi.

## 10. Câu đưa vào luận văn

"Để bảo đảm tiến trình tạo và làm mới playlist hệ thống có thể hoạt động tự động trong môi trường triển khai thực tế, backend MusicFlow được thiết kế để chạy như một tiến trình nền trên server. Khi backend được triển khai trên VPS hoặc server luôn hoạt động, cơ chế node-cron sẽ tự động đăng ký lịch chạy, đồng thời thực hiện catch-up khi backend khởi động lại. Nhờ đó, scheduler có thể kiểm tra và làm mới playlist theo lịch mà không phụ thuộc vào việc quản trị viên mở máy cá nhân hoặc truy cập giao diện quản trị."

## 11. Lưu ý

- Local demo: máy phải bật, backend phải chạy.
- VPS/server: máy cá nhân có thể tắt, scheduler vẫn chạy.
- Không dùng `--force` trong cron production.
- `SYSTEM_PLAYLIST_CRON_RUN_ON_STARTUP` chỉ kiểm tra `--all-due`, không ép làm mới toàn bộ.
- node-cron local chỉ chạy khi backend local đang chạy.
- Nếu máy cá nhân tắt thì local cron không chạy.
