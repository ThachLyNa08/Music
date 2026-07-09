> [!WARNING]
> **LEGACY V2:** Tài liệu này thuộc hướng Semantic V2 cũ. Trong phiên bản hiện tại (V3), thành phần Semantic Profile đóng vai trò là một lớp dữ liệu metadata phụ trợ. Hãy tham khảo `01_CURRENT_RECOMMENDATION_SYSTEM.md` để biết hệ thống BPR-MF mới nhất.

# Song Semantic Profile Evaluation Report

## Overview
- Total Profiles Evaluated: 7661
- Average Confidence: 0.65
- Other Theme Rate: 0.00
- Life Reflection Rate: 0.02
- Generic Summary Rate: 0.01

## Data Quality Checks
- Missing Summary: 0
- Empty Moods: 0
- Empty Situations: 0
- Low Confidence Profiles (< 0.5): 112

## Theme Distribution
```json
{
  "healing": 3208,
  "love": 2466,
  "heartbreak": 717,
  "self_confidence": 431,
  "party": 346,
  "life_reflection": 161,
  "friendship": 148,
  "nostalgia": 138,
  "conflict": 46
}
```

## Source Distribution
```json
{
  "rule_based": 7661
}
```
