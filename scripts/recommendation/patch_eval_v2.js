const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, 'evaluateRecommendationAlgorithms.js');
let code = fs.readFileSync(targetFile, 'utf8');

// 1. Args
code = code.replace(
  `const SAMPLE_USERS = SAMPLE_MODE ? (parseInt(args['sample-users'] || '50', 10) || 50) : null;`,
  `const SAMPLE_USERS = SAMPLE_MODE ? (parseInt(args['sample-users'] || '50', 10) || 50) : null;
const INCLUDE_SEMANTIC = !!args['include-semantic'];
const IS_FINAL = !!args['final'];
const OUTPUT_SUFFIX = args['output-suffix'] ? \`_\${args['output-suffix']}\` : '';`
);

// 2. Constants CB_WEIGHTS
code = code.replace(
  `const CB_WEIGHTS = {
  market: 0.20, genre: 0.20, artist: 0.10,
  bpm: 0.05, energy_score: 0.05, danceability: 0.10,
  acoustic_score: 0.05, brightness: 0.05,
  mood: 0.10, vibe: 0.10,
};`,
  `const CB_WEIGHTS = {
  market: 0.20, genre: 0.20, artist: 0.10,
  bpm: 0.05, energy_score: 0.05, danceability: 0.10,
  acoustic_score: 0.05, brightness: 0.05,
  mood: 0.10, vibe: 0.10,
};

const CB_SEMANTIC_WEIGHTS = {
  market: 0.10, genre: 0.10, artist: 0.05,
  bpm: 0.05, energy_score: 0.05, danceability: 0.05,
  acoustic_score: 0.05, brightness: 0.05,
  mood: 0.05, vibe: 0.05,
  semantic_theme: 0.15, semantic_mood: 0.15, semantic_situation: 0.10,
};`
);

// 3. loadSongCatalog
code = code.replace(
  `const audioJoin = hasAudio ? 'LEFT JOIN song_audio_features saf ON saf.song_id = s.id' : '';`,
  `const audioJoin = hasAudio ? 'LEFT JOIN song_audio_features saf ON saf.song_id = s.id' : '';
  const hasSemantic = INCLUDE_SEMANTIC && await tableExists('song_semantic_profiles');
  const semanticSelect = hasSemantic ? [
    'ssp.main_theme', 'ssp.mood_tags', 'ssp.situation_tags', 'ssp.meaning_confidence',
    'ssp.evidence_level', 'ssp.review_status'
  ] : [
    'NULL AS main_theme', 'NULL AS mood_tags', 'NULL AS situation_tags', 'NULL AS meaning_confidence',
    'NULL AS evidence_level', 'NULL AS review_status'
  ];
  const semanticJoin = hasSemantic ? 'LEFT JOIN song_semantic_profiles ssp ON ssp.song_id = s.id' : '';`
);

code = code.replace(
  `SELECT \${[...songSelect, ...audioSelect].join(', ')}`,
  `SELECT \${[...songSelect, ...audioSelect, ...semanticSelect].join(', ')}`
);

code = code.replace(
  `FROM songs s
    \${audioJoin}`,
  `FROM songs s
    \${audioJoin}
    \${semanticJoin}`
);

code = code.replace(
  `vibe: row.vibe || null,
    });`,
  `vibe: row.vibe || null,
      main_theme: row.main_theme || null,
      mood_tags: row.mood_tags ? (typeof row.mood_tags === 'string' ? JSON.parse(row.mood_tags) : row.mood_tags) : [],
      situation_tags: row.situation_tags ? (typeof row.situation_tags === 'string' ? JSON.parse(row.situation_tags) : row.situation_tags) : [],
      meaning_confidence: row.meaning_confidence !== null && row.meaning_confidence !== undefined ? Number(row.meaning_confidence) : 0,
      evidence_level: row.evidence_level || 'unknown',
      review_status: row.review_status || 'unknown',
    });`
);

