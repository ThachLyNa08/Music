const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { pool } = require('../../src/config/database');

function getArg(name, defaultValue = null) {
    const arg = process.argv.find((item) => item.startsWith(`--${name}`));
    if (!arg) return defaultValue;
    if (arg.includes('=')) return arg.split('=')[1];
    return true; // flag without value
}

async function getTableColumns(tableName) {
    try {
        const [rows] = await pool.query(`SHOW COLUMNS FROM ??`, [tableName]);
        return rows.map(r => r.Field);
    } catch (e) {
        return [];
    }
}

async function main() {
    const inputArg = getArg('input');
    const isApply = getArg('apply') === true;
    const isDryRun = !isApply || getArg('dry-run') === true;
    const limit = parseInt(getArg('limit', 0)) || 0;

    if (!inputArg) {
        console.error("Missing --input=<path> argument.");
        process.exit(1);
    }

    const inputPath = path.resolve(__dirname, '../../', inputArg);
    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    console.log(`--- IMPORT SONG SEMANTIC PROFILES ---`);
    console.log(`Input: ${inputPath}`);
    console.log(`Mode: ${isDryRun ? 'DRY-RUN' : 'APPLY (DB WRITE)'}`);
    if (limit > 0) console.log(`Limit: ${limit}`);
    console.log(`-------------------------------------`);

    // Verify DB columns
    const columns = await getTableColumns('song_semantic_profiles');
    if (columns.length === 0) {
        console.error(`Error: Table 'song_semantic_profiles' does not exist in DB.`);
        process.exit(1);
    }
    const hasEvidenceLevel = columns.includes('evidence_level');
    const hasReviewStatus = columns.includes('review_status');

    if (!hasEvidenceLevel || !hasReviewStatus) {
        console.log(`[WARNING] Table 'song_semantic_profiles' is missing 'evidence_level' or 'review_status'. They will be skipped in DB query.`);
    }

    const requiredCsvColumns = [
        'song_id', 'summary_vi', 'main_theme', 'mood_tags', 'situation_tags',
        'lyrical_keywords', 'emotion_intensity', 'meaning_confidence',
        'semantic_text', 'source', 'generated_by', 'evidence_level'
    ];

    const results = [];
    let headersValidated = false;

    fs.createReadStream(inputPath)
        .pipe(csv())
        .on('headers', (headers) => {
            const missing = requiredCsvColumns.filter(c => !headers.includes(c));
            if (missing.length > 0) {
                console.error(`Error: CSV is missing required columns: ${missing.join(', ')}`);
                process.exit(1);
            }
            headersValidated = true;
        })
        .on('data', (data) => {
            if (limit > 0 && results.length >= limit) return;
            results.push(data);
        })
        .on('end', async () => {
            if (!headersValidated) {
                console.error("Failed to read CSV headers.");
                process.exit(1);
            }

            console.log(`Total rows read from CSV: ${results.length}`);

            let validCount = 0;
            let skipCount = 0;
            let needsReviewCount = 0;
            const themeDist = {};
            const evidenceDist = {};
            let minConf = 1.0, maxConf = 0.0, sumConf = 0.0;
            
            const recordsToUpsert = [];

            for (const row of results) {
                if (!row.song_id || isNaN(parseInt(row.song_id))) {
                    skipCount++;
                    continue;
                }

                // Parse arrays
                const mood_tags = row.mood_tags ? JSON.stringify(row.mood_tags.split(';').map(s => s.trim()).filter(Boolean)) : '[]';
                const situation_tags = row.situation_tags ? JSON.stringify(row.situation_tags.split(';').map(s => s.trim()).filter(Boolean)) : '[]';
                const lyrical_keywords = row.lyrical_keywords ? JSON.stringify(row.lyrical_keywords.split(';').map(s => s.trim()).filter(Boolean)) : '[]';
                const sub_themes = row.sub_themes ? JSON.stringify(row.sub_themes.split(';').map(s => s.trim()).filter(Boolean)) : '[]';

                const emotion_intensity = parseInt(row.emotion_intensity) || 3;
                const meaning_confidence = parseFloat(row.meaning_confidence) || 0.0;

                // Distribution stats
                themeDist[row.main_theme] = (themeDist[row.main_theme] || 0) + 1;
                evidenceDist[row.evidence_level] = (evidenceDist[row.evidence_level] || 0) + 1;
                minConf = Math.min(minConf, meaning_confidence);
                maxConf = Math.max(maxConf, meaning_confidence);
                sumConf += meaning_confidence;

                // Review status logic
                let review_status = 'auto';
                if (meaning_confidence < 0.50) {
                    review_status = 'needs_review';
                } else if (row.evidence_level === 'metadata_only' && meaning_confidence < 0.58) {
                    review_status = 'needs_review';
                } else if (row.main_theme === 'life_reflection' && row.evidence_level === 'metadata_only') {
                    review_status = 'needs_review';
                }

                if (review_status === 'needs_review') {
                    needsReviewCount++;
                }

                const record = {
                    song_id: parseInt(row.song_id),
                    summary_vi: row.summary_vi || null,
                    main_theme: row.main_theme || null,
                    sub_themes,
                    mood_tags,
                    situation_tags,
                    lyrical_keywords,
                    emotion_intensity,
                    meaning_confidence,
                    semantic_text: row.semantic_text || row.summary_vi || null,
                    source: row.source || 'rule_based',
                    generated_by: row.generated_by || 'local_semantic_pipeline',
                };

                if (hasEvidenceLevel) record.evidence_level = row.evidence_level;
                if (hasReviewStatus) record.review_status = review_status;

                recordsToUpsert.push(record);
                validCount++;
            }

            console.log(`Rows valid: ${validCount}`);
            console.log(`Rows skipped: ${skipCount}`);
            console.log(`Rows would be needs_review: ${needsReviewCount}`);

            if (validCount > 0) {
                console.log(`\nTheme distribution:`, themeDist);
                console.log(`Evidence distribution:`, evidenceDist);
                console.log(`Confidence: min=${minConf.toFixed(2)} / avg=${(sumConf/validCount).toFixed(2)} / max=${maxConf.toFixed(2)}`);

                console.log(`\nSample rows (first 5):`);
                recordsToUpsert.slice(0, 5).forEach(r => {
                    console.log(`- ID: ${r.song_id} | Theme: ${r.main_theme} | Conf: ${r.meaning_confidence} | Review: ${r.review_status || 'N/A (not in DB)'} | Evid: ${r.evidence_level || 'N/A (not in DB)'}`);
                });
            }

            if (isDryRun) {
                console.log(`\n[DRY-RUN] Finished. No data written to DB.`);
                process.exit(0);
            }

            // Apply to DB
            console.log(`\n[APPLY] Upserting to database...`);
            let insertCount = 0;
            let updateCount = 0;

            for (const record of recordsToUpsert) {
                const keys = Object.keys(record);
                const values = Object.values(record);
                
                const placeholders = keys.map(() => '?').join(', ');
                const updates = keys.map(k => `\`${k}\` = VALUES(\`${k}\`)`).join(', ');

                const query = `
                    INSERT INTO song_semantic_profiles (${keys.map(k => `\`${k}\``).join(', ')})
                    VALUES (${placeholders})
                    ON DUPLICATE KEY UPDATE ${updates}
                `;

                try {
                    const [result] = await pool.query(query, values);
                    if (result.insertId) {
                        insertCount++;
                    } else {
                        updateCount++; // Technically affectedRows = 2 for update in mysql ON DUPLICATE KEY
                    }
                } catch (err) {
                    console.error(`Error upserting song_id ${record.song_id}:`, err.message);
                }
            }

            console.log(`\n[APPLY] Finished.`);
            console.log(`Rows inserted/updated: ${recordsToUpsert.length}`);
            // Note: MySQL ON DUPLICATE KEY affectedRows logic makes exact insert vs update count tricky without 2 queries.
            process.exit(0);
        });
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
