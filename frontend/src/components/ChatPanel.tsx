import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Compass, ArrowRight, Train, Tag, Award, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { type TradeoffOption } from '../api/client';

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  tradeoffs?: TradeoffOption[];
}

interface ChatPanelProps {
  messages: Message[];
  isThinking: boolean;
  onSendMessage: (message: string) => void;
  onSelectProperty?: (id: string) => void;
  sessionPreferences?: {
    max_rent?: number;
    min_bedrooms?: number;
    preferred_cbd_hub?: string;
    vibe_query?: string;
  };
}

const SUGGESTIONS = [
  "Find quiet, leafy suburbs near good coffee under $850",
  "Beachside 2-bed flat with quick commute to Barangaroo",
  "Cheapest 1-bedroom rentals near train stations",
  "Compare Coogee vs Manly commute to Martin Place"
];

export function ChatPanel({
  messages,
  isThinking,
  onSendMessage,
  onSelectProperty,
  sessionPreferences
}: ChatPanelProps) {
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

  const handleSuggestionClick = (query: string) => {
    if (isThinking) return;
    onSendMessage(query);
  };

  const getBadgeStyle = (label: string) => {
    if (label.includes("Cheapest")) {
      return {
        bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
        icon: Tag
      };
    }
    if (label.includes("Fastest")) {
      return {
        bg: "bg-blue-500/10 border-blue-500/30 text-blue-700",
        icon: Zap
      };
    }
    return {
      bg: "bg-amber-500/10 border-amber-500/30 text-amber-700",
      icon: Award
    };
  };

  return (
    <div className="w-full h-full bg-white/40 backdrop-blur-2xl flex flex-col overflow-hidden relative border-l border-white/50">
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/30 bg-white/50 backdrop-blur-md shrink-0 flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>AI Relocation Advisor</span>
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">Semantic Vibe Search • Trade-off Engine</p>
        </div>
        <div className="flex items-center gap-1.5">
          {sessionPreferences?.preferred_cbd_hub && (
            <span className="bg-white/80 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">
              📍 {sessionPreferences.preferred_cbd_hub}
            </span>
          )}
          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
            Live Session
          </span>
        </div>
      </div>

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
            <h3 className="font-bold text-slate-800 text-base mb-1">G'day! Let's find your Sydney home</h3>
            <p className="text-xs text-slate-500 max-w-xs mb-6 leading-relaxed">
              Search by suburb vibe, budget, or workplace. SydLiving AI evaluates live TfNSW commutes and provides 3 labelled trade-off choices!
            </p>

            {/* Suggestion Chips */}
            <div className="w-full space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-left px-1">Try Searching</p>
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
              className={`flex flex-col max-w-[92%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}
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

              {/* Render 2-3 Labelled Trade-Off Cards if present */}
              {msg.tradeoffs && msg.tradeoffs.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900/60 px-1">
                    Labelled Trade-Off Options
                  </span>
                  {msg.tradeoffs.map((opt, oIdx) => {
                    const style = getBadgeStyle(opt.label);
                    const IconComp = style.icon;
                    return (
                      <div
                        key={oIdx}
                        onClick={() => onSelectProperty && onSelectProperty(opt.property.id)}
                        className="bg-white/90 hover:bg-white border border-white/80 rounded-xl p-3 shadow-xs transition-all cursor-pointer hover:shadow-md hover:scale-[1.01]"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${style.bg}`}>
                            <IconComp className="w-3 h-3" />
                            {opt.label}
                          </span>
                          <span className="font-extrabold text-slate-900 text-xs">
                            ${opt.property.weekly_rent} <span className="text-[10px] text-slate-500 font-normal">/wk</span>
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 mb-1 line-clamp-1">
                          {opt.property.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1.5">
                          <span className="flex items-center gap-1">
                            <Train className="w-3 h-3 text-indigo-500" />
                            {opt.commute_minutes}m to CBD
                          </span>
                          <span>•</span>
                          <span>{opt.property.bedrooms} bed</span>
                          <span>•</span>
                          <span>{opt.property.suburb}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                          {opt.reasoning}
                        </p>
                        <div className="mt-2 flex items-center justify-end text-[10px] font-bold text-indigo-600 hover:text-indigo-800 gap-1">
                          <span>View Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
        
        {isThinking && (
          <div className="self-start flex flex-col max-w-[85%]">
            <div className="px-4 py-3 bg-white/90 border border-white/60 rounded-2xl rounded-tl-xs shadow-xs backdrop-blur-md flex items-center gap-2 text-xs">
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              <span className="text-slate-700 font-semibold">Evaluating Sydney listings & trade-offs...</span>
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
            placeholder="e.g. 'Quiet leafy suburb near good coffee under $850'..." 
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
    </div>
  );
}
