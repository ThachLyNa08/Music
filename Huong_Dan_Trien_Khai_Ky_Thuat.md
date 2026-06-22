# HƯỚNG DẪN TRIỂN KHAI KỸ THUẬT - MUSICFLOW RECOMMENDATION ENGINE

## PHẦN I: IMPLICIT MATRIX FACTORIZATION (IMF) vs SVD

### 1.1 So sánh mã hiện tại vs đề xuất

**Code hiện tại (SVD cơ bản):**
```python
# Current: MusicFlow/Python/recommendation_service.py
from surprise import SVD, Dataset
from surprise.model_selection import train_test_split

class RecommendationEngine:
    def __init__(self):
        self.algo = SVD(n_factors=50, random_state=42)
    
    def train(self, listening_history_df):
        # listening_history_df columns: user_id, song_id, rating
        # rating = completion_rate (0-1)
        reader = Reader(rating_scale=(0, 1))
        data = Dataset.load_from_df(
            listening_history_df[['user_id', 'song_id', 'rating']], 
            reader
        )
        trainset = data.build_full_trainset()
        self.algo.fit(trainset)
    
    def get_recommendations(self, user_id, n=20):
        # Problem: SVD treats all non-rated items equally
        # Doesn't distinguish between:
        # - Songs user hasn't heard yet (missing value)
        # - Songs user didn't like (negative feedback)
        user_songs = get_user_listened_songs(user_id)
        all_songs = get_all_songs()
        unrated_songs = [s for s in all_songs if s not in user_songs]
        
        predictions = [self.algo.predict(user_id, song_id) 
                      for song_id in unrated_songs]
        return sorted(predictions, key=lambda x: x.est, reverse=True)[:n]
```

**Code đề xuất (ImplicitMF với weighted feedback):**
```python
# Proposed: Using BPR-MF variant with weights
from surprise import SVDpp  # SVD++ handles implicit feedback better
from surprise import Reader, Dataset
import pandas as pd
import numpy as np

class ImplicitMFRecommendationEngine:
    def __init__(self, n_factors=50):
        self.algo = SVDpp(n_factors=n_factors, random_state=42, n_epochs=50)
        self.weights = {
            'completion_rate': 0.5,
            'like_indicator': 0.3,
            'skip_penalty': -0.2,
            'recency_boost': 0.1
        }
    
    def compute_weighted_feedback(self, listening_history_df):
        """
        Transform implicit feedback into weighted ratings
        
        Input columns:
        - user_id, song_id
        - completion_rate (0-1)
        - liked (0/1)
        - was_skipped (0/1)
        - last_listened_at (timestamp)
        
        Output:
        - Weighted rating combining all signals
        """
        df = listening_history_df.copy()
        
        # Compute recency (0-1, higher = more recent)
        max_date = df['last_listened_at'].max()
        df['recency'] = (df['last_listened_at'] - df['last_listened_at'].min()) / \
                        (max_date - df['last_listened_at'].min())
        
        # Compute weighted score
        df['weighted_feedback'] = (
            df['completion_rate'] * self.weights['completion_rate'] +
            df['liked'] * self.weights['like_indicator'] +
            (~df['was_skipped']).astype(int) * self.weights['skip_penalty'] +
            df['recency'] * self.weights['recency_boost']
        )
        
        # Clip to [0, 1] range
        df['weighted_feedback'] = df['weighted_feedback'].clip(0, 1)
        
        return df[['user_id', 'song_id', 'weighted_feedback']]
    
    def train(self, listening_history_df):
        """Train ImplicitMF model with weighted feedback"""
        # Step 1: Compute weighted ratings
        weighted_df = self.compute_weighted_feedback(listening_history_df)
        
        # Step 2: Load into Surprise dataset
        reader = Reader(rating_scale=(0, 1))
        data = Dataset.load_from_df(
            weighted_df[['user_id', 'song_id', 'weighted_feedback']], 
            reader
        )
        trainset = data.build_full_trainset()
        
        # Step 3: Train SVD++ (handles implicit feedback better)
        self.algo.fit(trainset)
    
    def get_recommendations(self, user_id, n=20):
        """Get top-N recommendations"""
        user_songs = get_user_listened_songs(user_id)
        all_songs = get_all_songs()
        unrated_songs = [s for s in all_songs if s not in user_songs]
        
        predictions = [
            (song_id, self.algo.predict(user_id, song_id).est)
            for song_id in unrated_songs
        ]
        
        # Sort by estimated rating
        top_songs = sorted(predictions, key=lambda x: x[1], reverse=True)
        return [song_id for song_id, _ in top_songs[:n]]
```

