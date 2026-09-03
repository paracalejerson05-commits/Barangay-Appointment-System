const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// We will replace the entire background div.
const oldBgStart = content.indexOf('{/* Subtle Background Pattern */}');
const oldBgEnd = content.indexOf('</svg>\n      </div>') + 19;

const newBg = `{/* Subtle Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#F4F7FB]">
        {/* Abstract Soft Shapes */}
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-blue-200/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-blue-300/20 blur-[120px]" />
        
        {/* Soft Wave SVG */}
        <svg className="absolute top-0 left-0 w-full h-full opacity-60" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Top Wave */}
          <path d="M0,0 L1440,0 L1440,250 C1100,100 800,450 400,200 C200,75 0,300 0,300 Z" fill="url(#grad-top)" />
          {/* Bottom Wave */}
          <path d="M1440,1024 L0,1024 L0,800 C300,950 600,650 1000,850 C1250,975 1440,750 1440,750 Z" fill="url(#grad-bottom)" />
          
          <defs>
            <linearGradient id="grad-top" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E0E7FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="grad-bottom" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#E0E7FF" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>
      </div>`;

if (oldBgStart !== -1 && oldBgEnd !== -1) {
  content = content.substring(0, oldBgStart) + newBg + content.substring(oldBgEnd);
  fs.writeFileSync('src/components/Layout.tsx', content);
  console.log('Background SVG updated');
} else {
  console.log('Failed to find background range');
}
