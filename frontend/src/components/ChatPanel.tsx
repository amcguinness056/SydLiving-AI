import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, History, Plus, X, Compass } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, type ChatSession } from '../api/client';

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  agentType?: 'standard' | 'deep_agent';
  latencySeconds?: number;
}

interface ChatPanelProps {
  messages: Message[];
  isThinking: boolean;
  onSendMessage: (message: string) => void;
  onSelectSession?: (sessionId: string | null) => void;
  currentSessionId?: string | null;
  isLoggedIn?: boolean;
  agentMode?: 'standard' | 'deep';
  onToggleAgentMode?: (mode: 'standard' | 'deep') => void;
}

const SUGGESTIONS = [
  "Show rentals under 25 mins to Barangaroo",
  "Metro-connected 2BR under $850/wk",
  "Beachside rentals under 35m to Central",
  "Places under 30 mins to Victoria Cross",
  "Compare commute from Manly vs Bondi Beach"
];

export function ChatPanel({ 
  messages, 
  isThinking, 
  onSendMessage, 
  onSelectSession, 
  currentSessionId, 
  isLoggedIn,
  agentMode = 'standard',
  onToggleAgentMode
}: ChatPanelProps) {
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
    <div className="w-full h-full bg-white/60 dark:bg-slate-900/90 backdrop-blur-2xl flex flex-col overflow-hidden relative border-l border-white/50 dark:border-slate-800 text-slate-800 dark:text-slate-100">
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/10 dark:from-indigo-500/5 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/30 dark:border-slate-800 bg-white/50 dark:bg-slate-900/60 backdrop-blur-md shrink-0 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="truncate">AI Relocation Assistant</span>
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
            {agentMode === 'deep' ? 'LangChain Deep Agents Harness • Multi-Agent' : 'Powered by Gemini 3.8 Flash • Transit Sync'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mode Toggle */}
          <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-lg text-[10px] font-bold border border-slate-300/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => onToggleAgentMode?.('standard')}
              className={`px-2 py-1 rounded-md transition-all ${agentMode === 'standard' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
              title="Fast single-turn Gemini tool calling"
            >
              ⚡ Fast
            </button>
            <button
              type="button"
              onClick={() => onToggleAgentMode?.('deep')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${agentMode === 'deep' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
              title="LangChain Deep Agents Harness (Subagents, Planning & Reflection)"
            >
              <span>🧠 Deep Agent</span>
            </button>
          </div>

          {isLoggedIn && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Chat History"
            >
              {showHistory ? <X className="w-4 h-4" /> : <History className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 p-4 overflow-y-auto bg-white/80 dark:bg-slate-900/80 z-20 custom-scrollbar">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Chat History</h3>
            <button 
              onClick={() => {
                onSelectSession?.(null);
                setShowHistory(false);
              }}
              className="flex items-center gap-1 text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/80"
            >
              <Plus className="w-4 h-4" /> New Chat
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-4">No previous sessions found.</p>
            ) : (
              sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelectSession?.(s.id);
                    setShowHistory(false);
                  }}
                  className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                    currentSessionId === s.id 
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800' 
                      : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}

                >
                  <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{s.title || 'New Chat'}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
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
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl shadow-md shadow-indigo-200 dark:shadow-indigo-950/50 flex items-center justify-center mb-4 text-white">
                  <Compass className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white text-base mb-1">G'day! Welcome to Sydney</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-6 leading-relaxed">
                  Ask me to filter rentals, discover suburbs, or calculate real door-to-door transit commutes to your workplace!
                </p>

                {/* Suggestion Chips */}
                <div className="w-full space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-left px-1">Suggested Searches</p>
                  <div className="grid grid-cols-1 gap-2">
                    {SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(s)}
                        className="text-left text-xs font-semibold bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 p-2.5 rounded-xl border border-white/60 dark:border-slate-700/60 shadow-xs transition-all text-ellipsis overflow-hidden whitespace-nowrap hover:scale-[1.01]"
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
                        ? 'bg-indigo-600 text-white rounded-tr-xs font-medium shadow-indigo-600/20' 
                        : 'bg-white/90 dark:bg-slate-800/90 border border-white/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 rounded-tl-xs backdrop-blur-md prose prose-xs prose-slate dark:prose-invert prose-p:leading-relaxed'
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>

                    {msg.role === 'model' && msg.agentType === 'deep_agent' && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold not-prose">
                        <span className="flex items-center gap-1">
                          <span>🧠 LangChain Deep Agent</span>
                          <span className="text-slate-400 dark:text-slate-500">• Multi-Agent Plan</span>
                        </span>
                        {msg.latencySeconds && (
                          <span className="text-slate-400 dark:text-slate-400 font-mono text-[9px]">
                            {msg.latencySeconds}s
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {isThinking && (
              <div className="self-start flex flex-col max-w-[85%]">
                <div className="px-4 py-3 bg-white/90 dark:bg-slate-800/90 border border-white/60 dark:border-slate-700/60 rounded-2xl rounded-tl-xs shadow-xs backdrop-blur-md flex items-center gap-2 text-xs">
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                  <span className="text-slate-700 dark:text-slate-200 font-semibold">
                    {agentMode === 'deep' 
                      ? '🧠 Deep Agent is planning, calling specialists & compiling dossier...' 
                      : 'SydLiving AI is evaluating listings...'}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Input Area */}
          <div className="p-3 bg-white/50 dark:bg-slate-900/70 border-t border-white/30 dark:border-slate-800 backdrop-blur-md relative z-10 shrink-0">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask e.g. 'Show 2 beds under $900 within 25m of Barangaroo'..." 
                disabled={isThinking}
                className="w-full pl-4 pr-12 py-3 bg-white/80 dark:bg-slate-800/80 border border-white/80 dark:border-slate-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs backdrop-blur-md shadow-xs disabled:opacity-50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-white font-medium"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isThinking}
                className="absolute right-1.5 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-all shadow-xs disabled:shadow-none"
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