### 1.2 Cải tiến bổ sung: BPR-MF (Nếu có thời gian)

```python
# Advanced option: Pure BPR-MF (from implicit library)
from implicit.bpr import BayesianPersonalizedRanking
from implicit.nearest_neighbours import ItemItemRecommender
import scipy.sparse as sparse

class BPRMFRecommendationEngine:
    def __init__(self, n_factors=50, learning_rate=0.01, iterations=100):
        # BPR-MF: Optimized for ranking (not regression)
        self.model = BayesianPersonalizedRanking(
            factors=n_factors,
            learning_rate=learning_rate,
            iterations=iterations,
            random_state=42
        )
    
    def train(self, listening_history_df):
        """
        BPR expects sparse matrix format:
        - Rows = users
        - Cols = items (songs)
        - Values = interactions (1 if user-song pair interacted)
        """
        # Create user-song interaction matrix
        user_ids = listening_history_df['user_id'].unique()
        song_ids = listening_history_df['song_id'].unique()
        
        user_idx = {uid: i for i, uid in enumerate(user_ids)}
        song_idx = {sid: j for j, sid in enumerate(song_ids)}
        
        # Filter only positive interactions (completion_rate > 0.5 or liked)
        positive_interactions = listening_history_df[
            (listening_history_df['completion_rate'] > 0.5) |
            (listening_history_df['liked'] == 1)
        ]
        
        # Create sparse matrix
        rows = [user_idx[uid] for uid in positive_interactions['user_id']]
        cols = [song_idx[sid] for sid in positive_interactions['song_id']]
        data = [1] * len(rows)
        
        interaction_matrix = sparse.csr_matrix(
            (data, (rows, cols)),
            shape=(len(user_ids), len(song_ids))
        )
        
        # Train BPR
        self.model.fit(interaction_matrix)
        
        # Store mappings
        self.user_idx = user_idx
        self.song_idx = song_idx
        self.idx_user = {v: k for k, v in user_idx.items()}
        self.idx_song = {v: k for k, v in song_idx.items()}
    
    def get_recommendations(self, user_id, n=20):
        """Get top-N recommendations using BPR"""
        user_idx_val = self.user_idx.get(user_id)
        if user_idx_val is None:
            return []
        
        # Get recommendations from model
        recommendations = self.model.recommend(user_idx_val, n=n)
        # Returns: [(song_idx, score), ...]
        
        song_ids = [self.idx_song[song_idx] for song_idx, _ in recommendations]
        return song_ids
```

**Bảng so sánh:**

| Aspect | SVD | SVD++ | BPR-MF |
|--------|-----|-------|--------|
| Loss Function | RMSE (Regression) | RMSE (Implicit) | BPR (Ranking) |
| Optimization | Least squares | Implicit feedback | Pairwise ranking |
| Performance | Baseline | +5-8% | +10-15% |
| Implementation | Built-in | Built-in | `implicit` library |
| Suitability | Rating prediction | Music (implicit) | **Music (ranking)** ✅ |

### **Recommendation: Dùng BPR-MF nếu có thời gian, nếu không thì SVD++**

---

## PHẦN II: AUDIO FEATURE EXTRACTION & CONTENT FILTERING

### 2.1 Setup: Chọn phương pháp

```
┌─────────────────────────────────────┐
│  Bạn có Spotify API key?            │
├─────────────────────────────────────┤
│ YES → Dùng Spotify API (Option A)   │
│ NO  → Dùng Librosa (Option B)       │
└─────────────────────────────────────┘
```

