import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

interface ChatPanelProps {
  messages: Message[];
  isThinking: boolean;
  onSendMessage: (message: string) => void;
}

export function ChatPanel({ messages, isThinking, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="w-[400px] bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-xl flex flex-col overflow-hidden relative">
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="p-6 border-b border-white/20 bg-white/40">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          AI Relocation Assistant
        </h2>
        <p className="text-xs text-slate-500 mt-1">Powered by Gemini Pro</p>
      </div>

      {/* Message List */}
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar relative z-10"
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 mt-10">
            <div className="w-16 h-16 bg-white/50 rounded-2xl shadow-sm flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-indigo-300" />
            </div>
            <p className="text-sm">Hi! I'm your SydLiving AI.<br/>Ask me to find apartments or check commute times.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}
            >
              <div 
                className={`px-4 py-3 rounded-2xl shadow-sm text-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-500 text-white rounded-tr-sm' 
                    : 'bg-white/80 border border-white/40 text-slate-700 rounded-tl-sm backdrop-blur-md prose prose-sm prose-slate prose-p:leading-relaxed prose-ul:my-2 prose-li:my-0'
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))
        )}
        
        {isThinking && (
          <div className="self-start flex flex-col max-w-[85%]">
            <div className="px-4 py-3 bg-white/80 border border-white/40 rounded-2xl rounded-tl-sm shadow-sm backdrop-blur-md flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              <span className="text-sm text-slate-500">Agent is thinking...</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Input Area */}
      <div className="p-4 bg-white/40 border-t border-white/20 relative z-10">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..." 
            disabled={isThinking}
            className="w-full pl-4 pr-12 py-3 bg-white/60 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm backdrop-blur-md shadow-sm disabled:opacity-50 transition-all placeholder:text-slate-400 text-slate-700"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isThinking}
            className="absolute right-2 p-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white rounded-lg transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
