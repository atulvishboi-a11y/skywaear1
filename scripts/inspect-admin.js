const fs = require('fs');
const content = fs.readFileSync('src/app/admin/[[...slug]]/page.tsx', 'utf8');
const regex = /tab === "([^"]+)"/g;
const tabs = new Set();
let m;
while ((m = regex.exec(content)) !== null) tabs.add(m[1]);
console.log('Tabs:', Array.from(tabs));

