import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User as UserIcon, Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { apiUrl } from '../lib/api';
import { supabase } from '../lib/supabase';
import { buildOfflineFallbackReply, type ChatConnectionStatus } from '../lib/chatReliability';

interface Message {
  role: 'user' | 'model';
  text: string;
  source?: 'gemini' | 'fallback';
  retryText?: string;
}

interface ChatbotProps {
  onClose: () => void;
  user: any;
  profile: any;
}

export function Chatbot({ onClose, user, profile }: ChatbotProps) {
  const isAdmin = profile?.role === 'admin';
  const aiEnabled = isAdmin
    ? (user?.user_metadata?.smartPrefs?.aiAssistant ?? true)
    : (user?.user_metadata?.aiPrefs?.aiAssistance ?? profile?.aiPrefs?.aiAssistance ?? true);
  const [chatStatus, setChatStatus] = useState<ChatConnectionStatus>('connecting');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: `Hello ${profile?.displayName || user?.displayName || 'Resident'}! I can help with services, request status, and queue conditions.`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const lastSuccessfulGeminiAt = useRef<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let active = true;
    let checking = false;

    const checkStatus = async () => {
      if (checking) return;
      checking = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (active) setChatStatus('temporarily_unavailable');
          return;
        }

        const response = await fetch(apiUrl('/api/chat/status'), {
          credentials: 'omit',
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: AbortSignal.timeout(8000)
        });
        if (!active) return;
        if (!response.ok) {
          setChatStatus('temporarily_unavailable');
          return;
        }

        const data: { status?: unknown } = await response.json();
        if (data.status === 'connected') {
          lastSuccessfulGeminiAt.current = Date.now();
          setChatStatus('connected');
        } else if (data.status === 'connecting'
          && lastSuccessfulGeminiAt.current !== null
          && Date.now() - lastSuccessfulGeminiAt.current <= 120_000) {
          setChatStatus('connected');
        } else if (data.status === 'connecting' || data.status === 'temporarily_unavailable') {
          setChatStatus(data.status);
        } else {
          setChatStatus('temporarily_unavailable');
        }
      } catch (error) {
        if (!active) return;
        const networkFailure = error instanceof TypeError
          || (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'));
        setChatStatus(networkFailure ? 'offline' : 'temporarily_unavailable');
      } finally {
        checking = false;
      }
    };

    void checkStatus();
    const interval = window.setInterval(() => { void checkStatus(); }, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleSend = async (retryText?: string, retryMessageIndex?: number) => {
    if (sendingRef.current) return;
    const isRetry = typeof retryText === 'string';
    const userMessage = isRetry ? retryText.trim() : input.trim();
    if (!userMessage) return;

    sendingRef.current = true;
    if (!isRetry) {
      setInput('');
      setMessages(previous => [...previous, { role: 'user', text: userMessage }]);
    }
    setIsLoading(true);

    try {
      if (!aiEnabled) {
        setMessages(previous => [...previous, { role: 'model', text: 'This AI feature is disabled in Settings.' }]);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessages(previous => [...previous, {
          role: 'model',
          text: 'Your session has expired. Please sign in again before using the assistant.'
        }]);
        return;
      }

      const history = isRetry
        ? messages.slice(0, Math.max(0, (retryMessageIndex ?? messages.length) - 1))
        : messages;
      let response: Response;
      try {
        response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ message: userMessage, conversationHistory: history }),
          signal: AbortSignal.timeout(45_000)
        });
      } catch (error) {
        if (error instanceof TypeError
          || (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))) {
          setChatStatus('offline');
          setMessages(previous => [...previous, {
            role: 'model',
            text: buildOfflineFallbackReply(userMessage),
            source: 'fallback',
            retryText: userMessage
          }]);
          return;
        }
        throw error;
      }

      const data: { reply?: unknown; error?: unknown; provider?: unknown; status?: unknown; retryable?: unknown } =
        await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status >= 500) {
          setChatStatus('temporarily_unavailable');
          setMessages(previous => [...previous, {
            role: 'model',
            text: buildOfflineFallbackReply(userMessage),
            source: 'fallback',
            retryText: userMessage
          }]);
          return;
        }

        const errorMessage = response.status === 401 || response.status === 403
          ? 'Your session may have expired or your account cannot access the assistant. Please sign in again.'
          : response.status === 429
            ? 'Too many messages were sent in a short time. Please wait a moment, then retry.'
            : response.status === 400
              ? 'Please enter a message of 2,000 characters or fewer.'
              : 'The assistant could not process that message. Please try again.';
        setMessages(previous => [...previous, {
          role: 'model',
          text: errorMessage,
          retryText: response.status === 429 ? userMessage : undefined
        }]);
        return;
      }

      const reply = data.reply;
      if (typeof reply !== 'string' || !reply.trim()) {
        setChatStatus('temporarily_unavailable');
        setMessages(previous => [...previous, {
          role: 'model',
          text: buildOfflineFallbackReply(userMessage),
          source: 'fallback',
          retryText: userMessage
        }]);
        return;
      }

      const isFallback = data.provider === 'fallback';
      if (isFallback) lastSuccessfulGeminiAt.current = null;
      else if (data.status === 'connected') lastSuccessfulGeminiAt.current = Date.now();
      setChatStatus(isFallback
        ? 'temporarily_unavailable'
        : data.status === 'connected' ? 'connected' : 'connecting');
      setMessages(previous => [...previous, {
        role: 'model',
        text: reply,
        source: isFallback ? 'fallback' : 'gemini',
        retryText: isFallback && data.retryable === true ? userMessage : undefined
      }]);
    } catch {
      setChatStatus('temporarily_unavailable');
      setMessages(previous => [...previous, {
        role: 'model',
        text: 'The assistant could not respond just now. Your message is saved here; please retry in a moment.',
        retryText: userMessage
      }]);
    } finally {
      sendingRef.current = false;
      setIsLoading(false);
    }
  };

  const statusLabel = chatStatus === 'connected'
    ? 'Connected'
    : chatStatus === 'connecting'
      ? 'Connecting'
      : chatStatus === 'offline'
        ? 'Offline'
        : 'Temporarily Unavailable';
  const statusDotClass = chatStatus === 'connected'
    ? 'bg-emerald-500'
    : chatStatus === 'connecting'
      ? 'bg-amber-500 animate-pulse'
      : 'bg-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-2 sm:bottom-6 inset-x-2 sm:left-auto sm:right-6 sm:w-[380px] w-auto h-[min(520px,calc(100dvh-76px))] max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 rounded-[14px] shadow-lg border border-[#E2E8F0] dark:border-slate-800 flex flex-col z-[100] overflow-hidden"
    >
      <div className="h-[64px] bg-white border-b border-[#E2E8F0] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#EFF6FF] rounded-[10px] border border-[#BFDBFE] flex items-center justify-center flex-shrink-0">
            <img src="/ai-chatbot.svg" alt="" className="w-9 h-9 object-contain" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-[#0F172A] leading-tight flex items-center gap-1.5">
              Barangay AI
            </h3>
            <p className="text-[11px] text-[#64748B] font-medium flex items-center gap-1.5 mt-0.5" role="status" aria-live="polite">
              <span className={cn('w-1.5 h-1.5 rounded-full', statusDotClass)}></span>
              {statusLabel}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-[8px] transition-colors"
          aria-label="Close Barangay AI assistant"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex gap-2 max-w-[85%]', msg.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
          >
            <div className={cn(
              'w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0',
              msg.role === 'user'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#2563EB] border border-[#E2E8F0]'
            )}>
              {msg.role === 'user' ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={cn(
              'p-3 text-[13px] leading-relaxed shadow-sm',
              msg.role === 'user'
                ? 'bg-[#2563EB] text-white rounded-[12px] rounded-tr-[4px]'
                : 'bg-white text-[#0F172A] border border-[#E2E8F0] rounded-[12px] rounded-tl-[4px]'
            )}>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-0 prose-p:leading-relaxed">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
              {msg.source === 'fallback' && (
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                  <span>Fallback assistant · live assistant unavailable</span>
                  {msg.retryText && (
                    <button
                      onClick={() => handleSend(msg.retryText, i)}
                      disabled={isLoading}
                      className="font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
              {msg.retryText && msg.source !== 'fallback' && (
                <button
                  onClick={() => handleSend(msg.retryText, i)}
                  disabled={isLoading}
                  className="mt-2 border-t border-slate-100 pt-2 text-[10px] font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  Retry
                </button>
              )}
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

      <div className="bg-white border-t border-[#E2E8F0] p-3 flex-shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['Barangay Clearance', 'Indigency', 'Status Check'].map(suggestion => (
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
            maxLength={2000}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Ask me anything..."
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] py-2.5 pl-3 pr-10 text-[13px] text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors placeholder:text-[#94A3B8]"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isLoading}
            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-[8px] text-[#2563EB] hover:bg-[#EFF6FF] disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
