const fs = require('fs');

const file = 'src/components/Chatbot.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the return statement and its content
const startIdx = content.indexOf('  return (');
const endIdx = content.lastIndexOf('  );') + 4;

const newContent = `  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-[96px] right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[380px] h-[520px] max-h-[calc(100vh-120px)] bg-white rounded-[14px] shadow-lg border border-[#E2E8F0] flex flex-col z-[100] overflow-hidden"
    >
      {/* Compact Header */}
      <div className="h-[64px] bg-white border-b border-[#E2E8F0] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#EFF6FF] rounded-[10px] border border-[#BFDBFE] flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-[#2563EB]" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-[#0F172A] leading-tight flex items-center gap-1.5">
              Barangay AI
            </h3>
            <p className="text-[11px] text-[#64748B] font-medium flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Online Assistant
            </p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-[8px] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-2 max-w-[85%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0",
              msg.role === 'user' 
                ? "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]" 
                : "bg-white text-[#2563EB] border border-[#E2E8F0]"
            )}>
              {msg.role === 'user' ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={cn(
              "p-3 text-[13px] leading-relaxed shadow-sm",
              msg.role === 'user' 
                ? "bg-[#2563EB] text-white rounded-[12px] rounded-tr-[4px]"
                : "bg-white text-[#0F172A] border border-[#E2E8F0] rounded-[12px] rounded-tl-[4px]"
            )}>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-0 prose-p:leading-relaxed">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-2 max-w-[85%]">
            <div className="w-7 h-7 rounded-[8px] bg-white border border-[#E2E8F0] text-[#2563EB] flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white border border-[#E2E8F0] p-3 rounded-[12px] rounded-tl-[4px] shadow-sm flex items-center gap-2 text-[13px] text-[#64748B]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input & Actions */}
      <div className="bg-white border-t border-[#E2E8F0] p-3 flex-shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['Barangay Clearance', 'Indigency', 'Status Check'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setInput(suggestion)}
              className="whitespace-nowrap px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-full text-[11px] font-medium text-[#64748B] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] hover:text-[#2563EB] transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
        
        <div className="relative mt-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] py-2.5 pl-3 pr-10 text-[13px] text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors placeholder:text-[#94A3B8]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[8px] text-[#2563EB] hover:bg-[#EFF6FF] disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );`;

let newFileContent = content.slice(0, startIdx) + newContent + content.slice(endIdx);
fs.writeFileSync(file, newFileContent);
