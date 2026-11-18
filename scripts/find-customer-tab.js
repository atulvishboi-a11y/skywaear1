const fs = require('fs');
const lines = fs.readFileSync('src/app/admin/[[...slug]]/page.tsx', 'utf8').split('\n');
for (let i = 4050; i < 4350; i++) {
  if (lines[i] && (lines[i].includes('bank') || lines[i].includes('Bank') || lines[i].includes('upi') || lines[i].includes('UPI'))) {
    console.log((i+1) + ': ' + lines[i].trim());
  }
}