// 4. buildContentProfile
code = code.replace(
  `const vibeCounts = new Map();`,
  `const vibeCounts = new Map();
  const themeCounts = new Map();
  const semanticMoodCounts = new Map();
  const situationCounts = new Map();`
);

code = code.replace(
  `if (song.vibe) vibeCounts.set(song.vibe, (vibeCounts.get(song.vibe) || 0) + 1);`,
  `if (song.vibe) vibeCounts.set(song.vibe, (vibeCounts.get(song.vibe) || 0) + 1);
    if (song.main_theme) themeCounts.set(song.main_theme, (themeCounts.get(song.main_theme) || 0) + 1);
    if (Array.isArray(song.mood_tags)) song.mood_tags.forEach(t => semanticMoodCounts.set(t, (semanticMoodCounts.get(t) || 0) + 1));
    if (Array.isArray(song.situation_tags)) song.situation_tags.forEach(t => situationCounts.set(t, (situationCounts.get(t) || 0) + 1));`
);

code = code.replace(
  `vibe_counts: Object.fromEntries(vibeCounts.entries()),`,
  `vibe_counts: Object.fromEntries(vibeCounts.entries()),
    theme_counts: Object.fromEntries(themeCounts.entries()),
    semantic_mood_counts: Object.fromEntries(semanticMoodCounts.entries()),
    situation_counts: Object.fromEntries(situationCounts.entries()),`
);

// 5. scoreContentBased
code = code.replace(
  `function scoreContentBased(song, profile) {`,
  `function scoreContentBased(song, profile, useSemantic = false) {
  const WEIGHTS = useSemantic ? CB_SEMANTIC_WEIGHTS : CB_WEIGHTS;`
);

// Replace CB_WEIGHTS with WEIGHTS inside scoreContentBased. This is a bit tricky, I'll use regex for that specific block.
const scbStart = code.indexOf(`function scoreContentBased(song, profile, useSemantic = false) {`);
const scbEnd = code.indexOf(`return { total: weightedSum / totalWeight, components };`, scbStart) + 60;
let scbBlock = code.substring(scbStart, scbEnd);
scbBlock = scbBlock.replace(/CB_WEIGHTS/g, 'WEIGHTS');
code = code.substring(0, scbStart) + scbBlock + code.substring(scbEnd);

code = code.replace(
  `if (totalWeight === 0) return { total: 0, components };`,
  `if (useSemantic) {
    if (profile.theme_counts && song.main_theme) {
      const total = Object.values(profile.theme_counts).reduce((s, v) => s + v, 0);
      const match = profile.theme_counts[song.main_theme] || 0;
      if (total > 0) {
        components.semantic_theme = match / total;
        totalWeight += WEIGHTS.semantic_theme || 0;
      }
    }
    if (profile.semantic_mood_counts && Array.isArray(song.mood_tags) && song.mood_tags.length > 0) {
      const total = Object.values(profile.semantic_mood_counts).reduce((s, v) => s + v, 0);
      let match = 0;
      for (const t of song.mood_tags) match += profile.semantic_mood_counts[t] || 0;
      if (total > 0) {
        components.semantic_mood = match / total;
        totalWeight += WEIGHTS.semantic_mood || 0;
      }
    }
    if (profile.situation_counts && Array.isArray(song.situation_tags) && song.situation_tags.length > 0) {
      const total = Object.values(profile.situation_counts).reduce((s, v) => s + v, 0);
      let match = 0;
      for (const t of song.situation_tags) match += profile.situation_counts[t] || 0;
      if (total > 0) {
        components.semantic_situation = match / total;
        totalWeight += WEIGHTS.semantic_situation || 0;
      }
    }
  }

  if (totalWeight === 0) return { total: 0, components };`
);

// 6. buildHybrid
code = code.replace(
  `function buildHybrid(bprData, userSplit, contentProfile, songById, popularScores) {`,
  `function buildHybrid(bprData, userSplit, contentProfile, songById, popularScores, useSemantic = false) {`
);

