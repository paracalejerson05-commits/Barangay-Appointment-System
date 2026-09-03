const fs = require('fs');
let content = fs.readFileSync('src/components/Chatbot.tsx', 'utf8');
content = content.replace(
  'max-h-[calc(100vh-120px)]',
  'max-h-[calc(100vh-48px)]'
);
fs.writeFileSync('src/components/Chatbot.tsx', content);
