require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../../src/config/database');
const { mainThemes, moodTags, situationTags } = require('../../src/constants/songSemanticTags');

// Keyword sets for rule-based matching
const heartbreakKeywords = ['chia tay', 'xa nhau', 'nhớ em', 'nhớ anh', 'cô đơn', 'nước mắt', 'đau', 'buồn', 'quên', 'tiếc', 'mưa'];
const partyKeywords = ['quẩy', 'vui', 'party', 'sôi động', 'dance', 'edm', 'năng lượng'];
const chillKeywords = ['nhẹ nhàng', 'chill', 'acoustic', 'slow', 'lofi', 'ngủ', 'thư giãn', 'bình yên'];
const nostalgiaKeywords = ['hoài niệm', 'kỷ niệm', 'ngày xưa', 'tuổi thơ', 'thanh xuân', 'bolero', 'folk', 'xưa'];

function extractRuleBasedSemantic(song) {
  let matchedRule = 'none';
  let main_theme = 'other';
  let matched_moods = new Set();
  let matched_situations = new Set();
  let lyrical_keywords = new Set();
  let emotion_intensity = 3;
  let meaning_confidence = 0.6; // Base confidence

  const textToAnalyze = `${song.title} ${song.genre_name || ''} ${song.lyrics || ''}`.toLowerCase();

  // 1. Heartbreak Check
  const isHeartbreak = heartbreakKeywords.some(kw => {
    if (textToAnalyze.includes(kw)) { lyrical_keywords.add(kw); return true; }
    return false;
  });

  if (isHeartbreak) {
    main_theme = 'heartbreak';
    ['sad', 'emotional', 'melancholic'].forEach(t => matched_moods.add(t));
    ['night', 'rain', 'alone', 'breakup'].forEach(t => matched_situations.add(t));
    matchedRule = 'heartbreak_keywords';
    emotion_intensity = 4;
    meaning_confidence += 0.15;
  }

  // 2. Party / High Energy Check
  const isParty = partyKeywords.some(kw => {
    if (textToAnalyze.includes(kw)) { lyrical_keywords.add(kw); return true; }
    return false;
  });
  
  if (!isHeartbreak && (isParty || song.tempo > 120)) {
    main_theme = 'party';
    ['energetic', 'happy', 'confident'].forEach(t => matched_moods.add(t));
    ['gym', 'party', 'friends'].forEach(t => matched_situations.add(t));
    matchedRule = 'party_or_high_tempo';
    emotion_intensity = 4;
    if (isParty) meaning_confidence += 0.1;
  }

  // 3. Chill / Acoustic Check
  const isChill = chillKeywords.some(kw => {
    if (textToAnalyze.includes(kw)) { lyrical_keywords.add(kw); return true; }
    return false;
  });

  if (!isHeartbreak && !isParty && (isChill || (song.tempo > 0 && song.tempo < 90))) {
    ['chill', 'calm', 'dreamy'].forEach(t => matched_moods.add(t));
    ['study', 'work', 'relax', 'night'].forEach(t => matched_situations.add(t));
    matchedRule = 'chill_or_low_tempo';
    emotion_intensity = 2;
    if (isChill) meaning_confidence += 0.1;
  }

  // 4. Nostalgia Check
  const isNostalgia = nostalgiaKeywords.some(kw => {
    if (textToAnalyze.includes(kw)) { lyrical_keywords.add(kw); return true; }
    return false;
  });

  if (!isParty && isNostalgia) {
    main_theme = 'nostalgia';
    ['nostalgic', 'emotional'].forEach(t => matched_moods.add(t));
    ['relax', 'alone', 'night'].forEach(t => matched_situations.add(t));
    matchedRule = 'nostalgia_keywords';
    emotion_intensity = 3;
    meaning_confidence += 0.1;
  }

  // Generate Vietnamese Summary
  let summary_vi = 'Bài hát có giai điệu và ca từ mang nhiều cảm xúc, phù hợp để nghe trong nhiều hoàn cảnh.';
  if (main_theme === 'heartbreak') {
    summary_vi = 'Bài hát mang màu sắc buồn và giàu cảm xúc, phù hợp với những lúc nghe nhạc một mình hoặc trong không gian yên tĩnh.';
  } else if (main_theme === 'party') {
    summary_vi = 'Một ca khúc mang năng lượng tích cực, sôi động, rất hợp để khuấy động không khí hoặc khi tập luyện thể thao.';
  } else if (main_theme === 'nostalgia') {
    summary_vi = 'Giai điệu mang âm hưởng hoài niệm, gợi nhắc những kỷ niệm cũ, thích hợp để thư giãn và suy ngẫm.';
  } else if (matched_moods.has('chill')) {
    summary_vi = 'Bài hát có nhịp điệu chậm rãi, nhẹ nhàng, là lựa chọn lý tưởng khi bạn cần tập trung làm việc hoặc thư giãn.';
  }

  return {
    summary_vi,
    main_theme,
    sub_themes: [],
    mood_tags: Array.from(matched_moods).slice(0, 3), // Max 3 moods
    situation_tags: Array.from(matched_situations).slice(0, 3), // Max 3 situations
    lyrical_keywords: Array.from(lyrical_keywords).slice(0, 5), // Max 5 keywords
    emotion_intensity,
    meaning_confidence: Math.min(meaning_confidence, 0.99), // Cap at 0.99
    source: 'rule_based',
    matchedRule
  };
}

