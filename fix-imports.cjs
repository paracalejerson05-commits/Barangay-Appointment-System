const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf-8');
code = code.replace("  UserCheck\n  ChevronLeft,", "  UserCheck,\n  ChevronLeft,");
fs.writeFileSync('src/components/Layout.tsx', code);