code = code.replace(
  `const cb = scoreContentBased(song, profile);`,
  `const cb = scoreContentBased(song, profile, useSemantic);`
);

code = code.replace(
  `// Context mood score
    let contextScore = 0.5;`,
  `// Context mood score
    let contextScore = 0.5;
    if (useSemantic && Array.isArray(song.mood_tags)) {
       // Enhance context score if it has a semantic mood tag that matches the intent (topMood)
       // Or if confidence is high, bump the base contextScore
       if (song.mood_tags.some(t => String(t).toLowerCase().includes(topMood.toLowerCase()))) {
           contextScore = 0.9;
       } else if (song.meaning_confidence > 0.7) {
           contextScore = Math.max(0.6, contextScore); // Better semantic profile = higher baseline context match
       }
    }`
);

// 7. getRecommendations
code = code.replace(
  `if (method === 'content_based') {
    for (const song of songById.values()) {
      if (trainSet.has(song.id)) continue;
      const { total, components } = scoreContentBased(song, contentProfile);`,
  `if (method === 'content_based' || method === 'content_based_semantic') {
    const useSemantic = method === 'content_based_semantic';
    for (const song of songById.values()) {
      if (trainSet.has(song.id)) continue;
      const { total, components } = scoreContentBased(song, contentProfile, useSemantic);`
);

code = code.replace(
  `if (method === 'hybrid') {
    const hybridScorer = buildHybrid(bprData, userSplit, contentProfile, songById, popularScores);`,
  `if (method === 'hybrid' || method === 'hybrid_semantic') {
    const useSemantic = method === 'hybrid_semantic';
    const hybridScorer = buildHybrid(bprData, userSplit, contentProfile, songById, popularScores, useSemantic);`
);

// 8. evaluateUser
code = code.replace(
  `const algs = ['most_popular', 'content_based', 'bpr_mf', 'hybrid'];`,
  `const algs = typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC 
      ? ['most_popular', 'content_based_semantic', 'bpr_mf', 'hybrid_semantic']
      : ['most_popular', 'content_based', 'bpr_mf', 'hybrid'];`
);

code = code.replace(
  `const ranking = recs.map((r) => r.sid);`,
  `// Semantic Metrics Tracking
    let semanticAttachedCount = 0;
    let lyricsBasedCount = 0;
    let metadataOnlyCount = 0;
    let needsReviewCount = 0;
    let semanticConfidenceSum = 0;
    let moodMatchCount = 0;
    const topMood = contentProfile.top_mood || 'energetic';

    for (const rec of top20recs) {
      const song = songById.get(rec.sid);
      if (song) {
        if (song.main_theme || song.meaning_confidence > 0) semanticAttachedCount++;
        if (song.evidence_level === 'lyrics_based' || song.evidence_level === 'hybrid') lyricsBasedCount++;
        if (song.evidence_level === 'metadata_only') metadataOnlyCount++;
        if (song.review_status === 'needs_review') needsReviewCount++;
        semanticConfidenceSum += song.meaning_confidence || 0;
        if (Array.isArray(song.mood_tags) && song.mood_tags.some(t => String(t).toLowerCase().includes(topMood.toLowerCase()))) {
            moodMatchCount++;
        } else if (song.mood && song.mood.toLowerCase().includes(topMood.toLowerCase())) {
            moodMatchCount++; // fallback to audio mood
        }
      }
    }

    const ranking = recs.map((r) => r.sid);`
);

code = code.replace(
  `avg_score: top20recs.length ? round(top20recs.reduce((s, r) => s + r.score, 0) / top20recs.length, 4) : 0,
    };`,
  `avg_score: top20recs.length ? round(top20recs.reduce((s, r) => s + r.score, 0) / top20recs.length, 4) : 0,
      
      // Semantic quality metrics
      semantic_attached_rate: top20recs.length ? round(semanticAttachedCount / top20recs.length, 4) : 0,
      lyrics_based_rate: top20recs.length ? round(lyricsBasedCount / top20recs.length, 4) : 0,
      metadata_only_rate: top20recs.length ? round(metadataOnlyCount / top20recs.length, 4) : 0,
      needs_review_rate: top20recs.length ? round(needsReviewCount / top20recs.length, 4) : 0,
      avg_semantic_confidence: top20recs.length ? round(semanticConfidenceSum / top20recs.length, 4) : 0,
      mood_match_rate: top20recs.length ? round(moodMatchCount / top20recs.length, 4) : 0,
    };`
);

