const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// 1. Root wrapper - make it transparent and add the background div inside
content = content.replace(
  '<div className="h-screen overflow-hidden bg-[#F5F7FB] flex p-3 lg:p-4 gap-4 font-sans text-[#111827]">',
  `<div className="h-screen overflow-hidden bg-[#F4F7F9] flex p-3 lg:p-4 gap-4 font-sans text-[#111827] relative">
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-100/40 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-50/50 blur-[100px]" />
        <div className="absolute top-[30%] right-[20%] w-[40%] h-[40%] rounded-full bg-indigo-50/40 blur-[100px]" />
        
        {/* Subtle Wave SVG */}
        <svg className="absolute top-0 left-0 w-full h-full opacity-30" preserveAspectRatio="none" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 200 C 400 200, 800 100, 1440 250 L 1440 0 L 0 0 Z" fill="url(#grad1)" />
          <path d="M0 800 C 500 700, 1000 800, 1440 600 L 1440 1000 L 0 1000 Z" fill="url(#grad2)" />
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E0E7FF" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#E0E7FF" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
      </div>
`
);

// 2. Main content wrapper - remove bg-white and border
content = content.replace(
  '<div className="flex-1 flex flex-col bg-white rounded-[16px] shadow-sm border border-[#E5E7EB] overflow-hidden relative">',
  '<div className="flex-1 flex flex-col overflow-hidden relative z-10">'
);

// 3. Header - make transparent
content = content.replace(
  '<header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">',
  '<header className="h-20 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40 bg-transparent">'
);

// 4. Main - make transparent
content = content.replace(
  '<main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#F5F7FB]">',
  '<main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-transparent">'
);

fs.writeFileSync('src/components/Layout.tsx', content);
console.log('Background and layout updated');