### 2.2 Option A: Spotify API (Recommended)

```python
# Setup
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import pandas as pd
import numpy as np

class SpotifyAudioFeatureExtractor:
    def __init__(self, client_id, client_secret):
        self.client = spotipy.Spotify(
            client_credentials_manager=SpotifyClientCredentials(
                client_id=client_id,
                client_secret=client_secret
            )
        )
    
    def extract_features_for_song(self, song_name, artist_name):
        """Extract features for a single song"""
        try:
            # Search for song
            query = f"{song_name} {artist_name}"
            results = self.client.search(q=query, type='track', limit=1)
            
            if not results['tracks']['items']:
                return None
            
            track = results['tracks']['items'][0]
            track_id = track['id']
            
            # Get audio features
            features = self.client.audio_features(track_id)[0]
            
            return {
                'track_id': track_id,
                'danceability': features['danceability'],      # 0-1
                'energy': features['energy'],                  # 0-1
                'acousticness': features['acousticness'],      # 0-1
                'instrumentalness': features['instrumentalness'], # 0-1
                'liveness': features['liveness'],              # 0-1
                'loudness': features['loudness'],              # dB
                'speechiness': features['speechiness'],        # 0-1
                'tempo': features['tempo'],                    # BPM
                'time_signature': features['time_signature'],  # beats per bar
                'valence': features['valence'],                # 0-1 (happy)
            }
        except Exception as e:
            print(f"Error extracting features: {e}")
            return None
    
    def extract_features_batch(self, songs_df):
        """
        Extract features for multiple songs
        
        songs_df columns: song_id, song_name, artist_name
        """
        features_list = []
        
        for idx, row in songs_df.iterrows():
            features = self.extract_features_for_song(
                row['song_name'],
                row['artist_name']
            )
            
            if features:
                features['song_id'] = row['song_id']
                features_list.append(features)
            
            # Spotify API rate limit: ~180 requests per minute
            if idx % 100 == 0:
                print(f"Processed {idx} songs...")
        
        return pd.DataFrame(features_list)
    
    def normalize_features(self, features_df):
        """Normalize features to [0, 1] range"""
        normalized = features_df.copy()
        
        # Features already in [0, 1]
        normalized_01 = [
            'danceability', 'energy', 'acousticness', 
            'instrumentalness', 'liveness', 'speechiness', 'valence'
        ]
        
        # Normalize tempo: typically 50-200 BPM
        if 'tempo' in normalized.columns:
            normalized['tempo'] = (normalized['tempo'] - 50) / (200 - 50)
            normalized['tempo'] = normalized['tempo'].clip(0, 1)
        
        # Normalize loudness: typically -60 to 0 dB
        if 'loudness' in normalized.columns:
            normalized['loudness'] = (normalized['loudness'] + 60) / 60
            normalized['loudness'] = normalized['loudness'].clip(0, 1)
        
        return normalized
```

### 2.3 Option B: Librosa (No API Key)

