---

name: musicflow-thesis-report
description: Write and edit academic thesis/report content for the MusicFlow graduation thesis. Use this skill for Vietnamese thesis chapters, feature descriptions, system architecture explanations, database design, algorithm explanations, test cases, evaluation reports, README documentation, and defense slide content. It ensures technical accuracy, academic tone, and honest status reporting.
license: Complete terms in LICENSE.txt
--------------------------------------

# MusicFlow Thesis Report

This skill guides academic writing and documentation for the **MusicFlow graduation thesis**.

MusicFlow topic:

```text
Hệ thống phát nhạc trực tuyến tích hợp thuật toán gợi ý và tự động tạo danh sách phát dựa trên hành vi người dùng
```

## Purpose

Use this skill to write or edit:

* Thesis chapters
* Technical reports
* Feature descriptions
* System architecture documentation
* Database design explanation
* API documentation
* Algorithm explanations
* Test case descriptions
* Evaluation reports
* README technical content
* Defense slide content
* Project summary
* Limitation and future development sections

## Academic Context

MusicFlow is an Information Technology graduation thesis project.

The system includes:

* User account management
* Online music playback
* Playlist management
* Personalized recommendation
* Automatic playlist generation
* AI playlist generation using natural language
* Stem separation / karaoke AI
* Premium payment
* Admin management

Core technologies:

```text
Vue 3
Vite
Pinia
Vue Router
Tailwind CSS
Node.js / Express
Python / FastAPI
MySQL
Redis
Socket.IO
Recommendation algorithms
LLM API
```

## Current Project Structure

Use the current structure when writing technical documentation:

```text
Luan_Van/
├─ apps/
│  ├─ backend/
│  ├─ frontend/
│  └─ ai-service/
├─ database/
│  ├─ schema/
│  ├─ migrations/
│  └─ seeds/
├─ datasets/
│  ├─ raw/
│  └─ processed/
├─ docs/
│  ├─ thesis/
│  ├─ design/
│  └─ reports/
├─ storage/
├─ agent-skills/
├─ AGENTS.md
└─ README.md
```

Do not describe the old root-level `backend/`, `frontend/`, `ai-service/` structure as the current structure unless writing historical notes.

Runtime media remains in:

```text
apps/backend/uploads/
```

This should be described as backend runtime media storage if needed.

## Writing Language

Default language:

```text
Formal Vietnamese
```

Use English only when:

* The user requests English.
* Writing an Abstract.
* Explaining code/API terms where English terminology is standard.
* Writing code comments or developer documentation that is expected in English.

## Tone

Use academic tone:

* Clear
* Objective
* Technical
* Evidence-based
* Structured
* Not exaggerated
* Not marketing-like

Avoid phrases like:

```text
cực kỳ thông minh
hoàn hảo tuyệt đối
tối ưu tuyệt đối
đẳng cấp thế giới
chỉ có nước cho A+
siêu xịn
trùm cuối
```

In thesis/report writing, replace casual language with academic phrasing.

## Accuracy Rules

Always distinguish feature status clearly:

```text
Đã hoàn thành
Đang phát triển
Dự kiến phát triển
Chưa triển khai
Hạn chế
Hướng phát triển
```

Do not claim a feature is complete if:

* It only has frontend UI.
* It uses mock data.
* Backend route is stub.
* AI service is not connected.
* Payment webhook is not real.
* Socket.IO realtime update is not working.
* Recommendation is only simple SQL but described as full ML.
* Stem separation does not actually process audio.
* AI playlist returns hardcoded tracks.

If implementation differs from earlier thesis plan, use actual implementation in implementation sections.

Examples:

* If payment provider is SePay, do not write VNPay/MoMo in Chapter 4 implementation.
* If stem separation uses Demucs, do not write Spleeter in implementation results.
* If recommendation currently uses SQL fallback, do not claim full SVD is complete.
* If Claude/Gemini integration is planned but not connected, mark it as planned or under development.
* If a feature is only designed in database schema, say it is designed but not fully implemented.

## Suggested Thesis Structure

```text
Lời cảm ơn
Tóm tắt
Abstract
Mục lục
Danh mục hình
Danh mục bảng

Chương 1: Tổng quan đề tài
- Đặt vấn đề
- Mục tiêu đề tài
- Đối tượng và phạm vi
- Phương pháp nghiên cứu
- Nội dung nghiên cứu
- Bố cục luận văn

Chương 2: Cơ sở lý thuyết và công nghệ
- Hệ thống gợi ý
- Collaborative Filtering
- Content-based Filtering
- Hybrid Recommendation
- Cold Start
- Implicit Feedback
- Stem Separation
- LLM / AI Playlist
- Vue.js
- Node.js / Express
- FastAPI
- MySQL
- Redis
- Socket.IO

Chương 3: Phân tích và thiết kế hệ thống
- Yêu cầu chức năng
- Yêu cầu phi chức năng
- Kiến trúc hệ thống
- Thiết kế cơ sở dữ liệu
- Thiết kế API
- Thiết kế giao diện
- Luồng xử lý chính

Chương 4: Cài đặt và kiểm thử
- Môi trường cài đặt
- Cài đặt frontend
- Cài đặt backend
- Cài đặt AI service
- Cài đặt các chức năng chính
- Kiểm thử chức năng
- Kết quả đạt được
- Hạn chế

Chương 5: Kết luận và hướng phát triển
- Kết quả đạt được
- Hạn chế
- Hướng phát triển
```

