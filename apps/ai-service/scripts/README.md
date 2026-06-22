# MusicFlow AI Service Scripts

Thu muc nay gom cac script ho tro tai nhac, tao metadata va xu ly karaoke cho MusicFlow.

## Cau truc

```text
scripts/
  download/
    youtube/
      youtube_downloader_kpop.py
      youtube_downloader_vpop.py
      youtube_downloader_usuk.py
      ytb_dl_kpop.py
      youtube_auto_api.py
    metadata/
      1_get_metadata.py
      2_download_from_csv.py
      ytb_download_from_metadata.py
      download_unified.py
    legacy/
      auto_download.py
      download_music.py
  karaoke/
    batch_preprocess_karaoke.py
    export_karaoke_completed.py
```

## Nhom script

- `download/youtube`: cac script tai truc tiep tu nguon online theo nhom KPOP, VPOP, USUK hoac YouTube Music.
- `download/metadata`: luong moi tao metadata CSV truoc, sau do tai audio dua tren CSV.
- `download/legacy`: script cu giu lai de tham khao, khong phai luong chinh.
- `karaoke`: script xu ly karaoke, stem, tach loi va export ket qua karaoke.

## Lenh chay mau

Chay tu thu muc `apps/ai-service`.

Lay metadata:

```powershell
py scripts/download/metadata/1_get_metadata.py
```

Tai tu metadata CSV:

```powershell
py scripts/download/metadata/ytb_download_from_metadata.py
```

Tai KPOP truc tiep:

```powershell
py scripts/download/youtube/ytb_dl_kpop.py
```

Xu ly karaoke:

```powershell
py scripts/karaoke/batch_preprocess_karaoke.py
```

## Ghi chu path

Nhung script da duoc chinh de resolve path tu project root bang `Path(__file__).resolve()`.
Khong can phu thuoc vao current working directory de tim `apps/backend/uploads`.