```python
import librosa
import numpy as np
import pandas as pd
from pathlib import Path

class LibrosaAudioFeatureExtractor:
    @staticmethod
    def extract_features(audio_path):
        """Extract features using librosa"""
        try:
            # Load audio file
            y, sr = librosa.load(audio_path, sr=None)
            
            # Extract features
            features = {}
            
            # Tempo
            onset_frames = librosa.util.peak_pick(
                librosa.onset.onset_strength(y=y, sr=sr),
                pre_max=3, post_max=3, pre_avg=3, post_avg=3, delta=0.5, wait=10
            )
            features['tempo'] = librosa.frames_to_time(onset_frames, sr=sr).mean()
            
            # Energy (RMS)
            features['energy'] = np.mean(librosa.feature.rms(y=y)[0])
            
            # Acoustic features
            S = librosa.feature.melspectrogram(y=y, sr=sr)
            S_db = librosa.power_to_db(S, ref=np.max)
            
            # Spectral features
            features['spectral_centroid'] = np.mean(
                librosa.feature.spectral_centroid(S=S_db, sr=sr)
            )
            features['spectral_rolloff'] = np.mean(
                librosa.feature.spectral_rolloff(y=y, sr=sr)
            )
            
            # Zero crossing rate (voice/speech indicator)
            features['zero_crossing_rate'] = np.mean(
                librosa.feature.zero_crossing_rate(y)
            )
            
            # MFCC (Mel-frequency cepstral coefficients)
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            features['mfcc_mean'] = np.mean(mfcc, axis=1)
            
            # Chroma features (relates to pitch/harmony)
            chroma = librosa.feature.chroma_stft(y=y, sr=sr)
            features['chroma_mean'] = np.mean(chroma, axis=1)
            
            return features
        
        except Exception as e:
            print(f"Error extracting features from {audio_path}: {e}")
            return None
    
    @staticmethod
    def extract_features_batch(audio_dir):
        """Extract features for all audio files in directory"""
        features_list = []
        
        for audio_file in Path(audio_dir).glob("*.mp3"):
            print(f"Processing {audio_file.name}...")
            
            features = LibrosaAudioFeatureExtractor.extract_features(
                str(audio_file)
            )
            
            if features:
                features['song_id'] = audio_file.stem
                features_list.append(features)
        
        return pd.DataFrame(features_list)
```

### 2.4 Content-based Filtering với Audio Features

```python
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler

class AudioFeatureContentFiltering:
    def __init__(self, audio_features_df):
        """
        audio_features_df: contains song_id + normalized audio features
        """
        self.features_df = audio_features_df
        self.feature_columns = [col for col in audio_features_df.columns 
                               if col != 'song_id']
        
        # Standardize features
        self.scaler = StandardScaler()
        self.features_normalized = self.scaler.fit_transform(
            audio_features_df[self.feature_columns]
        )
        
        # Pre-compute similarity matrix
        self.similarity_matrix = cosine_similarity(self.features_normalized)
    
    def get_similar_songs(self, song_id, n=10):
        """Get top-N songs similar to given song"""
        song_idx = self.features_df[
            self.features_df['song_id'] == song_id
        ].index[0]
        
        # Get similarity scores
        similarities = self.similarity_matrix[song_idx]
        
        # Get top N similar (excluding self)
        similar_indices = np.argsort(similarities)[::-1][1:n+1]
        
        similar_song_ids = self.features_df.iloc[similar_indices]['song_id'].tolist()
        return similar_song_ids
    
    def get_recommendations_for_user(self, user_id, 
                                    user_listening_history_df,
                                    n=20, diversity_factor=0.2):
        """
        Get content-based recommendations:
        1. Find all songs user has listened to
        2. Find similar songs to those
        3. Blend for diversity
        """
        user_songs = user_listening_history_df[
            user_listening_history_df['user_id'] == user_id
        ]['song_id'].tolist()
        
        if not user_songs:
            return []
        
        # Collect similar songs for each user-listened song
        candidate_songs = {}
        
        for song_id in user_songs:
            similar = self.get_similar_songs(song_id, n=5)
            for similar_song in similar:
                if similar_song not in candidate_songs:
                    candidate_songs[similar_song] = 0
                candidate_songs[similar_song] += 1
        
        # Filter out songs already listened
        candidate_songs = {
            song: count for song, count in candidate_songs.items()
            if song not in user_songs
        }
        
        # Sort by frequency
        recommendations = sorted(
            candidate_songs.items(),
            key=lambda x: x[1],
            reverse=True
        )[:n]
        
        return [song_id for song_id, _ in recommendations]
```

### 2.5 Hybrid: Combine ImplicitMF + Content-Based