// 9. Aggregation in main()
code = code.replace(
  `const algs = ['most_popular', 'content_based', 'bpr_mf', 'hybrid'];
  const algLabels = { most_popular: 'Most Popular', content_based: 'Content-Based Audio', bpr_mf: 'BPR-MF', hybrid: 'Hybrid Context-Aware' };`,
  `const algs = typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC 
      ? ['most_popular', 'content_based', 'content_based_semantic', 'bpr_mf', 'hybrid', 'hybrid_semantic']
      : ['most_popular', 'content_based', 'bpr_mf', 'hybrid'];
  const algLabels = { 
      most_popular: 'Most Popular', 
      content_based: 'Content-Based Audio', 
      content_based_semantic: 'Content-Based + Semantic',
      bpr_mf: 'BPR-MF', 
      hybrid: 'Hybrid Context-Aware',
      hybrid_semantic: 'Hybrid + Semantic'
  };`
);

code = code.replace(
  `agg.avg_score = round(vals.reduce((s, v) => s + (v.avg_score || 0), 0) / vals.length, 4);
    agg.users_evaluated = vals.length;
    return agg;`,
  `agg.avg_score = round(vals.reduce((s, v) => s + (v.avg_score || 0), 0) / vals.length, 4);
    
    // Semantic metrics aggregation
    agg.semantic_attached_rate = round(vals.reduce((s, v) => s + (v.semantic_attached_rate || 0), 0) / vals.length, 4);
    agg.lyrics_based_rate = round(vals.reduce((s, v) => s + (v.lyrics_based_rate || 0), 0) / vals.length, 4);
    agg.metadata_only_rate = round(vals.reduce((s, v) => s + (v.metadata_only_rate || 0), 0) / vals.length, 4);
    agg.needs_review_rate = round(vals.reduce((s, v) => s + (v.needs_review_rate || 0), 0) / vals.length, 4);
    agg.avg_semantic_confidence = round(vals.reduce((s, v) => s + (v.avg_semantic_confidence || 0), 0) / vals.length, 4);
    agg.mood_match_rate = round(vals.reduce((s, v) => s + (v.mood_match_rate || 0), 0) / vals.length, 4);
    
    agg.users_evaluated = vals.length;
    return agg;`
);

code = code.replace(
  `agg.avg_score = round(vals.reduce((s, v) => s + (v.avg_score || 0), 0) / vals.length, 4);
      agg.users_evaluated = vals.length;
      groupAgg[alg] = { label: algLabels[alg], ...agg };`,
  `agg.avg_score = round(vals.reduce((s, v) => s + (v.avg_score || 0), 0) / vals.length, 4);
      agg.semantic_attached_rate = round(vals.reduce((s, v) => s + (v.semantic_attached_rate || 0), 0) / vals.length, 4);
      agg.lyrics_based_rate = round(vals.reduce((s, v) => s + (v.lyrics_based_rate || 0), 0) / vals.length, 4);
      agg.metadata_only_rate = round(vals.reduce((s, v) => s + (v.metadata_only_rate || 0), 0) / vals.length, 4);
      agg.needs_review_rate = round(vals.reduce((s, v) => s + (v.needs_review_rate || 0), 0) / vals.length, 4);
      agg.avg_semantic_confidence = round(vals.reduce((s, v) => s + (v.avg_semantic_confidence || 0), 0) / vals.length, 4);
      agg.mood_match_rate = round(vals.reduce((s, v) => s + (v.mood_match_rate || 0), 0) / vals.length, 4);
      agg.users_evaluated = vals.length;
      groupAgg[alg] = { label: algLabels[alg], ...agg };`
);