## Terminology

Use consistently:

```text
Hệ thống gợi ý = Recommendation System
Lọc cộng tác = Collaborative Filtering
Lọc theo nội dung = Content-based Filtering
Phương pháp kết hợp = Hybrid Approach
Danh sách phát = Playlist
Danh sách phát tự động = Automatic Playlist
Tạo playlist bằng AI = AI Playlist Generator
Tách nguồn âm thanh = Stem Separation
Lịch sử nghe nhạc = Listening History
Điểm phản hồi ngầm = Implicit Rating
Khởi động lạnh = Cold Start
Người dùng = User
Quản trị viên = Admin
Giao diện người dùng = Frontend
Máy chủ API = Backend API
Dịch vụ AI = AI Service
Bộ nhớ đệm = Cache
Cập nhật thời gian thực = Realtime update
```

## Feature Description Template

Use this structure when describing a feature:

```text
Tên chức năng:
Mục tiêu:
Đối tượng sử dụng:
Dữ liệu đầu vào:
Quy trình xử lý:
Dữ liệu đầu ra:
Công nghệ sử dụng:
Ý nghĩa đối với đề tài:
Trạng thái hiện thực:
```

Example status wording:

```text
Trạng thái hiện thực: Chức năng đã được xây dựng ở mức giao diện và API cơ bản, tuy nhiên phần xử lý AI nâng cao vẫn đang được hoàn thiện.
```

## Algorithm Explanation Template

Use this structure for recommendation, similarity, playlist generation, or ML sections:

```text
Bài toán:
Dữ liệu đầu vào:
Tiền xử lý:
Thuật toán:
Cách tính điểm:
Kết quả đầu ra:
Cách đánh giá:
Hạn chế:
```

## Architecture Explanation Template

Use this structure:

```text
Thành phần:
Vai trò:
Công nghệ sử dụng:
Dữ liệu xử lý:
Giao tiếp với thành phần khác:
Lý do lựa chọn:
```

## Database Table Description Template

Use this structure:

```text
Tên bảng:
Mục đích:
Các trường chính:
Khóa chính:
Khóa ngoại:
Quan hệ với bảng khác:
Ghi chú:
```

## API Documentation Template

Use this structure:

```text
Tên API:
Endpoint:
Phương thức:
Mục đích:
Yêu cầu xác thực:
Tham số đầu vào:
Dữ liệu trả về:
Luồng xử lý:
Lỗi có thể xảy ra:
```

## Testing Documentation Template

Use this structure:

```text
Mã test:
Tên test case:
Mục tiêu:
Tiền điều kiện:
Các bước thực hiện:
Kết quả mong đợi:
Kết quả thực tế:
Trạng thái:
Ghi chú:
```

Test case status values:

```text
Đạt
Không đạt
Chưa kiểm thử
Đang xử lý
```

## Functional Requirement Table Template

```text
STT | Tên chức năng | Mô tả | Người dùng | Mức độ ưu tiên | Trạng thái
```

Suggested priority values:

```text
Cao
Trung bình
Thấp
```

## Non-Functional Requirements

Mention when relevant:

* Hiệu năng
* Bảo mật
* Khả năng mở rộng
* Tính dễ sử dụng
* Tính tương thích
* Khả năng bảo trì
* Tính toàn vẹn dữ liệu
* Khả năng phục hồi khi lỗi
* Trải nghiệm thời gian thực

## Chapter 2 Rules

Chapter 2 should focus on theory and technologies.

Good topics:

* Recommendation System
* Collaborative Filtering
* Content-based Filtering
* Hybrid Approach
* Cold Start Problem
* Implicit Feedback
* Audio Source Separation
* LLM for natural-language playlist generation
* Vue.js
* Node.js
* Express.js
* FastAPI
* MySQL
* Redis
* Socket.IO

Rules:

* Keep Chapter 2 theoretical.
* Do not overfocus on implementation file names.
* Cite or explain technology concepts clearly.
* Do not claim implementation status in Chapter 2.

## Chapter 3 Rules

Chapter 3 should describe analysis and design.

Include:

* Actors
* Functional requirements
* Non-functional requirements
* Use cases
* System architecture
* Database design
* Main workflows
* API design
* UI design orientation

Rules:

