import os
import pandas as pd
from tqdm import tqdm

def main():
    base_dir = os.path.join(os.path.dirname(__file__), '../../../datasets/processed/recommendation/v4/all_users')
    interactions_file = os.path.join(base_dir, 'interactions_v4_all.csv')

    if not os.path.exists(interactions_file):
        print(f"Error: {interactions_file} does not exist. Run generation script first.")
        return

    print(f"Loading {interactions_file}...")
    df = pd.read_csv(interactions_file)

    print("Sorting by created_at...")
    df['created_at'] = pd.to_datetime(df['created_at'])
    df = df.sort_values(by=['user_id', 'created_at'])

    train_dfs = []
    test_dfs = []

    print("Applying per-user temporal split (80/20)...")
    for user_id, group in tqdm(df.groupby('user_id')):
        n = len(group)
        if n < 10:
            # Too few interactions, put all in train
            train_dfs.append(group)
            continue

        split_idx = int(n * 0.8)
        train_dfs.append(group.iloc[:split_idx])
        test_dfs.append(group.iloc[split_idx:])

    train_df = pd.concat(train_dfs)
    test_df = pd.concat(test_dfs)

    train_file = os.path.join(base_dir, 'train_v4_all.csv')
    test_file = os.path.join(base_dir, 'test_v4_all.csv')

    train_df.to_csv(train_file, index=False)
    test_df.to_csv(test_file, index=False)

    print(f"Split complete.")
    print(f"Train set: {len(train_df)} rows -> {train_file}")
    print(f"Test set:  {len(test_df)} rows -> {test_file}")

if __name__ == "__main__":
    main()
