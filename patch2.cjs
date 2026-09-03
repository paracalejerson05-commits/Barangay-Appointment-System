const fs = require('fs');
let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// Remove the window.confirm logic
content = content.replace(
  /if \(status === 'disapproved' \|\| status === 'approved' \|\| \(status === 'completed' && !showCertificateEditor\)\) \{\s*if \(!window\.confirm\(messages\[status\]\)\) return;\s*\}/g,
  '// Confirmation removed for iframe compatibility'
);

content = content.replace(
  /alert\("This request has already been processed."\);/g,
  'console.warn("This request has already been processed.");'
);

content = content.replace(
  /alert\("Only approved requests can be marked as completed."\);/g,
  'console.warn("Only approved requests can be marked as completed.");'
);

content = content.replace(
  /alert\(`Request (\w+) Successfully\.\$\{emailWarning\}`\);/g,
  'console.log(`Request $1 Successfully.${emailWarning}`);'
);

fs.writeFileSync('src/components/AdminDashboard.tsx', content);
