const axios = require('axios');
const crypto = require('crypto');

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const STATE_TTL_MS = 10 * 60 * 1000;

class SpotifyService {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:5173/callback';
    this.scopes = process.env.SPOTIFY_SCOPES || 'streaming user-read-private user-read-email user-read-playback-state user-modify-playback-state';
    this.stateSecret = process.env.SPOTIFY_STATE_SECRET || process.env.JWT_SECRET || this.clientSecret;
    this.token = null;
    this.tokenExpiresAt = null;
    
    const fs = require('fs');
    const path = require('path');
    this.tokensFilePath = path.join(__dirname, '..', '..', 'spotify_tokens.json');
    this.loadTokensFromFile();
  }

  loadTokensFromFile() {
    const fs = require('fs');
    try {
      if (fs.existsSync(this.tokensFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.tokensFilePath, 'utf8'));
        this.userTokens = new Map(Object.entries(data));
      } else {
        this.userTokens = new Map();
      }
    } catch (err) {
      console.error('Failed to load Spotify tokens from file:', err);
      this.userTokens = new Map();
    }
  }

  saveTokensToFile() {
    const fs = require('fs');
    try {
      const obj = Object.fromEntries(this.userTokens);
      fs.writeFileSync(this.tokensFilePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save Spotify tokens to file:', err);
    }
  }

  ensureConfigured() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in backend .env');
    }
  }

  getClientCredentialsHeader() {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  async getAccessToken() {
    if (this.token && this.tokenExpiresAt > Date.now()) {
      return this.token;
    }

    this.ensureConfigured();

    try {
      const response = await axios.post(
        `${SPOTIFY_ACCOUNTS_URL}/api/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: this.getClientCredentialsHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.token = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 300000;

      return this.token;
    } catch (error) {
      console.error('Spotify app token error:', error.response?.data || error.message);
      throw new Error('Cannot get Spotify app token');
    }
  }

  createState(userId) {
    if (!this.stateSecret) {
      throw new Error('Missing SPOTIFY_STATE_SECRET or JWT_SECRET in backend .env');
    }

    const payload = [
      String(userId),
      String(Date.now()),
      crypto.randomBytes(16).toString('hex'),
    ].join('.');
    const signature = crypto.createHmac('sha256', this.stateSecret).update(payload).digest('base64url');

    return Buffer.from(`${payload}.${signature}`).toString('base64url');
  }

  verifyState(state, userId) {
    if (!state || !this.stateSecret) return false;

    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const parts = decoded.split('.');
      if (parts.length !== 4) return false;

      const [stateUserId, issuedAt, nonce, signature] = parts;
      if (!stateUserId || !issuedAt || !nonce || stateUserId !== String(userId)) return false;
      if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return false;

      const payload = [stateUserId, issuedAt, nonce].join('.');
      const expected = crypto.createHmac('sha256', this.stateSecret).update(payload).digest('base64url');

      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  getAuthorizeUrl(userId) {
    this.ensureConfigured();

    const state = this.createState(userId);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: this.scopes,
      redirect_uri: this.redirectUri,
      state,
    });

    return {
      url: `${SPOTIFY_ACCOUNTS_URL}/authorize?${params.toString()}`,
      state,
    };
  }

  async exchangeCode({ code, state, userId }) {
    this.ensureConfigured();

    if (!this.verifyState(state, userId)) {
      const error = new Error('Invalid or expired Spotify state');
      error.statusCode = 400;
      throw error;
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });

    try {
      const response = await axios.post(`${SPOTIFY_ACCOUNTS_URL}/api/token`, body.toString(), {
        headers: {
          Authorization: this.getClientCredentialsHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.saveUserToken(userId, response.data);
      return this.getCurrentUserProfile(userId);
    } catch (error) {
      console.error('Spotify code exchange error:', error.response?.data || error.message);
      throw new Error('Cannot complete Spotify authorization');
    }
  }

  saveUserToken(userId, tokenData) {
    this.userTokens.set(String(userId), {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      scope: tokenData.scope,
      tokenType: tokenData.token_type,
      expiresAt: Date.now() + (tokenData.expires_in * 1000) - 60000,
    });
    this.saveTokensToFile();
  }

  isUserConnected(userId) {
    return this.userTokens.has(String(userId));
  }

  disconnectUser(userId) {
    this.userTokens.delete(String(userId));
    this.saveTokensToFile();
  }

  async getUserAccessToken(userId) {
    this.ensureConfigured();

    const tokenData = this.userTokens.get(String(userId));
    if (!tokenData) {
      const error = new Error('Spotify account is not connected');
      error.statusCode = 404;
      throw error;
    }

    if (tokenData.accessToken && tokenData.expiresAt > Date.now()) {
      return tokenData.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refreshToken,
    });

    const response = await axios.post(`${SPOTIFY_ACCOUNTS_URL}/api/token`, body.toString(), {
      headers: {
        Authorization: this.getClientCredentialsHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    this.saveUserToken(userId, {
      ...response.data,
      refresh_token: response.data.refresh_token || tokenData.refreshToken,
    });

    return this.userTokens.get(String(userId)).accessToken;
  }

  async getCurrentUserProfile(userId) {
    const token = await this.getUserAccessToken(userId);
    const response = await axios.get(`${SPOTIFY_API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      id: response.data.id,
      display_name: response.data.display_name,
      email: response.data.email,
      country: response.data.country,
      product: response.data.product,
      image_url: response.data.images?.[0]?.url || null,
      spotify_url: response.data.external_urls?.spotify || null,
    };
  }

  async getUserPlaybackToken(userId) {
    const accessToken = await this.getUserAccessToken(userId);
    const tokenData = this.userTokens.get(String(userId));

    return {
      access_token: accessToken,
      expires_at: tokenData.expiresAt,
      scope: tokenData.scope,
    };
  }

  async searchTracks(query, limit = 10) {
    const token = await this.getAccessToken();
    try {
      const response = await axios.get(`${SPOTIFY_API_URL}/search`, {
        params: { q: query, type: 'track' },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data.tracks.items.slice(0, limit);
    } catch (error) {
      console.error('Spotify search error:', error.response?.data || error.message);
      if (error.response?.data) {
        const spotifyError = new Error(error.response.data.error?.message || error.response.data.error_description || 'Spotify search request failed');
        spotifyError.statusCode = error.response.status;
        spotifyError.details = error.response.data;
        throw spotifyError;
      }
      throw error;
    }
  }

  async getTrack(trackId) {
    const token = await this.getAccessToken();
    try {
      const response = await axios.get(`${SPOTIFY_API_URL}/tracks/${trackId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Spotify track detail error:', error.response?.data || error.message);
      throw error;
    }
  }

  async resolveSpotifyTrack(trackId, conn = null) {
    const db = conn || require('../config/database').pool;
    const cleanId = trackId.replace('spotify:track:', '');
    const spotifyUri = `spotify:track:${cleanId}`;

    // 1. Kiểm tra bài hát đã tồn tại trong DB chưa
    const [existing] = await db.query('SELECT id FROM songs WHERE audio_url = ? LIMIT 1', [spotifyUri]);
    if (existing.length > 0) {
      return existing[0].id;
    }

    // 2. Lấy thông tin bài hát từ Spotify
    const track = await this.getTrack(cleanId);
    
    // 3. Tìm hoặc tạo Artist
    const artistName = track.artists.map(a => a.name).join(', ');
    let [artists] = await db.query('SELECT id FROM artists WHERE name = ? LIMIT 1', [artistName]);
    let artistId;
    let isNewArtist = false;
    if (artists.length === 0) {
      const [artistRes] = await db.query('INSERT INTO artists (name) VALUES (?)', [artistName]);
      artistId = artistRes.insertId;
      isNewArtist = true;
    } else {
      artistId = artists[0].id;
    }

    if (isNewArtist && artistId) {
      const { ensureArtistAvatar } = require('./artistImage.service');
      ensureArtistAvatar(artistId).catch(error => {
        console.error("Auto fetch artist avatar in resolveSpotifyTrack failed:", error.message);
      });
    }

    // 4. Tìm hoặc tạo Album
    const albumTitle = track.album.name;
    let albumId = null;
    if (albumTitle) {
      let [albums] = await db.query('SELECT id FROM albums WHERE title = ? AND artist_id = ? LIMIT 1', [albumTitle, artistId]);
      if (albums.length === 0) {
        const [albumRes] = await db.query('INSERT INTO albums (title, artist_id, cover_url) VALUES (?, ?, ?)', [albumTitle, artistId, track.album.images[0]?.url || null]);
        albumId = albumRes.insertId;
      } else {
        albumId = albums[0].id;
      }
    }

    // 5. Thêm Song
    const durationSec = Math.floor(track.duration_ms / 1000);
    const coverUrl = track.album.images[0]?.url || null;
    const [songRes] = await db.query(`
      INSERT INTO songs (title, artist_id, album_id, duration_sec, audio_url, cover_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [track.name, artistId, albumId, durationSec, spotifyUri, coverUrl]);

    return songRes.insertId;
  }

  async getPlaylist(playlistId) {
    const token = await this.getAccessToken();
    try {
      const response = await axios.get(`${SPOTIFY_API_URL}/playlists/${playlistId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Spotify playlist detail error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new SpotifyService();
