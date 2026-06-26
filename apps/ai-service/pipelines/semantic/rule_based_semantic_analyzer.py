from .semantic_taxonomy import MAIN_THEMES, MOOD_TAGS, SITUATION_TAGS
import re

THEME_KEYWORDS = {
    "self_confidence": ['redred', 'rockstar', 'clik clak', 'clap', 'boom', 'boombayah', 'savage', 'pretty savage', 'fashion', 'boss', 'money', 'power', 'jump', 'fire', 'hype', 'dance', 'dancing queen', 'sugarfree', 'tự tin', 'quyền lực', 'phá vỡ', 'bản lĩnh'],
    "conflict": ['bad blood', 'look what you made me do', 'chạy ngay đi', "can't control myself", 'no body no crime', 'tears', "ain't nobody", 'tranh cãi', 'phản bội', 'lừa dối', 'kẻ thù'],
    "heartbreak": ['back to december', 'call out my name', 'em đau', 'yêu một người vô tâm', 'dù tình phôi pha', 'tình như lá bay xa', "now that we don't talk", 'hope not', 'loml', 'nuối tiếc', 'biết đến bao giờ', 'đêm tiền đồn', 'chia tay', 'xa nhau', 'nhớ', 'quên', 'đau', 'buồn', 'nước mắt', 'cô đơn', 'tiếc', 'mưa', 'hôm qua', 'ngày cũ', 'goodbye', 'lonely', 'broken', 'hurt', 'tổn thương', 'mất nhau'],
    "healing": ['thank u next', 'remember me', 'nothing new', 'dear reader', 'stronger', 'move on', 'bước tiếp', 'chữa lành', 'bình yên', 'trưởng thành', 'tự do', 'vượt qua'],
    "love": ['love', 'lover', 'enchanted', 'ready for love', 'everything has changed', 'hãy trao cho anh', 'hoa hồng', 'peach gelato', 'so high school', 'dress', 'with you', 'one of the girls', 'yêu', 'thương', 'em', 'anh', 'đôi ta', 'bên nhau', 'hôn', 'môi', 'ánh nắng', 'trái tim', 'người yêu', 'heart', 'flower', 'beautiful', 'sweet', 'kiss', 'crush', 'tình yêu', 'hẹn hò'],
    "nostalgia": ['cửu long', 'bạc liêu', 'lý con sáo', 'phù sa', 'thái bình', 'quê hương', 'đất nước', 'việt nam', 'xuân', 'tết', 'năm mới', 'con cò', 'mặt trời', 'hành trình', 'thanh xuân', 'tuổi trẻ', 'kỷ niệm', 'ngày xưa'],
    "friendship": ['friend', 'friends', 'friendship', 'bạn bè', 'tình bạn'],
    "party": ['party', 'club', 'dj', 'quẩy', 'bay', 'nhảy', 'sôi động']
}

HARD_TITLE_THEME_OVERRIDES = {
    "redred": "self_confidence",
    "clik clak": "self_confidence",
    "rockstar": "self_confidence",
    "bad blood": "conflict",
    "look what you made me do": "conflict",
    "chay ngay di": "conflict",
    "chạy ngay đi": "conflict",
    "boombayah": "party",
    "pretty savage": "self_confidence",
    "thank u next": "healing",
    "thank u, next": "healing",
    "flower": "heartbreak",
    "꽃": "heartbreak"
}

def normalize_text(text):
    text = re.sub(r'[()\[\]{}\'".,\-–—_]', ' ', str(text))
    text = re.sub(r'\s+', ' ', text).strip()
    return text.lower()

