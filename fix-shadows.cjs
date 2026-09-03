const fs = require('fs');

let content = fs.readFileSync('src/components/ResidentDashboard.tsx', 'utf8');
content = content.replaceAll('shadow-2xs', 'shadow-sm');
fs.writeFileSync('src/components/ResidentDashboard.tsx', content);
console.log('Shadows updated in ResidentDashboard');

let layoutContent = fs.readFileSync('src/components/Layout.tsx', 'utf8');
layoutContent = layoutContent.replaceAll('shadow-2xs', 'shadow-sm');
fs.writeFileSync('src/components/Layout.tsx', layoutContent);
console.log('Shadows updated in Layout');
