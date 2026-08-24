import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, History, Plus, X, Compass } from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, type ChatSession } from '../api/client';

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

interface ChatPanelProps {
  messages: Message[];
  isThinking: boolean;
  onSendMessage: (message: string) => void;
  onSelectSession?: (sessionId: string | null) => void;
  currentSessionId?: string | null;
  isLoggedIn?: boolean;
}

const SUGGESTIONS = [
  "Show rentals under $800 in Surry Hills",
  "Properties within 2 km of Bondi Beach",
  "Find 2 bedroom apartments near Sydney CBD",
  "Commute from Manly to Wynyard"
];

export function ChatPanel({ messages, isThinking, onSendMessage, onSelectSession, currentSessionId, isLoggedIn }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  useEffect(() => {
    if (showHistory && isLoggedIn) {
      api.getChatSessions().then(setSessions).catch(console.error);
    }
  }, [showHistory, isLoggedIn]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleSuggestionClick = (query: string) => {
    if (isThinking) return;
    onSendMessage(query);
  };

  return (
    <div className="w-full h-full bg-white/40 backdrop-blur-2xl flex flex-col overflow-hidden relative border-l border-white/50">
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/30 bg-white/50 backdrop-blur-md shrink-0 flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>AI Relocation Assistant</span>
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">Powered by Gemini 3.7 Flash • TfNSW Transit Sync</p>
        </div>
        <div className="flex gap-2">
          {isLoggedIn && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              title="Chat History"
            >
              {showHistory ? <X className="w-4 h-4" /> : <History className="w-4 h-4" />}
            </button>
          )}
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-[10px] font-bold h-fit my-auto">
            Live Agent
          </div>
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 p-4 overflow-y-auto bg-white/80 z-20 custom-scrollbar">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800 text-sm">Chat History</h3>
            <button 
              onClick={() => {
                onSelectSession?.(null);
                setShowHistory(false);
              }}
              className="flex items-center gap-1 text-xs font-semibold bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200"
            >
              <Plus className="w-4 h-4" /> New Chat
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center mt-4">No previous sessions found.</p>
            ) : (
              sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelectSession?.(s.id);
                    setShowHistory(false);
                  }}
                  className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                    currentSessionId === s.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white/80 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium text-slate-800 truncate">{s.title || 'New Chat'}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(s.updated_at).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Message List */}
          <div 
            ref={scrollRef}
            className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar relative z-10"
          >
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 my-auto">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl shadow-md shadow-indigo-200 flex items-center justify-center mb-4 text-white">
                  <Compass className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-slate-800 text-base mb-1">G'day! Welcome to Sydney</h3>
                <p className="text-xs text-slate-500 max-w-xs mb-6 leading-relaxed">
                  Ask me to filter rentals, discover suburbs, or calculate real door-to-door transit commutes to your workplace!
                </p>

                {/* Suggestion Chips */}
                <div className="w-full space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-left px-1">Suggested Searches</p>
                  <div className="grid grid-cols-1 gap-2">
                    {SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(s)}
                        className="text-left text-xs font-semibold bg-white/80 hover:bg-slate-100 text-slate-800 p-2.5 rounded-xl border border-white/60 shadow-xs transition-all text-ellipsis overflow-hidden whitespace-nowrap"
                      >
                        ✨ {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col max-w-[88%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}
                >
                  <div 
                    className={`px-4 py-3 rounded-2xl shadow-xs text-xs leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-xs font-medium' 
                        : 'bg-white/90 border border-white/60 text-slate-800 rounded-tl-xs backdrop-blur-md prose prose-xs prose-slate prose-p:leading-relaxed'
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
                <div className="px-4 py-3 bg-white/90 border border-white/60 rounded-2xl rounded-tl-xs shadow-xs backdrop-blur-md flex items-center gap-2 text-xs">
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                  <span className="text-slate-700 font-semibold">SydLiving AI is evaluating listings...</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Input Area */}
          <div className="p-3 bg-white/50 border-t border-white/30 backdrop-blur-md relative z-10 shrink-0">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask e.g. 'Show 2 beds under $900 in Surry Hills'..." 
                disabled={isThinking}
                className="w-full pl-4 pr-12 py-3 bg-white/80 border border-white/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs backdrop-blur-md shadow-xs disabled:opacity-50 transition-all placeholder:text-slate-400 text-slate-800 font-medium"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isThinking}
                className="absolute right-1.5 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-all shadow-xs disabled:shadow-none"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
