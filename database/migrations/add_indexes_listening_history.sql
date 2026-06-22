-- Add index for song_id on listening_history to optimize getArtistTotalPlaysQuery
CREATE INDEX idx_listening_history_song_id ON listening_history(song_id);

-- Add index for artist_id on songs table
CREATE INDEX idx_songs_artist_id ON songs(artist_id);
