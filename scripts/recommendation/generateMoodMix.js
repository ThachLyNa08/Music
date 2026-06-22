const path = require('path');
const projectRoot = path.resolve(__dirname, '..', '..');
const backendRoot = path.join(projectRoot, 'apps', 'backend');
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const { pool } = require(path.join(backendRoot, 'src/config/database'));
const { generateMoodMixForUser, generateMoodMixForAllUsers } = require(path.join(backendRoot, 'src/services/moodMix.service'));

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Usage:
  node generateMoodMix.js --user-id=11
  node generateMoodMix.js --all
  node generateMoodMix.js --limit=50
  node generateMoodMix.js --dry-run
    `);
    process.exit(0);
  }

  const isDryRun = args.includes('--dry-run');
  const isAll = args.includes('--all');
  
  let userId = null;
  const userArg = args.find(a => a.startsWith('--user-id='));
  if (userArg) {
    userId = parseInt(userArg.split('=')[1]);
  }

  let limit = 30;
  const limitArg = args.find(a => a.startsWith('--limit='));
  if (limitArg) {
    limit = parseInt(limitArg.split('=')[1]);
  }

  if (!isAll && !userId) {
    console.error('Error: Must specify --all or --user-id=X');
    process.exit(1);
  }

  console.log(`--- MOOD MIX GENERATOR ---`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN' : 'APPLY'}`);
  console.log(`Target: ${isAll ? 'ALL USERS' : 'USER ' + userId}`);
  console.log(`Limit: ${limit}\n`);

  try {
    if (isAll && !isDryRun) {
      console.log('Generating for all users...');
      const count = await generateMoodMixForAllUsers({ limit, dryRun: false });
      console.log(`Successfully generated Mood Mix for ${count} users.`);
    } else if (userId) {
      console.log(`Generating for user ${userId}...`);
      const result = await generateMoodMixForUser(userId, { limit, dryRun: isDryRun });
      
      if (isDryRun) {
        console.log(`\n[DRY RUN RESULTS] User: ${userId}`);
        console.log(`Dominant Mood: ${result.dominantMood || 'N/A'}`);
        console.log(`Candidates analyzed: ${result.candidateCount}`);
        console.log(`Selected count: ${result.items.length}`);
        
        console.log(`\nTop 10 Selected Songs:`);
        result.items.slice(0, 10).forEach((s, idx) => {
          console.log(` ${idx + 1}. ${s.title} - ${s.artist_name} (Mood: ${s.mood || 'N/A'}, Score: ${s.score || 'Fallback'})`);
        });
      } else {
        console.log(`Successfully generated Mood Mix with ${result.items.length} songs.`);
      }
    } else if (isAll && isDryRun) {
      console.log('Dry run for --all is not supported in detailed output. Please run for a specific user.');
    }
  } catch (err) {
    console.error('Error running script:', err);
  } finally {
    await pool.end();
  }
}

main();
