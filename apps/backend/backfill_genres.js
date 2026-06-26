require('dotenv').config();
const mysql = require('mysql2/promise');

const isDryRun = process.argv.includes('--dry-run');

const ROOT_WHITELIST = [
  'vpop', 'v-pop', 'kpop', 'k-pop', 'usuk', 'us-uk',
  'pop', 'rock', 'rnb', 'r&b', 'edm', 'ballad', 'rap', 'hip-hop', 'hiphop', 'jazz', 'classical'
];

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '261999',
    database: process.env.DB_NAME || 'musicflow',
  });

  try {
    console.log(`\n=== TAXONOMY BACKFILL ${isDryRun ? '(DRY-RUN)' : '(EXECUTE)'} ===\n`);

    const [genres] = await pool.query(`
      SELECT g.id, g.name, g.slug, g.status, g.market, g.parent_id,
        (SELECT COUNT(*) FROM songs s WHERE s.genre_id = g.id) as song_count,
        (SELECT COUNT(DISTINCT s.artist_id) FROM songs s WHERE s.genre_id = g.id) as artist_count,
        (SELECT COUNT(*) FROM user_genre_preferences u WHERE u.genre_id = g.id) as pref_count,
        (SELECT COUNT(*) FROM genres child WHERE child.parent_id = g.id) as child_count
      FROM genres g
    `);

    // 1. Find Root Genres IDs for mapping
    const findRootId = (slugPrefixes) => {
      const match = genres.find(g => slugPrefixes.includes(g.slug.toLowerCase()));
      return match ? match.id : null;
    };

    let rootVpopId = findRootId(['vpop', 'v-pop']);
    let rootKpopId = findRootId(['kpop', 'k-pop']);
    let rootUsukId = findRootId(['usuk', 'us-uk']);

    let createdUsukRoot = false;

    // Check if USUK root needs to be created
    if (!rootUsukId) {
      console.log('--- ROOT USUK NOT FOUND ---');
      if (isDryRun) {
        console.log('Would create root USUK: name="USUK", slug="usuk"');
        rootUsukId = 'NEW_USUK_ID'; // Placeholder for dry-run
        createdUsukRoot = true;
      } else {
        console.log('Creating root USUK genre...');
        const [insertRes] = await pool.query(`
          INSERT INTO genres (name, slug, status, market, use_in_recommendation, use_in_cold_start, use_in_ai_playlist)
          VALUES ('USUK', 'usuk', 'active', 'USUK', 1, 1, 1)
        `);
        rootUsukId = insertRes.insertId;
        console.log(`Created root USUK with ID: ${rootUsukId}`);
        // Add to genres array so it can be referenced (though we don't need to process it)
        genres.push({
          id: rootUsukId, name: 'USUK', slug: 'usuk', status: 'active', market: 'USUK', parent_id: null,
          song_count: 0, artist_count: 0, pref_count: 0, child_count: 0
        });
      }
    }

    let updates = [];
    let stats = {
      marketUpdated: 0,
      parentUpdated: 0,
      hiddenEmpty: 0,
      skipped: 0
    };

    for (const g of genres) {
      if (g.id === 'NEW_USUK_ID') continue; // Skip placeholder

      let newMarket = g.market;
      let newParentId = g.parent_id;
      let newStatus = g.status;
      
      const slug = g.slug ? g.slug.toLowerCase() : '';

      // --- Rule 1: Market with strict Regex ---
      if (/^(vpop|v-pop)(-|$)/i.test(slug)) {
        newMarket = 'VPOP';
      } else if (/^(kpop|k-pop)(-|$)/i.test(slug)) {
        newMarket = 'KPOP';
      } else if (/^(usuk|us-uk)(-|$)/i.test(slug)) {
        newMarket = 'USUK';
      } else {
        newMarket = 'OTHER';
      }

      // --- Rule 2: Parent ID ---
      // Apply only to subgenres, not roots. A root is slug exact match vpop, kpop, usuk
      const isRoot = ROOT_WHITELIST.includes(slug) && !slug.includes('-');
      const isVpopRoot = slug === 'vpop' || slug === 'v-pop';
      const isKpopRoot = slug === 'kpop' || slug === 'k-pop';
      const isUsukRoot = slug === 'usuk' || slug === 'us-uk';

      if (!isVpopRoot && !isKpopRoot && !isUsukRoot) {
        if (newMarket === 'VPOP' && rootVpopId && g.id !== rootVpopId) newParentId = rootVpopId;
        else if (newMarket === 'KPOP' && rootKpopId && g.id !== rootKpopId) newParentId = rootKpopId;
        else if (newMarket === 'USUK' && rootUsukId && g.id !== rootUsukId) newParentId = rootUsukId;
      }

      // Prevent circular/self parent
      if (newParentId === g.id) newParentId = null;

      // --- Rule 3: Cleanup Empty Legacy Genres ---
      if (
        g.status === 'active' &&
        g.song_count === 0 &&
        g.artist_count === 0 &&
        g.child_count === 0 &&
        g.pref_count === 0 &&
        !ROOT_WHITELIST.includes(slug)
      ) {
        newStatus = 'hidden';
      }

      // Check if anything changed
      const changedMarket = newMarket !== g.market;
      const changedParent = newParentId !== g.parent_id;
      const changedStatus = newStatus !== g.status;

      if (changedMarket || changedParent || changedStatus) {
        if (changedMarket) stats.marketUpdated++;
        if (changedParent) stats.parentUpdated++;
        if (changedStatus) stats.hiddenEmpty++;

        updates.push({
          id: g.id,
          name: g.name,
          slug: g.slug,
          changes: {
            market: changedMarket ? `${g.market || 'NULL'} -> ${newMarket}` : undefined,
            parent_id: changedParent ? `${g.parent_id || 'NULL'} -> ${newParentId}` : undefined,
            status: changedStatus ? `${g.status} -> ${newStatus}` : undefined
          },
          sql: `UPDATE genres SET market = ?, parent_id = ?, status = ? WHERE id = ?`,
          params: [newMarket, newParentId === 'NEW_USUK_ID' ? null : newParentId, newStatus, g.id]
        });
      } else {
        stats.skipped++;
      }
    }

    // Print planned changes
    console.log(`\nPlanned Updates: ${updates.length}`);
    for (const u of updates) {
      console.log(`- ID: ${u.id} | ${u.name} (${u.slug})`);
      if (u.changes.market) console.log(`  > Market: ${u.changes.market}`);
      if (u.changes.parent_id) console.log(`  > Parent: ${u.changes.parent_id}`);
      if (u.changes.status) console.log(`  > Status: ${u.changes.status}`);
    }

    console.log('\n--- STATS ---');
    if (createdUsukRoot && isDryRun) console.log('Created Root USUK: YES (Dry Run)');
    else if (createdUsukRoot && !isDryRun) console.log('Created Root USUK: YES (Executed)');
    console.log('Market updated:', stats.marketUpdated);
    console.log('Parent updated:', stats.parentUpdated);
    console.log('Status hidden:', stats.hiddenEmpty);
    console.log('Skipped (no change):', stats.skipped);

    // Execute if not dry run
    if (!isDryRun) {
      console.log('\nExecuting updates in database...');
      // Note: If we created USUK root, and parent_id was set to 'NEW_USUK_ID' during parsing, 
      // it won't happen here because we actually inserted it and got a real ID.
      // But if somehow it's null, handled in params.
      for (const u of updates) {
        await pool.query(u.sql, u.params);
      }
      
      const fs = require('fs');
      const sqlFileContent = updates.map(u => {
        const pId = u.params[1];
        const pVal = pId === null || pId === undefined || isNaN(pId) ? 'NULL' : pId;
        return `UPDATE genres SET market = ${pool.escape(u.params[0])}, parent_id = ${pVal}, status = ${pool.escape(u.params[2])} WHERE id = ${u.id};`;
      }).join('\n');
      
      try {
        fs.writeFileSync('../database/migrations/backfill_genres_taxonomy_data.sql', sqlFileContent);
        console.log('Saved SQL backup to database/migrations/backfill_genres_taxonomy_data.sql');
      } catch(e) {
        // Ignore file write error if folder structure differs
      }

      console.log('DONE!');
    } else {
      console.log('\nThis was a DRY-RUN. No database changes were made.');
      console.log('Run without --dry-run to execute.');
    }

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
