const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const { pool } = require('../config/database');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const resolveAudioPath = (audioUrl) => {
    if (!audioUrl) return null;
    
    // Normalize string to avoid path traversal issues just in case
    let normalized = path.normalize(audioUrl).replace(/^(\.\.[\/\\])+/, '');
    
    // Common formats: "/uploads/audio/...", "uploads/audio/..."
    if (normalized.startsWith('/uploads')) {
        normalized = normalized.substring(1); // remove leading slash
    }
    
    // The uploads directory is at apps/backend/uploads
    // This service is in apps/backend/src/services
    // So __dirname is apps/backend/src/services
    // Uploads is at path.join(__dirname, '../../', normalized)
    return path.join(__dirname, '../../', normalized);
};

exports.analyzeAndSave = async (songId, audioUrl) => {
    const absolutePath = resolveAudioPath(audioUrl);
    if (!absolutePath) {
        throw new Error(`Invalid audioUrl: ${audioUrl}`);
    }

    try {
        await fs.access(absolutePath);
    } catch (err) {
        throw new Error(`File does not exist: ${absolutePath}`);
    }

    try {
        const response = await axios.post(`${AI_SERVICE_URL}/api/audio/analyze`, {
            file_path: absolutePath
        }, {
            timeout: 60000 // 60s timeout for audio processing
        });

        const data = response.data;
        if (!data.success) {
            throw new Error(data.message || 'Unknown error from AI service');
        }

        const features = data.data;

        const connection = await pool.getConnection();
        try {
            await connection.query(`
                INSERT INTO song_audio_features 
                (song_id, bpm, tempo_level, energy_score, energy, danceability, acoustic_score, brightness, mood, vibe, analyzed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                bpm=VALUES(bpm),
                tempo_level=VALUES(tempo_level),
                energy_score=VALUES(energy_score),
                energy=VALUES(energy),
                danceability=VALUES(danceability),
                acoustic_score=VALUES(acoustic_score),
                brightness=VALUES(brightness),
                mood=VALUES(mood),
                vibe=VALUES(vibe),
                analyzed_at=NOW()
            `, [
                songId, 
                features.bpm, 
                features.tempo_level, 
                features.energy_score, 
                features.energy, 
                features.danceability, 
                features.acoustic_score, 
                features.brightness, 
                features.mood, 
                features.vibe
            ]);
            
            return { success: true, features };
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error.response) {
            throw new Error(`AI service error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
};