```python
class HybridRecommendationEngine:
    def __init__(self, implicit_mf_model, content_based_model,
                 cf_weight=0.6, cb_weight=0.4):
        self.implicit_mf = implicit_mf_model
        self.content_based = content_based_model
        self.cf_weight = cf_weight
        self.cb_weight = cb_weight
    
    def get_recommendations(self, user_id, n=20):
        """Blend recommendations from both methods"""
        
        # Get CF recommendations
        cf_recs = self.implicit_mf.get_recommendations(user_id, n=n*2)
        cf_scores = {song_id: score 
                    for song_id, score in enumerate(cf_recs, 1)}
        
        # Get CB recommendations
        cb_recs = self.content_based.get_recommendations_for_user(
            user_id, n=n*2
        )
        cb_scores = {song_id: score 
                    for song_id, score in enumerate(cb_recs, 1)}
        
        # Blend scores
        blended_scores = {}
        
        for song_id in set(cf_scores.keys()) | set(cb_scores.keys()):
            cf_score = cf_scores.get(song_id, 0) / (n*2)
            cb_score = cb_scores.get(song_id, 0) / (n*2)
            
            blended_scores[song_id] = (
                cf_score * self.cf_weight + 
                cb_score * self.cb_weight
            )
        
        # Return top N
        recommendations = sorted(
            blended_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )[:n]
        
        return [song_id for song_id, _ in recommendations]
```

---

## PHẦN III: CONTEXT-AWARE RE-RANKING

### 3.1 Rule-based Re-ranking

```python
from datetime import datetime, timedelta
import numpy as np

class ContextAwareReranking:
    def __init__(self, user_listening_history_df, 
                 similarity_matrix, features_df):
        self.history = user_listening_history_df
        self.similarity_matrix = similarity_matrix
        self.features_df = features_df
    
    def get_time_of_day_mood(self, hour):
        """Determine mood preference based on time of day"""
        if 6 <= hour < 12:
            return {
                'energy': 0.8,      # High energy
                'valence': 0.7,     # Happy/upbeat
                'danceability': 0.7,
            }
        elif 12 <= hour < 18:
            return {
                'energy': 0.6,
                'valence': 0.6,
                'danceability': 0.5,
            }
        else:  # 18-6
            return {
                'energy': 0.4,      # Low energy
                'valence': 0.4,     # Chill/sad
                'danceability': 0.3,
            }
    
    def compute_rerank_scores(self, candidates, user_id, context=None):
        """
        Re-rank candidates based on context
        
        candidates: list of song_ids
        context: dict with {
            'time': datetime,
            'device': str,  # 'mobile', 'desktop'
            'last_played_song': song_id (optional)
        }
        """
        if context is None:
            context = {'time': datetime.now()}
        
        reranked = {}
        current_time = context.get('time', datetime.now())
        hour = current_time.hour
        
        # Get user's last played song
        user_history = self.history[self.history['user_id'] == user_id]
        last_songs = user_history.nlargest(3, 'last_listened_at')
        
        for song_id in candidates:
            base_score = candidates[song_id] if isinstance(candidates, dict) else 1.0
            
            # Penalty: Similarity to recently played songs
            for _, hist_row in last_songs.iterrows():
                last_song_id = hist_row['song_id']
                sim_penalty = self._get_similarity(song_id, last_song_id)
                base_score *= (1 - sim_penalty * 0.3)  # 30% penalty if too similar
            
            # Boost: Time-based mood matching
            mood_boost = self._get_mood_boost(song_id, hour)
            base_score *= (1 + mood_boost * 0.2)  # 20% boost if matches mood
            
            # Boost: Device consideration
            if context.get('device') == 'mobile':
                # Shorter, poppier songs for mobile
                if self._get_song_feature(song_id, 'energy') > 0.7:
                    base_score *= 1.1
            
            # Boost: Freshness (if new song, slight boost)
            if self._is_new_song(song_id):
                base_score *= 1.05
            
            # Diversity: Penalize if too similar to other candidates
            diversity_penalty = self._compute_diversity_penalty(song_id, candidates)
            base_score *= (1 - diversity_penalty * 0.1)
            
            reranked[song_id] = base_score
        
        return reranked
    
    def _get_similarity(self, song1_id, song2_id):
        """Get similarity between two songs (0-1)"""
        idx1 = self.features_df[self.features_df['song_id'] == song1_id].index[0]
        idx2 = self.features_df[self.features_df['song_id'] == song2_id].index[0]
        return self.similarity_matrix[idx1, idx2]
    
    def _get_song_feature(self, song_id, feature_name):
        """Get specific audio feature for a song"""
        row = self.features_df[self.features_df['song_id'] == song_id]
        if row.empty:
            return 0.5
        return row[feature_name].values[0]
    
    def _get_mood_boost(self, song_id, hour):
        """Calculate mood matching boost"""
        mood = self.get_time_of_day_mood(hour)
        
        energy = self._get_song_feature(song_id, 'energy')
        valence = self._get_song_feature(song_id, 'valence')
        danceability = self._get_song_feature(song_id, 'danceability')
        
        # Calculate distance from mood profile
        distance = np.sqrt(
            (energy - mood['energy'])**2 +
            (valence - mood['valence'])**2 +
            (danceability - mood['danceability'])**2
        )
        
        # Return boost (0-1, higher if closer to mood)
        return max(0, 1 - distance)
    
    def _is_new_song(self, song_id):
        """Check if song is newly released"""
        # Implement based on release_date field
        # Return True if released < 2 weeks ago
        pass
    
    def _compute_diversity_penalty(self, song_id, candidates):
        """Penalize if song is too similar to other candidates"""
        penalty = 0
        for other_song in list(candidates.keys())[:5]:  # Check top 5
            sim = self._get_similarity(song_id, other_song)
            penalty += sim
        return penalty / 5 if len(candidates) > 0 else 0
    
    def get_final_recommendations(self, candidates, user_id, n=20):
        """Get final re-ranked recommendations"""
        reranked = self.compute_rerank_scores(candidates, user_id)
        
        # Sort and return top N
        final = sorted(
            reranked.items(),
            key=lambda x: x[1],
            reverse=True
        )[:n]
        
        return [song_id for song_id, _ in final]
```

