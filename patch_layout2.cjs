const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

content = content.replace(
  `      {/* Chatbot Toggle */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={cn(
            "w-[56px] h-[56px] rounded-full shadow-md flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-white",
            isChatOpen ? "bg-[#0F172A]" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
          )}
        >`,
  `      {/* Chatbot Toggle */}
      <div className={cn("fixed bottom-6 right-6 z-50 transition-opacity duration-200", isChatOpen ? "opacity-0 pointer-events-none" : "opacity-100")}>
        <button
          onClick={() => setIsChatOpen(true)}
          className={cn(
            "w-[56px] h-[56px] rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-white bg-[#2563EB] hover:bg-[#1D4ED8]"
          )}
        >`
);

content = content.replace(
  `        >
          <AnimatePresence mode="wait">
            {isChatOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Bot className="w-5 h-5" />
            )}
          </AnimatePresence>
        </button>`,
  `        >
          <Bot className="w-6 h-6" />
        </button>`
);

fs.writeFileSync('src/components/Layout.tsx', content);