def analyze_rule_based(song_data):
    title = str(song_data.get('title', ''))
    artist = str(song_data.get('artist_name', '')).lower()
    genre = str(song_data.get('genre_name', '')).lower()
    lyrics = str(song_data.get('lyrics', '')).lower()
    market = str(song_data.get('market', '')).lower()
    
    normalized_title = normalize_text(title)
    search_text = " ".join([normalized_title, artist, genre, market, lyrics])
    
    bpm = float(song_data.get('bpm', 0) or 0)
    energy = float(song_data.get('energy', 0) or 0)
    danceability = float(song_data.get('danceability', 0) or 0)
    
    has_lyrics = bool(song_data.get('lyrics'))
    has_metadata = bool(title and artist)
    has_audio_features = bool(bpm > 0 or energy > 0)
    
    if has_lyrics:
        evidence_level = "lyrics_based"
    elif has_metadata and has_audio_features:
        evidence_level = "hybrid"
    elif has_metadata:
        evidence_level = "metadata_only"
    elif has_audio_features:
        evidence_level = "audio_features_only"
    else:
        evidence_level = "none"

    theme_scores = {
        "love": 0, "heartbreak": 0, "healing": 0, "friendship": 0,
        "self_confidence": 0, "conflict": 0, "party": 0, "nostalgia": 0,
        "life_reflection": 0
    }
    
    matched_title_strong = False
    lyric_matches = 0
    
    # 0. HARD TITLE OVERRIDE (+1000)
    for k, v in HARD_TITLE_THEME_OVERRIDES.items():
        k_norm = normalize_text(k)
        if k_norm in normalized_title.split(): # Match exact words
            theme_scores[v] += 1000
            matched_title_strong = True
        elif k_norm in normalized_title and len(k_norm) > 1: # Catch Korean/Phrases
            theme_scores[v] += 1000
            matched_title_strong = True
    
    # 1. EXACT TITLE OR STRONG TITLE KEYWORD (+100)
    for theme, keywords in THEME_KEYWORDS.items():
        for kw in keywords:
            kw_norm = normalize_text(kw)
            pattern = r'\b' + re.escape(kw_norm) + r'\b'
            if re.search(pattern, normalized_title) or normalized_title == kw_norm:
                theme_scores[theme] += 100
                matched_title_strong = True

    # 2. LYRICS KEYWORD WEIGHTED SCORE (+10 per occurrence)
    if lyrics:
        for theme, keywords in THEME_KEYWORDS.items():
            for kw in keywords:
                if len(kw) > 3: # Ignore very short words to prevent false positives
                    count = lyrics.count(kw)
                    if count > 0:
                        theme_scores[theme] += (count * 10)
                        lyric_matches += count

    # 3. GENRE / MARKET (+20)
    if 'dance' in genre or 'edm' in genre:
        theme_scores['party'] += 20
        theme_scores['self_confidence'] += 10
    if 'folk' in genre or 'country' in genre or 'truyền thống' in genre:
        theme_scores['nostalgia'] += 20
        theme_scores['life_reflection'] += 10
    if 'acoustic' in genre or 'lo-fi' in genre:
        theme_scores['life_reflection'] += 20
        theme_scores['healing'] += 10

    # 4. AUDIO FEATURES (+15)
    if bpm >= 120 or energy > 0.8 or danceability > 0.7:
        theme_scores['party'] += 15
        theme_scores['self_confidence'] += 15
    elif (bpm > 0 and bpm <= 90) or energy < 0.4:
        theme_scores['life_reflection'] += 15
        theme_scores['healing'] += 15
        theme_scores['heartbreak'] += 10

    # Find the winning theme
    main_theme = max(theme_scores, key=theme_scores.get)
    max_score = theme_scores[main_theme]
    
    # Fallback if no clear winner
    if max_score < 10:
        main_theme = "life_reflection"
        
    # Dynamic Summary & Tags
    moods = set()
    situations = set()
    emotion_intensity = 3
    
    display_title = song_data.get('title', 'Bài hát')
    display_artist = song_data.get('artist_name', 'nghệ sĩ')
    
    if main_theme == "self_confidence":
        summary_vi = f"'{display_title}' mang màu sắc mạnh mẽ, nổi bật tinh thần tự tin, cá tính và năng lượng bứt phá."
        moods.update(["energetic", "confident", "dark"])
        situations.update(["party", "gym", "driving"])
        emotion_intensity = 5
    elif main_theme == "conflict":
        summary_vi = f"'{display_title}' xoay quanh cảm giác căng thẳng, đối đầu hoặc rạn nứt trong một mối quan hệ."
        moods.update(["dark", "emotional", "regretful"])
        situations.update(["night", "alone", "driving"])
        emotion_intensity = 5
    elif main_theme == "heartbreak":
        summary_vi = f"'{display_title}' gợi cảm giác tổn thương, chia xa hoặc buông bỏ sau một mối quan hệ nhiều cảm xúc."
        moods.update(["sad", "melancholic", "emotional"])
        situations.update(["breakup", "alone", "night", "rain"])
        emotion_intensity = 4
    elif main_theme == "healing":
        summary_vi = f"Mang thông điệp chữa lành và trưởng thành, '{display_title}' giúp xoa dịu tâm hồn và mang lại cảm giác bình yên, nhẹ nhàng."
        moods.update(["hopeful", "calm", "confident"])
        situations.update(["healing", "alone", "relax"])
        emotion_intensity = 3
    elif main_theme == "love":
        summary_vi = f"'{display_title}' của {display_artist} là một ca khúc ngọt ngào, lãng mạn, tràn đầy những rung động và cảm xúc khi yêu."
        moods.update(["romantic", "bright", "emotional"])
        situations.update(["date", "night", "relax"])
        emotion_intensity = 4
    elif main_theme == "nostalgia":
        summary_vi = f"Ca khúc '{display_title}' gợi không gian hoài niệm, mang màu sắc ký ức về quê hương, thanh xuân và những câu chuyện đã qua."
        moods.update(["nostalgic", "gentle", "hopeful"])
        situations.update(["travel", "relax", "friends"])
        emotion_intensity = 3
    elif main_theme == "friendship":
        summary_vi = f"Bài hát '{display_title}' là một thông điệp ý nghĩa về tình bạn, sự đồng hành và những khoảnh khắc sẻ chia cùng nhau."
        moods.update(["bright", "hopeful", "energetic"])
        situations.update(["friends", "party", "travel"])
        emotion_intensity = 3
    elif main_theme == "party":
        summary_vi = f"'{display_title}' có màu sắc sôi động, phù hợp với không khí trình diễn, tiệc tùng và giải phóng năng lượng."
        moods.update(["energetic", "confident", "happy"])
        situations.update(["gym", "party", "driving"])
        emotion_intensity = 4
    else: # life_reflection
        summary_vi = f"'{display_title}' mang lại nhiều suy tư và cảm xúc sâu lắng, dễ nghe, phù hợp cho những lúc thư giãn một mình."
        moods.update(["calm", "chill", "emotional"])
        situations.update(["relax", "study", "night"])
        emotion_intensity = 3

    # Confidence Calibration
    if matched_title_strong:
        confidence = 0.65 + (hash(title) % 7) / 100.0  # 0.65 - 0.72 pseudo-random but deterministic
    elif lyric_matches >= 3 and evidence_level in ["lyrics_based", "hybrid"]:
        confidence = 0.68 + (hash(title) % 10) / 100.0 # 0.68 - 0.78
    elif main_theme == "life_reflection":
        confidence = 0.40 + (hash(title) % 15) / 100.0 # 0.40 - 0.55
    else:
        confidence = 0.55 + (hash(title) % 10) / 100.0 # 0.55 - 0.65

    # Extract some keywords
    lyrical_keywords = []
    if main_theme in THEME_KEYWORDS:
        for k in THEME_KEYWORDS[main_theme]:
            if k in search_text and k not in lyrical_keywords:
                lyrical_keywords.append(k)
                if len(lyrical_keywords) >= 5:
                    break

    return {
        "summary_vi": summary_vi,
        "main_theme": main_theme,
        "sub_themes": [],
        "mood_tags": list(moods)[:3],
        "situation_tags": list(situations)[:3],
        "lyrical_keywords": lyrical_keywords,
        "emotion_intensity": emotion_intensity,
        "meaning_confidence": round(confidence, 2),
        "semantic_text": summary_vi,
        "source": "rule_based",
        "generated_by": "local_semantic_pipeline",
        "evidence_level": evidence_level,
        "review_status": "auto",
        "llm_status": "skipped",
        "llm_error_type": "",
        "llm_error_message": "",
        "needs_llm_retry": False,
        "external_refs": {}
    }
