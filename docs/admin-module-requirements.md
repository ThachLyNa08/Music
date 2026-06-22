# Đề xuất chức năng Admin cho MusicFlow

Tài liệu này tổng hợp các chức năng nên có trong phần Admin của hệ thống phát nhạc trực tuyến MusicFlow. Mục tiêu là giúp hệ thống đạt mức đầy đủ hơn cho demo và bài luận văn tốt nghiệp: không chỉ có CRUD, mà còn có quản trị dữ liệu media, kiểm soát chất lượng, thống kê và vận hành AI.

## 1. Dashboard tổng quan

Dashboard là trang đầu tiên của Admin, dùng để nhìn nhanh tình trạng hệ thống.

Nên có:

- Tổng số bài hát.
- Tổng số nghệ sĩ.
- Tổng số album.
- Tổng số thể loại.
- Tổng số người dùng.
- Tổng lượt nghe.
- Bài hát nghe nhiều nhất.
- Nghệ sĩ phổ biến nhất.
- Album phổ biến nhất.
- Bài mới thêm gần đây.
- Bài thiếu file audio.
- Bài thiếu cover.
- Bài thiếu lyrics.
- Bài chưa phân tích audio features.
- Biểu đồ lượt nghe theo ngày/tháng.
- Biểu đồ phân bố bài hát theo market: `KPOP`, `VPOP`, `USUK`, `OTHER`.
- Trạng thái hệ thống: MySQL, Redis, backend, AI service, thư mục uploads.

Ý nghĩa trong luận văn:

- Thể hiện hệ thống có khả năng quản trị và giám sát.
- Giúp hội đồng thấy dữ liệu không chỉ được lưu, mà còn được kiểm tra và vận hành.

## 2. Quản lý bài hát

Đây là module quan trọng nhất trong Admin.

### 2.1. Thông tin cơ bản

Mỗi bài hát nên hiển thị:

- ID bài hát.
- Tên bài hát.
- Nghệ sĩ chính.
- Nghệ sĩ gốc hoặc nghệ sĩ phụ nếu có.
- Album.
- Thể loại.
- Market: `KPOP`, `VPOP`, `USUK`, `OTHER`.
- Thời lượng.
- Ngày phát hành nếu có.
- Trạng thái hoạt động: active/inactive.
- Ngày tạo.
- Ngày cập nhật.

### 2.2. Thông tin file audio

Nên có:

- `audio_url`.
- Đường dẫn file vật lý tương ứng trong `apps/backend/uploads`.
- Trạng thái file có tồn tại hay không.
- Dung lượng file.
- Định dạng file, ví dụ `.mp3`.
- Bitrate nếu đọc được.
- Nút nghe thử trong Admin.
- Nút kiểm tra audio URL.
- Cảnh báo nếu file bị thiếu hoặc URL sai.

Ví dụ kiểm tra:

```text
/uploads/music/final_songs/Kpop/BLACKPINK/THE ALBUM/How You Like That.mp3
```

phải trỏ tới:

```text
apps/backend/uploads/music/final_songs/Kpop/BLACKPINK/THE ALBUM/How You Like That.mp3
```

### 2.3. Thông tin cover

Nên có:

- `cover_url`.
- Preview ảnh cover.
- Nguồn cover: metadata, Spotify, upload thủ công.
- Nút fetch lại cover.
- Nút upload cover thủ công.
- Cảnh báo nếu ảnh lỗi hoặc không tải được.

### 2.4. Thông tin lyrics/karaoke

Nên có:

- Có lyrics hay chưa.
- Có synced lyrics hay chưa.
- `lyrics_sync_type`.
- `lyrics_provider`.
- `lyrics_provider_id`.
- Ngày cập nhật lyrics.
- Preview lyrics.
- Nút fetch lyrics.
- Nút sửa lyrics thủ công.
- Nút kiểm tra lyrics trên giao diện karaoke.

Các cột liên quan:

```text
lyrics
synced_lyrics
lyrics_sync_type
lyrics_provider
lyrics_provider_id
lyrics_updated_at
```

### 2.5. Thông tin audio features

Nên có:

- BPM.
- Energy.
- Danceability.
- Acoustic score.
- Brightness.
- Mood.
- Vibe.
- Tempo level.
- Ngày phân tích.
- Nút phân tích lại audio features.
- Trạng thái đã phân tích/chưa phân tích/lỗi.

Các thông tin này phục vụ trực tiếp cho AI Playlist và recommendation.

### 2.6. Thông tin nguồn dữ liệu

Nên lưu và hiển thị:

- Source: YouTube, YouTube Music, NhacCuaTui, Spotify, manual.
- Source URL.
- Source ID.
- Cover URL gốc.
- Metadata CSV import từ file nào.
- Download status: `downloaded`, `pending`, `failed`, `missing_file`.