// 10. Update chart outputs
code = code.replace(
  `function writeRecommendationCharts(metricsByAlg, bprData) {`,
  `function writeRecommendationCharts(metricsByAlg, bprData) {
  const S = typeof OUTPUT_SUFFIX !== 'undefined' ? OUTPUT_SUFFIX : '';`
);

code = code.replace(
  `const lossPath = path.join(CHART_DIR, 'bpr_training_loss.png');`,
  `const lossPath = path.join(CHART_DIR, \`bpr_training_loss\${S}.png\`);`
);
code = code.replace(
  `const accPath = path.join(CHART_DIR, 'bpr_pairwise_accuracy.png');`,
  `const accPath = path.join(CHART_DIR, \`bpr_pairwise_accuracy\${S}.png\`);`
);

code = code.replace(
  `const metricsPath = path.join(CHART_DIR, 'recommendation_metrics_comparison.png');`,
  `const metricsPath = path.join(CHART_DIR, S ? \`\${S.replace(/^_/, '')}_top10_metrics.png\` : 'recommendation_metrics_comparison.png');`
);

code = code.replace(
  `const coveragePath = path.join(CHART_DIR, 'recommendation_coverage_diversity.png');`,
  `const coveragePath = path.join(CHART_DIR, S ? \`\${S.replace(/^_/, '')}_coverage_diversity.png\` : 'recommendation_coverage_diversity.png');`
);

code = code.replace(
  `const globalCoveragePath = path.join(CHART_DIR, 'recommendation_global_coverage.png');`,
  `// Semantic quality chart
  if (typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC) {
      const semanticQualityPath = path.join(CHART_DIR, S ? \`\${S.replace(/^_/, '')}_semantic_quality_distribution.png\` : 'semantic_quality_distribution.png');
      writeGroupedBarChart(semanticQualityPath, 'SEMANTIC QUALITY METRICS', metricsByAlg, [
          { key: 'semantic_attached_rate', label: 'ATTACHED' },
          { key: 'lyrics_based_rate', label: 'LYRICS BASED' },
          { key: 'metadata_only_rate', label: 'META ONLY' },
          { key: 'needs_review_rate', label: 'NEEDS REVIEW' },
          { key: 'avg_semantic_confidence', label: 'AVG CONF' },
      ], { maxValue: 1.0 });
      chartPaths.push(semanticQualityPath);

      const moodMatchPath = path.join(CHART_DIR, S ? \`\${S.replace(/^_/, '')}_contextual_mood_match.png\` : 'contextual_mood_match.png');
      writeGroupedBarChart(moodMatchPath, 'CONTEXTUAL MOOD MATCH RATE', metricsByAlg, [
          { key: 'mood_match_rate', label: 'MOOD MATCH' },
      ], { maxValue: 1.0 });
      chartPaths.push(moodMatchPath);
      
      const pndcgPath = path.join(CHART_DIR, S ? \`\${S.replace(/^_/, '')}_precision_ndcg.png\` : 'precision_ndcg_at_10.png');
      writeGroupedBarChart(pndcgPath, 'PRECISION AND NDCG AT 10', metricsByAlg, [
          { key: 'precision_at_10', label: 'PRECISION@10' },
          { key: 'ndcg_at_10', label: 'NDCG@10' },
      ], { maxValue: 0.6 });
      chartPaths.push(pndcgPath);
  }

  const globalCoveragePath = path.join(CHART_DIR, S ? \`\${S.replace(/^_/, '')}_global_coverage.png\` : 'recommendation_global_coverage.png');`
);
code = code.replace(
  `const artistDiversityPath = path.join(CHART_DIR, 'recommendation_artist_diversity.png');`,
  `const artistDiversityPath = path.join(CHART_DIR, S ? \`\${S.replace(/^_/, '')}_artist_diversity.png\` : 'recommendation_artist_diversity.png');`
);

