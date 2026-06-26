import os
import sys
from pathlib import Path

AI_SERVICE_ROOT = Path(__file__).resolve().parents[2]

if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

import argparse
import pandas as pd
import json
def main():
    parser = argparse.ArgumentParser(description="Evaluate Song Semantic Profiles")
    parser.add_argument('--input', type=str, required=True, help="Path to input CSV")
    
    args = parser.parse_args()
    
    print(f"Evaluating {args.input}...")
    
    if not os.path.exists(args.input):
        print(f"Error: {args.input} does not exist.")
        sys.exit(1)
        
    df = pd.read_csv(args.input)
    
    total_profiles = len(df)
    
    # Process list columns
    list_cols = ['sub_themes', 'mood_tags', 'situation_tags']
    for c in list_cols:
        df[c] = df[c].fillna("").apply(lambda x: [i.strip() for i in x.split(';') if i.strip()])
    
    theme_distribution = df['main_theme'].value_counts().to_dict()
    evidence_level_distribution = df['evidence_level'].value_counts().to_dict()
    review_status_distribution = df['review_status'].value_counts().to_dict()
    
    # Flatten moods and situations
    all_moods = [item for sublist in df['mood_tags'] for item in sublist]
    mood_distribution = pd.Series(all_moods).value_counts().to_dict()
    
    all_situations = [item for sublist in df['situation_tags'] for item in sublist]
    situation_distribution = pd.Series(all_situations).value_counts().to_dict()
    
    average_confidence = float(df['meaning_confidence'].mean())
    missing_summary_count = int(df['summary_vi'].isna().sum())
    empty_mood_count = int((df['mood_tags'].apply(len) == 0).sum())
    empty_situation_count = int((df['situation_tags'].apply(len) == 0).sum())
    
    other_theme_count = theme_distribution.get("other", 0)
    other_theme_rate = other_theme_count / total_profiles if total_profiles > 0 else 0
    
    source_distribution = df['source'].value_counts().to_dict() if 'source' in df.columns else {}
    generated_by_distribution = df['generated_by'].value_counts().to_dict() if 'generated_by' in df.columns else {}
    
    high_confidence_count = int((df['meaning_confidence'] >= 0.8).sum()) if 'meaning_confidence' in df.columns else 0
    low_confidence_count = int((df['meaning_confidence'] < 0.5).sum()) if 'meaning_confidence' in df.columns else 0
    metadata_only_count = evidence_level_distribution.get("metadata_only", 0)
    lyrics_based_count = evidence_level_distribution.get("lyrics_based", 0)
    theme_changed_count = int(df['theme_changed'].sum()) if 'theme_changed' in df.columns else 0
    
    life_reflection_count = theme_distribution.get("life_reflection", 0)
    life_reflection_rate = life_reflection_count / total_profiles if total_profiles > 0 else 0
    
    summary_vi_counts = df['summary_vi'].value_counts() if 'summary_vi' in df.columns else {}
    repeated_summary_top = summary_vi_counts.head(3).to_dict() if len(summary_vi_counts) > 0 else {}
    generic_summary_count = sum(count for summary, count in summary_vi_counts.items() if count >= 5) if len(summary_vi_counts) > 0 else 0
    generic_summary_rate = generic_summary_count / total_profiles if total_profiles > 0 else 0
    
    llm_success_rate = 0.0
    rule_based_fallback_rate = 0.0
    
    if total_profiles > 0:
        llm_count = source_distribution.get('llm', 0)
        llm_success_rate = llm_count / total_profiles
        rule_based_fallback_rate = 1.0 - llm_success_rate
    
    summary = {
        "total_profiles": total_profiles,
        "theme_distribution": theme_distribution,
        "mood_distribution": mood_distribution,
        "situation_distribution": situation_distribution,
        "average_confidence": round(average_confidence, 2),
        "evidence_level_distribution": evidence_level_distribution,
        "review_status_distribution": review_status_distribution,
        "source_distribution": source_distribution,
        "generated_by_distribution": generated_by_distribution,
        "llm_success_rate": round(llm_success_rate, 2),
        "rule_based_fallback_rate": round(rule_based_fallback_rate, 2),
        "missing_summary_count": missing_summary_count,
        "empty_mood_count": empty_mood_count,
        "empty_situation_count": empty_situation_count,
        "other_theme_rate": round(other_theme_rate, 2),
        "high_confidence_count": high_confidence_count,
        "low_confidence_count": low_confidence_count,
        "life_reflection_rate": round(life_reflection_rate, 2),
        "generic_summary_rate": round(generic_summary_rate, 2),
        "metadata_only_count": metadata_only_count,
        "lyrics_based_count": lyrics_based_count,
        "theme_changed_count": theme_changed_count
    }
    
    # Export JSON
    normalized_input = args.input.replace('\\', '/')
    if "semantic/previews" in normalized_input:
        json_out_path = os.path.abspath(os.path.join(os.path.dirname(args.input), '../reports/song_semantic_profiles_python_summary.json'))
    else:
        json_out_path = os.path.join(os.path.dirname(args.input), "song_semantic_profiles_python_summary.json")
        
    os.makedirs(os.path.dirname(json_out_path), exist_ok=True)
    with open(json_out_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        
    print(f"Exported JSON summary to {json_out_path}")
    
    # Export Markdown Report
    report_out_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../docs/recommendation/song_semantic_profile_report.md'))
    os.makedirs(os.path.dirname(report_out_path), exist_ok=True)
    
    md = f"""# Song Semantic Profile Evaluation Report

## Overview
- Total Profiles Evaluated: {total_profiles}
- Average Confidence: {average_confidence:.2f}
- Other Theme Rate: {other_theme_rate:.2f}
- Life Reflection Rate: {life_reflection_rate:.2f}
- Generic Summary Rate: {generic_summary_rate:.2f}

## Data Quality Checks
- Missing Summary: {missing_summary_count}
- Empty Moods: {empty_mood_count}
- Empty Situations: {empty_situation_count}
- Low Confidence Profiles (< 0.5): {low_confidence_count}

## Theme Distribution
```json
{json.dumps(theme_distribution, indent=2)}
```

## Source Distribution
```json
{json.dumps(source_distribution, indent=2)}
```
"""
    with open(report_out_path, 'w', encoding='utf-8') as f:
        f.write(md)
        
    print(f"Exported Markdown report to {report_out_path}")
    
    # Check passing criteria
    print("\n--- Criteria Check ---")
    print(f"empty_mood_count = {empty_mood_count} (Expected 0)")
    print(f"empty_situation_count = {empty_situation_count} (Expected 0)")
    print(f"other_theme_rate = {other_theme_rate:.2f} (Expected < 0.30)")
    print(f"average_confidence = {average_confidence:.2f} (Expected 0.50 - 0.75)")
    print(f"life_reflection_rate = {life_reflection_rate:.2f} (Expected <= 0.25)")
    print(f"generic_summary_rate = {generic_summary_rate:.2f} (Expected low)")
    
    if generic_summary_count > 0:
        print("\n[QUALITY WARNING] repeated summary template detected")
        print("Top repeated summaries:")
        for s, c in repeated_summary_top.items():
            print(f"  {c} times: {s[:60]}...")
            
    if life_reflection_rate > 0.30:
        print("\n[QUALITY WARNING] life_reflection_rate too high, analyzer may be overusing fallback theme")
        
    if low_confidence_count > 0:
        print(f"\n[QUALITY WARNING] {low_confidence_count} profiles have very low confidence (<0.50)")
    
    print("\n--- source_distribution ---")
    for src, count in source_distribution.items():
        print(f"  {src}: {count}")
    
    if source_distribution.get('llm', 0) > 0 or (total_profiles > 0 and source_distribution.get('rule_based', 0) < total_profiles):
        print(f"\nllm_success_rate: {llm_success_rate:.2f}")
        print(f"rule_based_fallback_rate: {rule_based_fallback_rate:.2f}")
    
    if other_theme_count > 0:
        print("\n--- Rows with main_theme = other ---")
        other_df = df[df['main_theme'] == 'other']
        for idx, row in other_df.head(20).iterrows():
            moods = row.get('mood_tags', [])
            situations = row.get('situation_tags', [])
            summary_text = str(row.get('summary_vi', ''))
            print(f"ID: {row.get('song_id')} | {row.get('title')} | {row.get('artist')} | Moods: {moods} | Situations: {situations} | Summary: {summary_text[:100]}...")

if __name__ == "__main__":
    main()
