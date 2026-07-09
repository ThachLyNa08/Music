> [!WARNING]
> **LEGACY V2:** Đây là báo cáo đánh giá của hướng Semantic V2, không phải báo cáo đánh giá cuối cùng của hệ thống gợi ý hiện tại. Nội dung được giữ lại để tham khảo quá trình phát triển. Vui lòng xem `final_recommendation_v3_evaluation_report.md` để lấy số liệu V3.

# Báo cáo đánh giá hệ thống gợi ý (Tích hợp Semantic Profiles V2)

**Lần chạy:** `final_semantic_v2`
**Trạng thái:** Chờ chạy thực tế

## So sánh với lần đánh giá trước semantic
- Lần đánh giá trước dùng Most Popular, Content-Based Audio, BPR-MF và Hybrid.
- Lần đánh giá V2 bổ sung semantic profile vào Content-Based và Hybrid (Content-Based + Semantic, Hybrid + Semantic).
- Chỉ so sánh trực tiếp nếu giữ cùng tập user, cùng split, cùng seed và cùng Top-K.
- *Lưu ý: Nếu setup có thay đổi, số liệu so sánh dưới đây mang tính tham khảo, không kết luận tuyệt đối.*

## 1. Kết quả Smoke Test (10 Users)
- Lệnh: `node scripts/recommendation/evaluateRecommendationAlgorithms.js --include-semantic --final --output-suffix=smoke_semantic_v2 --sample-users=10`
- **Kết quả:** (Chờ user cập nhật)

## 2. Kết quả Full Evaluation
- Lệnh: `node scripts/recommendation/evaluateRecommendationAlgorithms.js --include-semantic --final --output-suffix=final_semantic_v2`
- **Kết quả:** (Chờ user cập nhật)

## 3. Metrics V2 Cuối cùng (Top 10)
| Metric | Most Popular | Content-Based + Semantic | BPR-MF | Hybrid + Semantic |
|---|---|---|---|---|
| Precision@10 | TBD | TBD | TBD | TBD |
| NDCG@10 | TBD | TBD | TBD | TBD |
| HitRate@10 | TBD | TBD | TBD | TBD |

## 4. Các chỉ số Semantic (Top 20)
| Metric | Content-Based + Semantic | Hybrid + Semantic |
|---|---|---|
| Tỷ lệ nhạc có gắn tag semantic | TBD | TBD |
| Contextual Mood Match | TBD | TBD |
| Lấy từ Lyrics | TBD | TBD |

## 5. Kết luận & Đề xuất
- **BPR-MF:** (Cập nhật sau khi có số)
- **Hybrid + Semantic:** (Cập nhật sau khi có số)
