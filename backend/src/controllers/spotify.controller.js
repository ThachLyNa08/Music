const spotifyService = require('../services/spotify.service');

function formatTrack(track) {
  return {
    id: track.id,
    title: track.name,
    artist: track.artists.map((artist) => artist.name).join(', '),
    artist_name: track.artists.map((artist) => artist.name).join(', '),
    album: track.album.name,
    cover_url: track.album.images[0]?.url || null,
    preview_url: track.preview_url,
    audio_url: track.preview_url || track.uri,
    duration_sec: Math.floor(track.duration_ms / 1000),
    duration: formatDuration(Math.floor(track.duration_ms / 1000)),
    spotify_url: track.external_urls?.spotify || null,
    spotify_uri: track.uri,
    source: 'spotify',
  };
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

exports.getAuthorizeUrl = async (req, res) => {
  try {
    const data = spotifyService.getAuthorizeUrl(req.user.id);
    res.json({ success: true, data: { url: data.url } });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Cannot create Spotify authorization URL',
    });
  }
};

exports.handleCallback = async (req, res) => {
  try {
    const { code, state } = req.body;
    if (!code || !state) {
      return res.status(400).json({ success: false, message: 'Missing Spotify code or state' });
    }

    const profile = await spotifyService.exchangeCode({
      code,
      state,
      userId: req.user.id,
    });

    res.json({ success: true, data: { connected: true, profile } });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Cannot connect Spotify account',
    });
  }
};

exports.getStatus = async (req, res) => {
  try {
    if (!spotifyService.isUserConnected(req.user.id)) {
      return res.json({ success: true, data: { connected: false, profile: null } });
    }

    const profile = await spotifyService.getCurrentUserProfile(req.user.id);
    res.json({ success: true, data: { connected: true, profile } });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Cannot get Spotify status',
    });
  }
};

exports.disconnect = async (req, res) => {
  spotifyService.disconnectUser(req.user.id);
  res.json({ success: true, data: { connected: false } });
};

exports.getPlaybackToken = async (req, res) => {
  try {
    const token = await spotifyService.getUserPlaybackToken(req.user.id);
    res.json({ success: true, data: token });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Cannot get Spotify playback token',
    });
  }
};

exports.searchSpotify = async (req, res) => {
  try {
    const { q } = req.query;
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 20;

    if (!q) {
      return res.status(400).json({ success: false, message: 'Missing search query (q)' });
    }

    const tracks = await spotifyService.searchTracks(q, limit);
    res.json({ success: true, data: tracks.map(formatTrack) });
  } catch (error) {
    console.error('Spotify search controller error:', error.details || error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Spotify API error',
      details: process.env.NODE_ENV === 'production' ? undefined : error.details,
    });
  }
};

exports.getPlaylist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const playlist = await spotifyService.getPlaylist(id);
    
    const formattedSongs = (playlist.tracks.items || [])
      .filter(item => item && item.track)
      .map(item => formatTrack(item.track));

    res.json({
      success: true,
      data: {
        id: `spotify:playlist:${playlist.id}`,
        name: playlist.name,
        description: playlist.description,
        cover_url: playlist.images?.[0]?.url || null,
        is_public: playlist.public,
        songs: formattedSongs,
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};
