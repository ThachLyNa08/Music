import json
import re
from .semantic_taxonomy import MAIN_THEMES, MOOD_TAGS, SITUATION_TAGS

def clean_json_string(text):
    text = text.strip()
    if text.startswith('```json'):
        text = text[7:]
    if text.startswith('```'):
        text = text[3:]
    if text.endswith('```'):
        text = text[:-3]
    return text.strip()

def normalize_theme_from_summary_and_tags(profile, title=""):
    original_theme = profile.get("main_theme", "other")
    moods = set(profile.get("mood_tags", []))
    situations = set(profile.get("situation_tags", []))
    summary = str(profile.get("summary_vi", "")).lower()
    title_lower = str(title).lower()
    
    text_to_check = f"{summary} {title_lower}"
    new_theme = original_theme
    
    # Friendship / youth
    if any(kw in text_to_check for kw in ["bạn bè", "tình bạn", "tri ân", "đồng hành", "chia sẻ", "tuổi trẻ", "thanh xuân", "kỷ niệm", "friends", "friendship", "companion"]):
        if any(kw in text_to_check for kw in ["tuổi trẻ", "thanh xuân", "kỷ niệm", "nostalgia", "youth"]):
            new_theme = "youth" # mapped to youth if valid, else fallback to youth
        else:
            new_theme = "friendship"
    # Heartbreak / healing
    elif any(kw in text_to_check for kw in ["tổn thương", "buông bỏ", "chia tay", "rời đi", "đau khổ", "bước tiếp", "chữa lành", "kết thúc mối tình", "heartbreak", "breakup", "letting go", "move on"]):
        if any(kw in text_to_check for kw in ["hồi phục", "tự do", "trưởng thành", "bước tiếp", "chữa lành", "healing"]):
            new_theme = "healing"
        else:
            new_theme = "heartbreak"
    # Love / romance
    elif original_theme in ["love", "romance"]:
        if any(kw in text_to_check for kw in ["yêu thương", "rung động", "hẹn hò", "ngọt ngào", "lãng mạn", "tình yêu đẹp", "attraction", "romantic", "sweet"]):
            pass # Keep it
        elif any(kw in text_to_check for kw in ["chia tay", "buông bỏ", "tổn thương", "đau", "heartbreak"]):
            new_theme = "heartbreak"
    # Self-confidence / conflict
    elif any(kw in text_to_check for kw in ["tự tin", "nổi loạn", "phá vỡ", "thể hiện bản thân", "mạnh mẽ", "bản lĩnh", "red", "boss", "fire", "savage", "power", "clik"]):
        new_theme = "self_confidence"
    elif any(kw in text_to_check for kw in ["đối đầu", "xung đột", "trả đũa", "bad blood", "fight", "revenge", "toxic", "conflict"]):
        new_theme = "conflict"
        
    # fallback for empty or party
    if new_theme == original_theme and original_theme == "other":
        if "dance" in text_to_check or "party" in text_to_check or "sôi động" in text_to_check:
            new_theme = "party"
            
    # Map valid themes
    if new_theme == "youth":
        new_theme = "friendship" # map youth to friendship since youth is not in MAIN_THEMES but friendship is, or keep if added. We'll use friendship/nostalgia. Let's use friendship.
    
    if new_theme not in MAIN_THEMES:
        new_theme = "other"
        
    profile["theme_changed"] = (new_theme != original_theme)
    profile["main_theme"] = new_theme
        
    return profile