### 3.2 Integration với FastAPI

```python
# MusicFlow/Python/main.py
from fastapi import FastAPI
from datetime import datetime

app = FastAPI()

# Instantiate engines
implicit_mf_engine = ImplicitMFRecommendationEngine()
content_engine = AudioFeatureContentFiltering(audio_features_df)
hybrid_engine = HybridRecommendationEngine(implicit_mf_engine, content_engine)
reranking_engine = ContextAwareReranking(
    listening_history_df, 
    similarity_matrix,
    audio_features_df
)

@app.post("/api/recommendations")
async def get_recommendations(user_id: str, n: int = 20):
    """Get context-aware recommendations"""
    try:
        # Step 1: Get hybrid recommendations
        candidates = hybrid_engine.get_recommendations(user_id, n=n*2)
        
        # Step 2: Re-rank based on context
        context = {
            'time': datetime.now(),
            'device': request.headers.get('User-Agent'),  # Extract device
        }
        
        final_recommendations = reranking_engine.get_final_recommendations(
            {song_id: 1.0 for song_id in candidates},
            user_id,
            n=n
        )
        
        return {
            'status': 'success',
            'recommendations': final_recommendations,
            'timestamp': datetime.now().isoformat()
        }
    
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }
```

---

## PHẦN IV: TESTING & EVALUATION

### 4.1 Offline Evaluation Script