* Use diagrams/tables where useful.
* Explain why the architecture has frontend, backend, and AI service.
* Mention MySQL as persistent storage.
* Mention Redis for cache/realtime support if used.
* Mention Socket.IO for realtime features.

## Chapter 4 Rules

Chapter 4 should describe actual implementation.

Rules:

* Use actual project structure.
* Use actual technologies.
* Use actual provider names.
* Be honest about incomplete features.
* Include screenshots or references if available.
* Include test cases and results.
* Separate implemented features from planned improvements.

## Chapter 5 Rules

Chapter 5 should summarize:

* What has been achieved.
* What remains limited.
* What can be improved.
* Future development directions.

Good future directions:

* Improve ML recommendation model.
* Add stronger evaluation metrics.
* Optimize audio streaming.
* Improve real-time payment flow.
* Improve AI Playlist quality.
* Add stronger personalization.
* Improve mobile responsiveness.
* Deploy with Docker/cloud.

## README Documentation Rules

For README, include:

```text
Giới thiệu dự án
Cấu trúc thư mục
Công nghệ sử dụng
Yêu cầu môi trường
Cách chạy backend
Cách chạy frontend
Cách chạy ai-service
Cấu hình .env
Database setup
Ghi chú runtime uploads
Các tính năng chính
```

Do not include:

* API keys
* Passwords
* Private tokens
* `.env` content with real secrets
* Unverified claims

## Defense Slide Rules

For slide content:

* Use short bullets.
* Focus on problem, solution, architecture, demo, and result.
* Avoid long paragraphs.
* Use screenshots and diagrams where useful.
* Highlight thesis-critical parts:

  * Recommendation
  * Auto playlist
  * Behavior tracking
  * AI Playlist
  * System architecture
  * Admin management

Suggested slide flow:

```text
1. Tên đề tài
2. Lý do chọn đề tài
3. Mục tiêu đề tài
4. Phạm vi chức năng
5. Kiến trúc hệ thống
6. Cơ sở dữ liệu
7. Chức năng nổi bật
8. Hệ thống gợi ý và playlist tự động
9. Giao diện demo
10. Kiểm thử
11. Kết quả đạt được
12. Hạn chế và hướng phát triển
```

## Honesty Rules for Thesis-Critical Features

### Recommendation

If recommendation uses real behavior and algorithm:

```text
Có thể mô tả là hệ thống gợi ý cá nhân hóa dựa trên hành vi người dùng.
```

If recommendation is still simple SQL:

```text
Mô tả là phiên bản gợi ý ban đầu dựa trên thể loại/lịch sử nghe, chưa phải mô hình học máy hoàn chỉnh.
```

### AI Playlist

If Claude/Gemini is integrated:

```text
Có thể mô tả là chức năng phân tích yêu cầu ngôn ngữ tự nhiên để tạo playlist từ dữ liệu bài hát trong hệ thống.
```

If only UI/mock exists:

```text
Mô tả là giao diện chức năng đã được xây dựng, phần tích hợp LLM đang được phát triển.
```

### Stem Separation

If actual Demucs/Spleeter runs:

```text
Mô tả là chức năng xử lý tách nguồn âm thanh bất đồng bộ.
```

If only UI/route stub exists:

```text
Mô tả là chức năng được thiết kế và đang trong quá trình tích hợp mô hình xử lý âm thanh.
```

### Payment

If real SePay/VietQR is integrated:

```text
Mô tả theo đúng provider và luồng callback thực tế.
```

If only QR placeholder:

```text
Mô tả là giao diện thanh toán đã được xây dựng, phần xác nhận giao dịch tự động đang được hoàn thiện.
```

## Do

* Write formally.
* Use accurate technical terms.
* Use tables for requirements and test cases.
* Tie features to thesis objectives.
* Explain why recommendation and auto playlist are central.
* Mention limitations honestly.
* Separate theory from implementation.
* Keep content suitable for university thesis.
* Use current project structure.
* Use actual implementation status.

## Don't

* Do not exaggerate unfinished features.
* Do not describe mock UI as completed system.
* Do not claim ML model exists if not implemented.
* Do not claim payment is complete if webhook is not working.
* Do not claim stem separation is complete if route/service is stub.
* Do not mix old architecture with new `apps/` structure unless discussing history.
* Do not write like advertisement copy.
* Do not include secrets, API keys, or passwords.

## Output Format

For thesis/report writing:

```text
Phần viết:
...

Ghi chú độ chính xác:
- Đã hoàn thành:
- Đang phát triển:
- Cần kiểm chứng:
- Hạn chế:
```

For test cases:

```text
Bảng test case:
...

Ghi chú:
- ...
```

For README/docs:

```text
Documentation summary:
- ...

Sections added/updated:
- ...

Accuracy notes:
- ...
```

## Reminder

The goal is to make MusicFlow documentation academically credible. It is better to describe a feature honestly as “đang phát triển” than to overclaim and create inconsistency between the thesis, the demo, and the actual code.