def infer_non_other_theme(profile, title=""):
    moods = set(profile.get("mood_tags", []))
    situations = set(profile.get("situation_tags", []))
    summary = str(profile.get("summary_vi", "")).lower()
    title_lower = str(title).lower()
    
    text_to_check = f"{summary} {title_lower}"
    new_theme = profile.get("main_theme", "other")
    
    # 1. Energetic / confident
    if any(m in moods for m in ["confident", "energetic", "dark"]) or \
       any(s in situations for s in ["gym", "party", "driving"]):
        new_theme = "self_confidence"
        if any(kw in text_to_check for kw in ["party", "dance", "beat", "clik", "clap", "red", "fire", "boss", "money", "savage", "power", "hype"]):
            if "party" in text_to_check or "dance" in text_to_check:
                new_theme = "party"
            else:
                new_theme = "self_confidence"
                
    # 2. Romantic / bright / gentle
    elif any(m in moods for m in ["romantic", "bright", "gentle", "hopeful"]) or \
         any(s in situations for s in ["date", "relax", "night"]):
        if any(kw in text_to_check for kw in ["love", "heart", "flower", "peach", "sweet", "beautiful", "ánh nắng", "hoa hồng", "yêu", "thương", "tình"]):
            new_theme = "love"
            
    # 3. Sad / emotional / melancholic
    elif any(m in moods for m in ["sad", "emotional", "melancholic", "regretful"]) or \
         any(s in situations for s in ["alone", "breakup", "night", "rain"]):
        if any(kw in text_to_check for kw in ["chia tay", "tổn thương", "buông bỏ", "rời đi", "đau khổ", "mất nhau", "kết thúc", "cô đơn", "nước mắt"]):
            new_theme = "heartbreak"
        elif any(kw in text_to_check for kw in ["chữa lành", "bước tiếp", "trưởng thành", "tự do", "vượt qua"]):
            new_theme = "healing"
        elif any(kw in text_to_check for kw in ["kỷ niệm", "ngày cũ", "hoài niệm", "nhớ về", "quá khứ"]):
            new_theme = "nostalgia"
            
    # 4. Friendship / youth
    elif any(kw in text_to_check for kw in ["bạn bè", "tình bạn", "đồng hành", "tri ân", "chia sẻ", "thanh xuân", "tuổi trẻ", "kỷ niệm", "friends", "friendship"]):
        if "thanh xuân" in text_to_check or "tuổi trẻ" in text_to_check or "kỷ niệm" in text_to_check:
            new_theme = "youth" 
        else:
            new_theme = "friendship"
            
    # 5. Fallback cuối cùng theo mood
    if new_theme == "other" or new_theme not in MAIN_THEMES:
        if any(m in moods for m in ["romantic", "bright", "gentle", "hopeful"]):
            new_theme = "love"
        elif any(m in moods for m in ["sad", "emotional", "melancholic", "regretful"]):
            new_theme = "life_reflection"
        elif any(m in moods for m in ["confident", "energetic", "dark"]):
            new_theme = "self_confidence"
        elif any(m in moods for m in ["calm", "chill", "dreamy"]):
            new_theme = "life_reflection"
            
    if new_theme in MAIN_THEMES and new_theme != "other":
        profile["main_theme"] = new_theme
        profile["theme_changed"] = True
        
    return profile

def trim_summary(text):
    text = str(text).strip()
    # Split by common sentence endings
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if len(sentences) > 2:
        text = " ".join(sentences[:2])
        
    if len(text) > 350:
        text = text[:347] + "..."
    return text

def validate_semantic_profile(profile, rule_based_fallback, title="", has_lyrics=False):
    """
    Validates and fixes fields in the semantic profile generated by LLM.
    Uses rule_based_fallback for missing essential fields.
    """
    try:
        if isinstance(profile, str):
            profile_str = clean_json_string(profile)
            data = json.loads(profile_str)
        else:
            data = profile
            
        validated = {}
        
        # summary_vi
        summary = str(data.get("summary_vi", rule_based_fallback.get("summary_vi", "")))
        validated["summary_vi"] = trim_summary(summary)
        
        # main_theme
        theme = str(data.get("main_theme", "other")).lower()
        if theme not in MAIN_THEMES:
            theme = "other"
        validated["main_theme"] = theme
        
        # sub_themes
        sub_themes = data.get("sub_themes", [])
        if not isinstance(sub_themes, list):
            sub_themes = []
        validated["sub_themes"] = [str(x) for x in sub_themes][:3]
        
        # mood_tags
        mood_tags = [str(x).lower() for x in data.get("mood_tags", []) if str(x).lower() in MOOD_TAGS]
        if len(mood_tags) < 2:
            mood_tags = rule_based_fallback.get("mood_tags", [])
        validated["mood_tags"] = mood_tags[:3]
        
        # situation_tags
        situation_tags = [str(x).lower() for x in data.get("situation_tags", []) if str(x).lower() in SITUATION_TAGS]
        if len(situation_tags) < 2:
            situation_tags = rule_based_fallback.get("situation_tags", [])
        validated["situation_tags"] = situation_tags[:3]
        
        # lyrical_keywords
        keywords = data.get("lyrical_keywords", [])
        if not isinstance(keywords, list):
            keywords = []
        validated["lyrical_keywords"] = [str(x) for x in keywords][:5]
        
        # emotion_intensity
        intensity = data.get("emotion_intensity", 3)
        try:
            intensity = int(intensity)
            intensity = max(1, min(5, intensity))
        except (ValueError, TypeError):
            intensity = 3
        validated["emotion_intensity"] = intensity
        
        # meaning_confidence
        confidence = data.get("meaning_confidence", 0.7)
        try:
            confidence = float(confidence)
        except (ValueError, TypeError):
            confidence = 0.7
            
        # Calibration
        if has_lyrics:
            confidence = max(0.78, min(0.90, confidence))
        else:
            confidence = max(0.55, min(0.72, confidence))
            
        validated["semantic_text"] = str(data.get("semantic_text", summary))[:500]
        validated["source"] = "llm"
        validated["generated_by"] = "gemini"
        validated["review_status"] = "auto"
        validated["external_refs"] = {}
        
        validated = normalize_theme_from_summary_and_tags(validated, title)
        
        if validated.get("main_theme") == "other":
            validated = infer_non_other_theme(validated, title)
            
        if validated.get("theme_changed"):
            confidence -= 0.08
        if validated.get("main_theme") == "other":
            confidence = min(confidence, 0.55)
            
        validated["meaning_confidence"] = round(max(0.0, min(1.0, confidence)), 2)
        
        return validated
    except Exception as e:
        # Fallback to rule-based completely
        return rule_based_fallback