### 2.7. Thao tác Admin cho bài hát

Nên có:

- Thêm bài hát thủ công.
- Sửa metadata.
- Xóa mềm bài hát.
- Bật/tắt hiển thị bài hát.
- Gán lại artist.
- Gán lại album.
- Gán lại genre.
- Gán lại market.
- Upload lại audio.
- Kiểm tra file audio tồn tại.
- Fetch cover.
- Fetch lyrics.
- Analyze audio features.
- Xem log lỗi xử lý nếu có.

## 3. Quản lý nghệ sĩ

Nên có:

- Tên nghệ sĩ.
- Avatar.
- Quốc gia.
- Market chính.
- Tiểu sử.
- Số bài hát.
- Số album.
- Tổng lượt nghe.
- Số follower.
- Danh sách bài hát thuộc nghệ sĩ.
- Danh sách album/single.
- Nút fetch avatar hoặc bio.
- Gộp nghệ sĩ trùng tên nếu có.
- Kiểm tra nghệ sĩ không có bài hát.

Ý nghĩa:

- Giúp quản lý thư viện nhạc theo thực thể rõ ràng.
- Tránh lỗi nhiều artist trùng tên hoặc bài hát bị gán sai artist.

## 4. Quản lý album

Nên có:

- Tên album.
- Nghệ sĩ.
- Cover album.
- Album type: album, single, compilation.
- Total tracks.
- Song count thực tế.
- Ngày phát hành.
- Market.
- Genre.
- Danh sách bài trong album.
- Kiểm tra album có 0 bài.
- Kiểm tra `total_tracks` lệch với số bài thật.
- Fetch cover album.
- Sửa album type nếu bị phân nhầm single/album.

Ví dụ lỗi cần phát hiện:

- `BORN PINK` là album nhưng `total_tracks = 0`.
- `DEADLINE` là album nhưng bị hiển thị trong tab Singles.

Module album nên có chức năng sync:

```text
total_tracks = số bài thật trong bảng songs theo album_id
```

## 5. Quản lý thể loại

Nên có:

- Tên genre.
- Slug.
- Số bài hát.
- Số nghệ sĩ liên quan.
- Market liên quan.
- Trạng thái active.
- Gộp genre trùng hoặc sai chính tả.

Ví dụ genre:

- `KPOP-GEN3`
- `KPOP-GEN4`
- `VPOP-GENZ`
- `USUK-POP`
- `EDM`

## 6. Quản lý người dùng

Nên có:

- Danh sách user.
- Email hoặc username.
- Vai trò: user, admin.
- Trạng thái tài khoản.
- Ngày tạo.
- Lượt nghe.
- Playlist đã tạo.
- Bài hát đã thích.
- Nghệ sĩ đã follow.
- Khóa/mở khóa tài khoản.
- Reset password hoặc đổi vai trò.

Nếu hệ thống có premium:

- Trạng thái premium.
- Ngày hết hạn premium.
- Lịch sử thanh toán.
- Giao dịch thành công/thất bại.

## 7. Quản lý playlist

Nên có:

- Playlist người dùng.
- Playlist hệ thống.
- Tên playlist.
- Cover.
- Chủ sở hữu.
- Số bài hát.
- Public/private.
- Ngày tạo.
- Thêm/xóa bài trong playlist.
- Seed playlist hệ thống.
- Cleanup playlist lỗi.

Playlist hệ thống có thể dùng cho:

- Top KPOP.
- Nhạc mới.
- Nhạc chill.
- Nhạc tập gym.
- Nhạc buồn.

## 8. Quản lý AI Playlist và Recommendation

Nếu luận văn có AI Playlist, Admin nên có phần kiểm tra riêng.

Nên có:

- Prompt người dùng nhập.
- Market filter.
- Mood/vibe được phân tích.
- Danh sách bài được gợi ý.
- Lý do bài hát được chọn nếu có.
- Bài nào thiếu audio features.
- Log lỗi AI service.
- Nút test prompt mẫu.

Prompt test:

```text
Kpop nhẹ nhàng
nhạc cháy để tập gym
nhạc suy lúc 2 giờ sáng
```

Ý nghĩa:

- Thể hiện rõ phần AI của hệ thống.
- Chứng minh audio features được dùng vào recommendation, không chỉ lưu trong DB.

## 9. Data Quality Dashboard

Đây là module rất nên có cho luận văn vì thể hiện khả năng kiểm soát chất lượng dữ liệu.

Nên có các chỉ số:

