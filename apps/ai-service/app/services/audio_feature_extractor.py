import os
import numpy as np
import math

def extract_audio_features(file_path: str):
    """
    Extracts audio features from a given local file path using librosa.
    Soft handles errors to avoid crashing the service.
    """
    if not os.path.exists(file_path):
        return {"success": False, "message": f"File not found: {file_path}"}
        
    try:
        import librosa
    except ImportError:
        return {"success": False, "message": "librosa is not installed"}

    try:
        # Load audio with a standard sample rate, duration max 60s to speed up
        # We take a chunk from the middle if possible, but for simplicity we take first 60s
        # Using 30s offset and 60s duration usually captures the "meat" of the song
        try:
            duration = librosa.get_duration(path=file_path)
            if duration < 5:
                return {"success": False, "message": "Audio file is too short"}
                
            offset = min(30.0, max(0.0, duration / 3.0))
            y, sr = librosa.load(file_path, sr=22050, offset=offset, duration=60.0)
        except Exception as e:
            # Fallback to load from start
            y, sr = librosa.load(file_path, sr=22050, duration=60.0)
            
        if len(y) == 0:
            return {"success": False, "message": "Audio loaded but empty"}

        # 1. BPM / Tempo
        bpm = None
        tempo_level = "medium"
        try:
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            if isinstance(tempo, np.ndarray):
                bpm = float(tempo[0])
            else:
                bpm = float(tempo)
                
            if bpm is not None and bpm > 0:
                bpm = round(bpm, 1)
                if bpm < 85:
                    tempo_level = "slow"
                elif bpm <= 120:
                    tempo_level = "medium"
                else:
                    tempo_level = "fast"
            else:
                bpm = None
        except Exception as e:
            print(f"Error in beat_track: {e}")
            bpm = None
            tempo_level = "medium"

        # 2. RMS Energy
        try:
            rms = librosa.feature.rms(y=y)
            raw_energy = float(rms.mean())
            # Convert to dB-like scale for safer compression
            db_energy = 20 * math.log10(raw_energy + 1e-6)
            energy_score = round(max(0.0, min(1.0, (db_energy + 60) / 60)), 2)
        except Exception:
            raw_energy = 0.0
            energy_score = 0.50

        if energy_score < 0.40:
            energy = "low"
        elif energy_score < 0.72:
            energy = "medium"
        else:
            energy = "high"

        # 3. Brightness (Spectral Centroid)
        try:
            cent = librosa.feature.spectral_centroid(y=y, sr=sr)
            raw_bright = float(cent.mean())
            # typical values 1000 - 3000
            brightness = round(min(1.0, max(0.0, (raw_bright - 500) / 3500)), 2)
        except Exception:
            brightness = 0.50
            
        # 4. Danceability (Onset strength)
        try:
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            raw_dance = float(onset_env.mean())
            danceability = round(min(1.0, max(0.0, raw_dance / 2.0)), 2)
        except Exception:
            danceability = 0.50

        # 5. Acousticness (Zero Crossing Rate as proxy)
        try:
            zcr = librosa.feature.zero_crossing_rate(y)
            raw_zcr = float(zcr.mean())
            # lower brightness + lower energy + lower zero crossing -> higher acoustic
            norm_zcr = min(1.0, raw_zcr * 10)
            acoustic_score = round(max(0.0, min(1.0, 1.0 - (norm_zcr * 0.4 + energy_score * 0.4 + brightness * 0.2))), 2)
        except Exception:
            acoustic_score = 0.50

        # 6. Mood / Vibe rules
        mood = "chill"
        vibe = "chill"
        
        current_bpm = bpm if bpm is not None else 0

        if tempo_level == "slow":
            if brightness < 0.45:
                mood = "sad"
                vibe = "night,suy,heartbreak"
            elif acoustic_score >= 0.45:
                mood = "healing"
                vibe = "healing,soft,acoustic"
            else:
                mood = "chill"
                vibe = "night,chill,soft"
        elif tempo_level == "medium":
            if energy == "low":
                mood = "chill"
                vibe = "focus,chill,soft"
            elif energy == "medium":
                if acoustic_score >= 0.45:
                    mood = "romantic"
                    vibe = "romantic,healing,acoustic"
                elif brightness >= 0.60:
                    mood = "happy"
                    vibe = "morning,dreamy"
                else:
                    mood = "chill"
                    vibe = "focus,chill,coffee"
            else: # high energy
                mood = "energetic"
                vibe = "dance,workout"
        elif tempo_level == "fast":
            if energy == "high" and current_bpm >= 120 and danceability >= 0.78:
                mood = "party"
                vibe = "dance,party,workout"
            elif energy == "high":
                mood = "energetic"
                vibe = "workout,gym,party"
            elif energy == "medium":
                mood = "happy"
                vibe = "dance,morning"
            else:
                mood = "focus"
                vibe = "focus,roadtrip"

        return {
            "success": True,
            "data": {
                "bpm": bpm,
                "tempo_level": tempo_level,
                "raw_rms": round(raw_energy, 4),
                "energy_score": energy_score,
                "energy": energy,
                "danceability": danceability,
                "acoustic_score": acoustic_score,
                "brightness": brightness,
                "mood": mood,
                "vibe": vibe
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "message": f"Unexpected error during analysis: {str(e)}"}