code = code.replace(
  `const algs = options.algs || ['most_popular', 'content_based', 'bpr_mf', 'hybrid'];
  const labels = options.labels || {
    most_popular: 'MOST POP',
    content_based: 'CONTENT',
    bpr_mf: 'BPR MF',
    hybrid: 'HYBRID',
  };
  const colors = [CHART_COLORS.navy, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.rose, CHART_COLORS.violet];`,
  `const algs = options.algs || (typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC ? ['most_popular', 'content_based_semantic', 'bpr_mf', 'hybrid_semantic'] : ['most_popular', 'content_based', 'bpr_mf', 'hybrid']);
  const labels = options.labels || {
    most_popular: 'MOST POP',
    content_based: 'CONTENT',
    content_based_semantic: 'CB+SEMANTIC',
    bpr_mf: 'BPR MF',
    hybrid: 'HYBRID',
    hybrid_semantic: 'HYBRID+SEM',
  };
  const colors = [CHART_COLORS.navy, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.rose, CHART_COLORS.violet, CHART_COLORS.green];`
);

// Output filenames
code = code.replace(
  `const jsonPath = path.join(OUTPUT_DIR, 'recommendation_evaluation_results.json');`,
  `const jsonPath = path.join(OUTPUT_DIR, typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX ? \`recommendation_\${OUTPUT_SUFFIX.replace(/^_/, '')}_metrics.json\` : 'recommendation_evaluation_results.json');`
);

code = code.replace(
  `const csvPath = path.join(OUTPUT_DIR, 'recommendation_evaluation_results.csv');`,
  `const csvPath = path.join(OUTPUT_DIR, typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX ? \`recommendation_\${OUTPUT_SUFFIX.replace(/^_/, '')}_metrics.csv\` : 'recommendation_evaluation_results.csv');`
);

code = code.replace(
  `const userCsvPath = path.join(OUTPUT_DIR, 'recommendation_evaluation_by_user.csv');`,
  `const userCsvPath = path.join(OUTPUT_DIR, typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX ? \`recommendation_by_user_\${OUTPUT_SUFFIX.replace(/^_/, '')}.csv\` : 'recommendation_evaluation_by_user.csv');`
);

code = code.replace(
  `const samplePath = path.join(OUTPUT_DIR, 'recommendation_sample_outputs.json');`,
  `const samplePath = path.join(OUTPUT_DIR, typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX ? \`recommendation_sample_outputs_\${OUTPUT_SUFFIX.replace(/^_/, '')}.json\` : 'recommendation_sample_outputs.json');`
);

code = code.replace(
  `fs.writeFileSync(samplePath, JSON.stringify({ generated_at: generatedAt, samples: sampleOutputs }, null, 2), 'utf8');
  console.log(\`[Wrote] \${samplePath}\`);`,
  `fs.writeFileSync(samplePath, JSON.stringify({ generated_at: generatedAt, samples: sampleOutputs }, null, 2), 'utf8');
  console.log(\`[Wrote] \${samplePath}\`);

  if (typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX) {
      const metadataPath = path.join(OUTPUT_DIR, \`recommendation_\${OUTPUT_SUFFIX.replace(/^_/, '')}_run_metadata.json\`);
      fs.writeFileSync(metadataPath, JSON.stringify({
          run_name: OUTPUT_SUFFIX.replace(/^_/, ''),
          include_semantic: INCLUDE_SEMANTIC,
          sample_users: SAMPLE_USERS,
          top_k: KS,
          uses_existing_bpr_model: true,
          retrained_bpr: false,
          semantic_profiles_enabled: INCLUDE_SEMANTIC,
          notes: "Final evaluation after integrating song_semantic_profiles"
      }, null, 2), 'utf8');
      console.log(\`[Wrote] \${metadataPath}\`);
  }`
);

fs.writeFileSync(targetFile, code, 'utf8');
console.log("Patched evaluateRecommendationAlgorithms.js successfully!");