// Generate reports
function generatePreview(results) {
  const datasetDir = path.resolve(__dirname, '../../../../datasets/processed');
  if (!fs.existsSync(datasetDir)) {
    fs.mkdirSync(datasetDir, { recursive: true });
  }

  const csvPath = path.join(datasetDir, 'song_semantic_profiles_preview.csv');
  const jsonPath = path.join(datasetDir, 'song_semantic_profiles_summary.json');

  let csvContent = 'song_id,title,artist,genre,main_theme,mood_tags,situation_tags,emotion_intensity,meaning_confidence,summary_vi,source\n';
  
  const themeDistribution = {};
  const moodDistribution = {};
  const situationDistribution = {};
  let totalConfidence = 0;
  let skippedCount = 0;

  results.forEach(r => {
    if (r.skipped) {
      skippedCount++;
      return;
    }
    
    const moods = r.mood_tags.join(';');
    const situations = r.situation_tags.join(';');
    // Escape quotes in strings
    const cleanTitle = (r.song.title || '').replace(/"/g, '""');
    const cleanArtist = (r.song.artist_name || '').replace(/"/g, '""');
    const cleanSummary = (r.summary_vi || '').replace(/"/g, '""');
    
    csvContent += `${r.song_id},"${cleanTitle}","${cleanArtist}",${r.song.genre_name || ''},${r.main_theme},${moods},${situations},${r.emotion_intensity},${r.meaning_confidence},"${cleanSummary}",${r.source}\n`;

    // Stats
    themeDistribution[r.main_theme] = (themeDistribution[r.main_theme] || 0) + 1;
    r.mood_tags.forEach(m => moodDistribution[m] = (moodDistribution[m] || 0) + 1);
    r.situation_tags.forEach(s => situationDistribution[s] = (situationDistribution[s] || 0) + 1);
    totalConfidence += r.meaning_confidence;
  });

  fs.writeFileSync(csvPath, csvContent, 'utf-8');

  const processedCount = results.filter(r => !r.skipped).length;
  
  const summaryJson = {
    total_processed: results.length,
    inserted: results.filter(r => r.action === 'inserted').length,
    updated: results.filter(r => r.action === 'updated').length,
    skipped: skippedCount,
    theme_distribution: themeDistribution,
    mood_distribution: moodDistribution,
    situation_distribution: situationDistribution,
    average_confidence: processedCount > 0 ? Number((totalConfidence / processedCount).toFixed(2)) : 0
  };

  fs.writeFileSync(jsonPath, JSON.stringify(summaryJson, null, 2), 'utf-8');

  return { csvPath, jsonPath, summaryJson };
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS count
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `,
    [tableName]
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const onlyMissing = args.includes('--only-missing');
  const force = args.includes('--force');
  const useLlm = args.includes('--use-llm');
  
  let limit = 500;
  let targetSongId = null;

  args.forEach(arg => {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    }
    if (arg.startsWith('--song-id=')) {
      targetSongId = parseInt(arg.split('=')[1], 10);
    }
  });

  console.log('--- GENERATE SONG SEMANTIC PROFILES ---');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (No DB changes)' : 'EXECUTE'}`);
  console.log(`Limit: ${limit}`);
  console.log(`Use LLM: ${useLlm ? 'Yes (Unsupported in this version yet)' : 'No (Rule-based)'}`);
  console.log(`Force Update: ${force ? 'Yes' : 'No'}`);
  console.log(`Only Missing: ${onlyMissing ? 'Yes' : 'No'}`);
  if (targetSongId) console.log(`Target Song ID: ${targetSongId}`);
  
  try {
    // 1. Determine existing profiles
    const semanticTableExists = await tableExists('song_semantic_profiles');
    let existingProfileIds = new Set();

    if (semanticTableExists) {
      const [existingRows] = await pool.query('SELECT song_id FROM song_semantic_profiles');
      existingRows.forEach(r => existingProfileIds.add(Number(r.song_id)));
    } else if (isDryRun) {
      console.warn('[WARN] Table song_semantic_profiles does not exist yet. Continuing dry-run without existing-profile check.');
    } else {
      throw new Error('Table song_semantic_profiles does not exist. Please apply migration database/migrations/add_song_semantic_profiles.sql before running without --dry-run.');
    }

    // 2. Query top songs
    let query = `
      SELECT
        s.id, s.title, a.name as artist_name, s.tempo, s.lyrics, s.play_count,
        g.name as genre_name,
        (s.play_count * 1) + 
        (COALESCE(lh.listen_count, 0) * 3) + 
        (COALESCE(sl.like_count, 0) * 5) + 
        (CASE WHEN s.lyrics IS NOT NULL THEN 100 ELSE 0 END) AS song_score
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN (SELECT song_id, COUNT(*) as listen_count FROM listening_history GROUP BY song_id) lh ON s.id = lh.song_id
      LEFT JOIN (SELECT song_id, COUNT(*) as like_count FROM song_likes GROUP BY song_id) sl ON s.id = sl.song_id
      WHERE 1=1
    `;
    const queryParams = [];

    if (targetSongId) {
      query += ` AND s.id = ?`;
      queryParams.push(targetSongId);
    }

    if (onlyMissing) {
      if (existingProfileIds.size > 0) {
        query += ` AND s.id NOT IN (?)`;
        queryParams.push(Array.from(existingProfileIds));
      }
    }

    query += ` ORDER BY song_score DESC LIMIT ?`;
    queryParams.push(limit);

    console.log('\nQuerying database for songs...');
    const [songs] = await pool.query(query, queryParams);
    
    console.log(`Found ${songs.length} songs to process.`);

    const results = [];
    let sampleCounter = 0;

    for (const song of songs) {
      const hasExisting = existingProfileIds.has(song.id);
      
      if (hasExisting && !force && !isDryRun) {
        results.push({ song_id: song.id, skipped: true, action: 'skipped', reason: 'Already exists and --force not provided' });
        continue;
      }

      // Generate Rule-based Profile
      const profile = extractRuleBasedSemantic(song);
      
      const action = hasExisting ? 'updated' : 'inserted';
      
      if (isDryRun && sampleCounter < 10) {
        console.log(`\n[DRY RUN SAMPLE] Song ID: ${song.id} - ${song.title} (${song.artist_name})`);
        console.log(`- Rule Matched: ${profile.matchedRule}`);
        console.log(`- Main Theme: ${profile.main_theme}`);
        console.log(`- Mood Tags: ${profile.mood_tags.join(', ')}`);
        console.log(`- Situation Tags: ${profile.situation_tags.join(', ')}`);
        console.log(`- Summary: ${profile.summary_vi}`);
        sampleCounter++;
      }

      if (!isDryRun) {
        if (action === 'inserted') {
           await pool.query(`
             INSERT INTO song_semantic_profiles (
               song_id, summary_vi, main_theme, sub_themes, mood_tags, situation_tags, lyrical_keywords, emotion_intensity, meaning_confidence, source, generated_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           `, [
             song.id, profile.summary_vi, profile.main_theme, JSON.stringify(profile.sub_themes), JSON.stringify(profile.mood_tags), JSON.stringify(profile.situation_tags), JSON.stringify(profile.lyrical_keywords), profile.emotion_intensity, profile.meaning_confidence, profile.source, 'script'
           ]);
        } else {
           await pool.query(`
             UPDATE song_semantic_profiles SET
               summary_vi = ?, main_theme = ?, sub_themes = ?, mood_tags = ?, situation_tags = ?, lyrical_keywords = ?, emotion_intensity = ?, meaning_confidence = ?, source = ?, generated_by = ?
             WHERE song_id = ?
           `, [
             profile.summary_vi, profile.main_theme, JSON.stringify(profile.sub_themes), JSON.stringify(profile.mood_tags), JSON.stringify(profile.situation_tags), JSON.stringify(profile.lyrical_keywords), profile.emotion_intensity, profile.meaning_confidence, profile.source, 'script', song.id
           ]);
        }
      }

      results.push({ 
        song_id: song.id, 
        song,
        skipped: false,
        action,
        ...profile
      });
    }

    console.log('\nGenerating export preview...');
    const report = generatePreview(results);
    
    console.log('\n--- SUMMARY ---');
    console.log(`Total Processed: ${report.summaryJson.total_processed}`);
    console.log(`Inserted: ${report.summaryJson.inserted}`);
    console.log(`Updated: ${report.summaryJson.updated}`);
    console.log(`Skipped: ${report.summaryJson.skipped}`);
    console.log(`Average Confidence: ${report.summaryJson.average_confidence}`);
    console.log(`Reports saved to: ${path.dirname(report.csvPath)}`);

  } catch (err) {
    console.error('Error executing script:', err);
  } finally {
    process.exit(0);
  }
}

run();
