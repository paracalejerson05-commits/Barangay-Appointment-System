const fs = require('fs');
let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');
content = content.replace(
  'alert("Failed to update request.");',
  'alert("Failed to update request. Error: " + (error instanceof Error ? error.message : JSON.stringify(error)));'
);
fs.writeFileSync('src/components/AdminDashboard.tsx', content);
