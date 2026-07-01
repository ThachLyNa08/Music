# Admin QA Checklist

## /admin
- [ ] Layout tổng thể (không scroll lồng, header/sidebar không lỗi)
- [ ] Không có các class gây kẹt: `h-screen`, `overflow-hidden` sai chỗ

## /admin/songs
- [ ] Table không tràn ngang
- [ ] Action menu dùng `AdminActionMenu`, có đủ hành động
- [ ] Cover fallback đúng
- [ ] Filter/search reset page
- [ ] Pagination giữ đúng limit
- [ ] Xóa bài hát dùng `ConfirmDialog`

## /admin/songs/:id
- [ ] Thông tin đúng, layout không vỡ do raw data (lyrics, JSON)
- [ ] Link navigation hoạt động

## /admin/artists
- [ ] KPI dùng `AdminKpiCard`, số thực
- [ ] Search/filter reset page
- [ ] Avatar fallback đúng
- [ ] Xóa dùng `ConfirmDialog`

## /admin/artists/:id/detail
- [ ] Header/detail không lệch tone
- [ ] Popular songs/discography không tràn
- [ ] Link điều hướng bài hát/album đúng

## /admin/albums
- [ ] Action menu column vừa vặn
- [ ] Quick release hoạt động
- [ ] Các tính năng filter không nhảy layout

## /admin/genres
- [ ] KPI dùng `AdminKpiCard`
- [ ] Badge recommendation rõ ràng
- [ ] Action menu không bị cắt
- [ ] Gộp/xóa dùng `ConfirmDialog`

## /admin/genres/:id
- [ ] Stats hiển thị đúng
- [ ] Top songs/artists không vỡ layout rỗng

## /admin/lyrics
- [ ] KPI gọn
- [ ] Badge lyrics đồng bộ/thường/không có rõ ràng
- [ ] Phân trang 20/page
- [ ] Hành động xem/sửa đi tới route `:songId` chuẩn

## /admin/lyrics/:songId
- [ ] Layout tabs plain/synced hoạt động tốt
- [ ] Validate format lyrics đúng (mm:ss)
- [ ] Lưu lyrics cập nhật đúng trạng thái sync_type

## /admin/users
- [ ] Table không giật khi load
- [ ] Badge status/role/premium rõ ràng
- [ ] Action menu gọn, ConfirmDialog khi khóa tài khoản

## /admin/users/:id
- [ ] Engagement heatmap không vỡ
- [ ] Không duplicate lịch sử premium nếu không cần thiết
- [ ] Link liên kết hệ thống tốt

## /admin/payments
- [ ] Format tiền tệ VND đúng
- [ ] Filter ngày không bị mất khi thao tác
- [ ] Payment detail / Copy mã hoạt động
- [ ] Hủy giao dịch dùng ConfirmDialog

## /admin/premium
- [ ] KPI dùng `AdminKpiCard`
- [ ] Modal premium chi tiết hoạt động
- [ ] Hủy premium dùng `ConfirmDialog`

## /admin/music-data-tools
- [ ] Layout không vỡ vì raw metadata
- [ ] Health score tính đúng
- [ ] Navigation về sửa lyrics chuẩn xác

## /admin/system-playlists
- [ ] Không hiển thị bảng hàng ngàn dòng
- [ ] Regenerate All dùng ConfirmDialog

## /admin/recommendation
- [ ] Model metrics hiển thị chuẩn
- [ ] Layout các bảng đồ thị chuẩn

## /admin/ai-playlist-test
- [ ] Prompt preview hoạt động
- [ ] Các state Loading/error hiển thị đủ

## /admin/stem-jobs
- [ ] Job status badge chuẩn
- [ ] Action retry/cancel dùng ConfirmDialog
- [ ] Log output không vỡ layout

## Phase 2: Lyrics & Metadata

### /admin/lyrics
- [ ] KPI đồng bộ
- [ ] FilterBar đồng bộ
- [ ] TableShell đồng bộ
- [ ] Pagination 20 dòng/trang
- [ ] Badge lyrics đúng
- [ ] Action route đúng `/admin/lyrics/:songId`

### /admin/lyrics/:songId
- [ ] Trang riêng
- [ ] Tabs hoạt động
- [ ] Validate synced lyrics
- [ ] Save provider MANUAL
- [ ] Không fake timestamp

### /admin/music-data-tools
- [ ] Không còn chức năng ảo
- [ ] Không show full lyrics/raw JSON dài
- [ ] Link lyrics đúng

### /admin/system-playlists
- [ ] Không bảng quá dài
- [ ] ConfirmDialog cho thao tác nguy hiểm

## Phase 3: Users & Payments

### /admin/users
- [ ] KPI đồng bộ
- [ ] FilterBar đồng bộ
- [ ] TableShell đồng bộ
- [ ] ActionMenu hoạt động
- [ ] ConfirmDialog cho thao tác nguy hiểm
- [ ] Pagination reset khi filter

### /admin/users/:id
- [ ] Layout không tràn
- [ ] Engagement Summary ổn
- [ ] Heatmap không vỡ layout
- [ ] Empty state rõ

### /admin/payments
- [ ] KPI đồng bộ
- [ ] Filter ngày hoạt động
- [ ] PaymentDetailModal hoạt động
- [ ] Hủy pending dùng ConfirmDialog
- [ ] Format tiền VND đúng

### /admin/premium
- [x] KPI đồng bộ

## Phase 4: AI & ML Systems

### /admin/recommendation
- [ ] KPI/metrics dùng AdminKpiCard
- [ ] Table/log dùng AdminTableShell
- [ ] Không hardcode metrics
- [ ] Action retrain/rebuild dùng ConfirmDialog nếu có
- [ ] Layout không khóa scroll

### /admin/ai-playlist-test
- [ ] Form test prompt hiển thị chuẩn
- [ ] Loading/error state rõ
- [ ] Preview không vỡ layout
- [ ] Không autoplay
- [ ] Không tự save playlist
- [ ] Không fake result

### /admin/stem-jobs
- [ ] KPI dùng AdminKpiCard
- [ ] FilterBar đồng bộ
- [ ] TableShell đồng bộ
- [ ] ActionMenu hoạt động
- [ ] Retry/cancel dùng ConfirmDialog
- [ ] Log dài không làm tràn layout
- [ ] PremiumDetailModal hoạt động
- [ ] PremiumManageModal hoạt động
- [ ] Không đưa lại chức năng Đổi gói
- [ ] Hủy/gia hạn dùng ConfirmDialog nếu cần
