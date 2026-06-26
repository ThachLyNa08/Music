import os
import numpy as np
import pandas as pd
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
except ImportError:
    TfidfVectorizer = None

def build_and_save_embeddings(profiles, output_dir="datasets/processed"):
    """
    profiles: list of dict, containing at least song_id and semantic_text
    """
    if not TfidfVectorizer:
        print("[WARN] scikit-learn is not installed. Skipping embedding generation.")
        return False
        
    if not profiles:
        print("[WARN] No profiles provided for embeddings.")
        return False
        
    df = pd.DataFrame(profiles)
    
    # We need semantic_text and song_id
    if 'semantic_text' not in df.columns or 'song_id' not in df.columns:
        print("[WARN] Missing required columns for embeddings.")
        return False
        
    texts = df['semantic_text'].fillna("").tolist()
    song_ids = df['song_id'].tolist()
    
    # TF-IDF Embedding
    vectorizer = TfidfVectorizer(max_features=256) # Simple 256-dim embedding
    embeddings = vectorizer.fit_transform(texts).toarray()
    
    os.makedirs(output_dir, exist_ok=True)
    
    npy_path = os.path.join(output_dir, "song_semantic_embeddings.npy")
    csv_path = os.path.join(output_dir, "song_semantic_embeddings_meta.csv")
    
    np.save(npy_path, embeddings)
    
    # Save metadata (mapping index to song_id)
    meta_df = pd.DataFrame({
        "index": range(len(song_ids)),
        "song_id": song_ids
    })
    meta_df.to_csv(csv_path, index=False)
    
    print(f"Saved {embeddings.shape} embeddings to {npy_path}")
    return True
