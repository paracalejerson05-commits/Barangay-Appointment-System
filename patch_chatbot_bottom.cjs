const fs = require('fs');

const file = 'src/components/Chatbot.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'bottom-[96px]',
  'bottom-6'
);

fs.writeFileSync(file, content);
