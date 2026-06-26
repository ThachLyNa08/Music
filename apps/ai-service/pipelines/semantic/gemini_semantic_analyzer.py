import os
import json
from .rule_based_semantic_analyzer import analyze_rule_based
from .semantic_validator import validate_semantic_profile
from .semantic_taxonomy import MAIN_THEMES, MOOD_TAGS, SITUATION_TAGS

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

SYSTEM_PROMPT = """Bạn là chuyên gia phân tích âm nhạc cho hệ thống gợi ý bài hát.
Nhiệm vụ của bạn là phân tích ý nghĩa, chủ đề, cảm xúc và hoàn cảnh nghe phù hợp của một bài hát dựa trên title, artist, genre, market, audio features và lyrics nếu có.
Không bịa thông tin về hoàn cảnh sáng tác nếu input không cung cấp.
Không trích nguyên văn lời bài hát dài.
Không nhắc rằng bạn là AI.
Trả về JSON hợp lệ theo schema, không thêm markdown.
"""

def analyze_gemini(song_data, llm_delay=3, llm_max_retries=3):
    api_key = os.environ.get('GEMINI_API_KEY')
    model_name = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    
    rule_based_fallback = analyze_rule_based(song_data)
    rule_based_fallback['source'] = 'rule_based'
    
    # Initialize default status
    rule_based_fallback['llm_status'] = 'unavailable'
    rule_based_fallback['llm_error_type'] = 'unknown'
    rule_based_fallback['llm_error_message'] = ''
    rule_based_fallback['needs_llm_retry'] = True

    if not api_key:
        try:
            import google.generativeai
        except ImportError:
            pass
        rule_based_fallback['llm_error_type'] = 'missing_api_key'
        rule_based_fallback['llm_error_message'] = 'GEMINI_API_KEY is not set'
        rule_based_fallback['needs_llm_retry'] = False
        return rule_based_fallback
        
    if not genai:
        rule_based_fallback['llm_error_type'] = 'missing_package'
        rule_based_fallback['llm_error_message'] = 'google-genai package not found'
        rule_based_fallback['needs_llm_retry'] = False
        return rule_based_fallback
        
    prompt = f"""
    Title: {song_data.get('title')}
    Artist: {song_data.get('artist_name')}
    Album: {song_data.get('album_name')}
    Market: {song_data.get('market')}
    Genre: {song_data.get('genre_name')}
    
    Lyrics:
    {song_data.get('lyrics')[:4000] if song_data.get('lyrics') else 'Not available'}
    """
    
    # SYSTEM_PROMPT generation
    SYSTEM_PROMPT = f"""
    You are an expert music curator and AI semantic analyst.
    Your task is to analyze the provided song's metadata and lyrics to generate a semantic profile in valid JSON format.
    
    Constraints:
    - Respond ONLY with a valid JSON object. Do not include markdown formatting or explanations.
    - Choose exactly 1 `main_theme` from: {MAIN_THEMES}
    - Choose 2-3 `mood_tags` from: {MOOD_TAGS}
    - Choose 2-3 `situation_tags` from: {SITUATION_TAGS}
    - `emotion_intensity` must be an integer from 1 to 5.
    - `summary_vi` must be a short description in Vietnamese (max 2 sentences).
    
    JSON Schema:
    {{
      "summary_vi": "...",
      "main_theme": "...",
      "sub_themes": ["..."],
      "mood_tags": ["..."],
      "situation_tags": ["..."],
      "lyrical_keywords": ["..."],
      "emotion_intensity": 4,
      "meaning_confidence": 0.8,
      "semantic_text": "..."
    }}
    """
    
    try:
        client = genai.Client(api_key=api_key)
        
        # Dynamic delays: e.g. delay, delay+2, delay*2, delay*4
        delays = []
        base = llm_delay
        for i in range(llm_max_retries):
            if i == 0:
                delays.append(base)
            elif i == 1:
                delays.append(base + 2)
            else:
                delays.append(base * (2**(i-1)))
                
        for attempt in range(llm_max_retries):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[SYSTEM_PROMPT, prompt],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    )
                )
                
                result_json = response.text
                validated_profile = validate_semantic_profile(
                    result_json, 
                    rule_based_fallback, 
                    song_data.get('title', ''),
                    has_lyrics=bool(song_data.get('lyrics'))
                )
                
                # Check if validator actually fell back to rule-based because of JSON parse error
                if validated_profile.get('source') == 'rule_based':
                    validated_profile['llm_status'] = 'invalid_json'
                    validated_profile['llm_error_type'] = 'parse_error'
                    validated_profile['llm_error_message'] = 'Could not parse LLM output'
                    validated_profile['needs_llm_retry'] = True
                    return validated_profile
                
                validated_profile['evidence_level'] = "lyrics_based" if song_data.get('lyrics') else "metadata_only"
                validated_profile['llm_status'] = 'success'
                validated_profile['llm_error_type'] = ''
                validated_profile['llm_error_message'] = ''
                validated_profile['needs_llm_retry'] = False
                
                return validated_profile
            except Exception as inner_e:
                error_str = str(inner_e)
                # Check for temporary errors
                if any(err in error_str for err in ["429", "500", "502", "503", "504", "UNAVAILABLE", "quota", "overloaded"]):
                    if attempt < llm_max_retries - 1:
                        print(f"[WARN] Gemini temporary error for song_id={song_data.get('song_id')}. Retry {attempt+1}/{llm_max_retries} in {delays[attempt]}s.")
                        import time
                        time.sleep(delays[attempt])
                        continue
                
                # If we exhausted retries or hit a non-retryable error
                print(f"[WARN] Gemini failed after retries for song_id={song_data.get('song_id')}. Falling back to rule-based.")
                rule_based_fallback['llm_status'] = 'unavailable' if any(err in error_str for err in ["429", "500", "502", "503", "504", "UNAVAILABLE"]) else 'fallback'
                rule_based_fallback['llm_error_type'] = 'api_error'
                rule_based_fallback['llm_error_message'] = error_str[:150]
                rule_based_fallback['needs_llm_retry'] = True
                return rule_based_fallback
                
    except Exception as e:
        print(f"[WARN] Gemini client error for song_id={song_data.get('song_id')}. Falling back to rule-based.")
        rule_based_fallback['llm_status'] = 'fallback'
        rule_based_fallback['llm_error_type'] = 'client_error'
        rule_based_fallback['llm_error_message'] = str(e)[:150]
        rule_based_fallback['needs_llm_retry'] = True
        return rule_based_fallback
