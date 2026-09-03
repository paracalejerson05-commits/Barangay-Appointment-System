const fs = require('fs');
let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');
content = content.replace(
  `.sort((a, b) => b[1] - a[1])`,
  `.sort((a, b) => (b[1] as number) - (a[1] as number))`
);
fs.writeFileSync('src/components/AdminDashboard.tsx', content);
