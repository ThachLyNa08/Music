// Clean up orphan lines from dailyMix.service.js
// Keep lines 1-906, delete 907-1091, keep 1092-end
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../apps/backend/src/services/dailyMix.service.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

console.log(`Total lines before: ${lines.length}`);

// Keep lines 0..905 (1-indexed 1..906) and lines 1091..end (1-indexed 1092..end)
const before = lines.slice(0, 906);
const after = lines.slice(1091);

const result = [...before, '', ...after].join('\r\n');
fs.writeFileSync(filePath, result, 'utf8');

const newLines = result.split(/\r?\n/);
console.log(`Total lines after: ${newLines.length}`);
console.log(`Deleted ${lines.length - newLines.length} orphan lines`);