```python
from sklearn.metrics import precision_score, ndcg_score
import numpy as np

class RecommendationEvaluator:
    @staticmethod
    def precision_at_k(predictions, ground_truth, k=10):
        """Precision@K"""
        predictions = predictions[:k]
        hits = len(set(predictions) & set(ground_truth))
        return hits / k if k > 0 else 0
    
    @staticmethod
    def recall_at_k(predictions, ground_truth, k=10):
        """Recall@K"""
        predictions = predictions[:k]
        hits = len(set(predictions) & set(ground_truth))
        return hits / len(ground_truth) if len(ground_truth) > 0 else 0
    
    @staticmethod
    def ndcg_at_k(predictions, ground_truth, k=10):
        """Normalized Discounted Cumulative Gain@K"""
        predictions = predictions[:k]
        
        # Binary relevance
        relevance = [1 if item in ground_truth else 0 for item in predictions]
        
        # Ideal DCG
        ideal_relevance = [1] * min(len(ground_truth), k)
        
        # Compute DCG
        dcg = sum(rel / np.log2(i + 2) for i, rel in enumerate(relevance))
        ideal_dcg = sum(rel / np.log2(i + 2) for i, rel in enumerate(ideal_relevance))
        
        return dcg / ideal_dcg if ideal_dcg > 0 else 0
    
    @staticmethod
    def coverage(all_predictions, all_items):
        """Coverage: % of items recommended at least once"""
        unique_recommended = set()
        for preds in all_predictions.values():
            unique_recommended.update(preds)
        return len(unique_recommended) / len(all_items)
    
    @staticmethod
    def diversity(predictions, similarity_matrix):
        """Average pairwise dissimilarity"""
        if len(predictions) < 2:
            return 0
        
        dissimilarities = []
        for i in range(len(predictions)):
            for j in range(i+1, len(predictions)):
                sim = similarity_matrix[predictions[i], predictions[j]]
                dissimilarities.append(1 - sim)
        
        return np.mean(dissimilarities) if dissimilarities else 0
    
    @staticmethod
    def evaluate_all(model, test_data, all_items, k=10):
        """Comprehensive evaluation"""
        precisions, recalls, ndcgs = [], [], []
        all_predictions = {}
        
        for user_id, ground_truth in test_data.items():
            predictions = model.get_recommendations(user_id, n=k)
            all_predictions[user_id] = predictions
            
            precisions.append(RecommendationEvaluator.precision_at_k(
                predictions, ground_truth, k
            ))
            recalls.append(RecommendationEvaluator.recall_at_k(
                predictions, ground_truth, k
            ))
            ndcgs.append(RecommendationEvaluator.ndcg_at_k(
                predictions, ground_truth, k
            ))
        
        return {
            'precision@k': np.mean(precisions),
            'recall@k': np.mean(recalls),
            'ndcg@k': np.mean(ndcgs),
            'coverage': RecommendationEvaluator.coverage(all_predictions, all_items),
        }

# Usage
evaluator = RecommendationEvaluator()
results = evaluator.evaluate_all(hybrid_engine, test_data, all_songs)
print(f"Precision@10: {results['precision@k']:.3f}")
print(f"NDCG@10: {results['ndcg@k']:.3f}")
print(f"Coverage: {results['coverage']:.3f}")
```

---

## PHẦN V: DEPLOYMENT CHECKLIST

```
✅ PHASE 1: ImplicitMF
  ├─ [ ] Replace SVD with SVD++/BPR-MF
  ├─ [ ] Add weighted feedback computation
  ├─ [ ] Retrain model with new feedback
  ├─ [ ] Test offline metrics
  └─ [ ] Deploy to production
     └─ Monitor: precision, coverage, skip_rate

✅ PHASE 2: Audio Features
  ├─ [ ] Extract audio features for all songs
  ├─ [ ] Pre-compute similarity matrix
  ├─ [ ] Integrate content-based filtering
  ├─ [ ] Create hybrid engine
  ├─ [ ] Test offline metrics
  └─ [ ] Deploy to production
     └─ Monitor: cold-start performance, discovery rate

✅ PHASE 3: Context-Aware Ranking
  ├─ [ ] Implement time-based mood boost
  ├─ [ ] Add similarity penalty
  ├─ [ ] Implement diversity metrics
  ├─ [ ] Tune weights (A/B test)
  └─ [ ] Deploy to production
     └─ Monitor: user satisfaction, session length

✅ PHASE 4: Monitoring & Optimization
  ├─ [ ] Setup metrics dashboard
  ├─ [ ] Monitor skip_rate trends
  ├─ [ ] Monitor like_rate trends
  ├─ [ ] A/B test different weights
  └─ [ ] Monthly model retrain
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-18  
**Code Status:** Ready for Implementation  
**Testing Status:** Evaluation scripts provided
