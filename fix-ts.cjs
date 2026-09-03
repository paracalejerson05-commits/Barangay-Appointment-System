const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf-8');
code = code.replace(
  "(e.target).style.display = 'none';",
  "(e.target as HTMLImageElement).style.display = 'none';"
);
fs.writeFileSync('src/components/Layout.tsx', code);