- Bài thiếu audio file.
- Bài có `audio_url` sai.
- Bài thiếu cover.
- Album thiếu cover.
- Bài thiếu lyrics.
- Bài thiếu synced lyrics.
- Bài chưa có audio features.
- Album có `total_tracks = 0` nhưng có bài thật.
- Album bị phân loại sai single/album.
- Artist không có bài.
- Genre không có bài.
- Market bị `OTHER`.
- File tồn tại trong uploads nhưng chưa có trong DB.
- DB có `audio_url` nhưng file không tồn tại.

Nên có các nút xử lý:

- Repair audio path.
- Sync album track count.
- Update metadata status.
- Re-analyze features.
- Export report CSV.

## 10. Import / Maintenance Center

Đây là khu vực dành cho admin kỹ thuật hoặc người vận hành dataset.

Nên có:

- Upload metadata CSV.
- Preview CSV.
- Validate CSV.
- Kiểm tra cột bắt buộc.
- Kiểm tra file audio tồn tại.
- Cập nhật `Download_Status`.
- Import bài hát vào DB.
- Fetch cover.
- Fetch lyrics.
- Analyze audio features.
- Export report.
- Xem log từng bước.

Luồng tương ứng với script hiện tại:

```text
1_get_metadata.py
ytb_download_from_metadata.py
updateMetadataDownloadStatus.js
importSongsFromMetadataCsv.js
fetch_selected_album_covers.js
crawl/normalize/import lyrics
analyzeSongAudioFeatures.js
exportSongAudioFeatures.js
```

Dù chưa làm UI đầy đủ, trong luận văn có thể mô tả đây là module vận hành và hiện tại được thực hiện bằng CLI scripts.

## 11. Báo cáo và thống kê

Nên có:

- Top bài hát theo lượt nghe.
- Top nghệ sĩ.
- Top album.
- Top genre.
- Lượt nghe theo ngày/tháng.
- Tỷ lệ bài theo market.
- Tỷ lệ bài có lyrics.
- Tỷ lệ bài có synced lyrics.
- Tỷ lệ bài có audio features.
- Tỷ lệ bài có cover.
- User hoạt động nhiều nhất.
- Export CSV.

Các báo cáo này giúp phần luận văn có cơ sở đánh giá hệ thống.

## 12. Nhật ký hệ thống

Nếu có thời gian, nên bổ sung audit log.

Nên ghi:

- Admin nào thao tác.
- Thao tác gì.
- Đối tượng bị tác động: song, artist, album, user.
- Dữ liệu trước/sau nếu cần.
- Thời gian thao tác.
- Kết quả thành công/thất bại.
- Lý do lỗi nếu thất bại.

Ví dụ:

```text
admin_id=1
action=IMPORT_SONG
target=songs
target_id=7652
status=success
created_at=...
```

## 13. Mức ưu tiên triển khai

Nếu thời gian có hạn, nên ưu tiên theo thứ tự:

1. Dashboard tổng quan.
2. Quản lý bài hát chi tiết.
3. Quản lý artist/album/genre.
4. Data Quality Dashboard.
5. Import metadata CSV vào DB.
6. Fetch cover/lyrics/audio features.
7. Thống kê lượt nghe.
8. Quản lý user/playlist.
9. AI Playlist testing panel.
10. Audit log.

## 14. Gợi ý phạm vi tối thiểu cho luận văn

Nếu cần một phạm vi vừa đủ để demo tốt, nên làm các phần sau:

### Bắt buộc nên có

- Dashboard tổng quan.
- Quản lý bài hát.
- Quản lý nghệ sĩ.
- Quản lý album.
- Quản lý genre.
- Kiểm tra bài thiếu audio/cover/lyrics/features.
- Import bài từ CSV bằng script hoặc UI.
- Phân tích audio features.

### Nên có nếu còn thời gian

- Quản lý user.
- Quản lý playlist.
- Fetch lyrics từ Admin.
- Fetch cover từ Admin.
- AI Playlist testing panel.
- Export report CSV.

### Có thể mô tả trong hướng phát triển

- Audit log đầy đủ.
- Phân quyền admin nhiều cấp.
- Moderation nội dung.
- Quản lý bản quyền/licensing.
- Hàng đợi xử lý background jobs.

## 15. Kết luận định hướng Admin cho MusicFlow

Phần Admin của MusicFlow nên tập trung vào ba giá trị chính:

1. Quản lý thư viện nhạc: bài hát, nghệ sĩ, album, thể loại, playlist.
2. Kiểm soát chất lượng dữ liệu media: audio file, cover, lyrics, audio features.
3. Hỗ trợ AI Playlist: đảm bảo bài hát có features và có công cụ test prompt.

Nếu trình bày theo hướng này, Admin không chỉ là phần phụ, mà trở thành trung tâm vận hành dữ liệu cho toàn bộ hệ thống phát nhạc trực tuyến.
