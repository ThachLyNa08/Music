const fs = require('fs');
const filePath = process.argv[2];
const startDel = parseInt(process.argv[3], 10); // first line to delete (1-indexed)
const endDel = parseInt(process.argv[4], 10);   // last line to delete (1-indexed)

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

const before = lines.slice(0, startDel - 1);
const after = lines.slice(endDel);
const result = [...before, '', ...after].join('\r\n');

fs.writeFileSync(filePath, result, 'utf8');
console.log(`Deleted lines ${startDel}-${endDel}. Before: ${lines.length} lines, After: ${before.length + 1 + after.length} lines`);
