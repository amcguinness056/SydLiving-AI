import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, 
  Sparkles, 
  Loader2, 
  History, 
  Plus, 
  X, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  Maximize,
  Minimize,
  Columns2,
  BrainCircuit,
  Route,
  Building2,
  Palmtree,
  Clock,
  Trash2,
  ExternalLink
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, type ChatSession, type DeepAgentStep, type Property } from '../api/client';

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  agentType?: 'standard' | 'deep_agent';
  latencySeconds?: number;
  steps?: DeepAgentStep[];
}

interface ChatPanelProps {
  messages: Message[];
  isThinking: boolean;
  onSendMessage: (message: string) => void;
  onSelectSession?: (sessionId: string | null) => void;
  currentSessionId?: string | null;
  isLoggedIn?: boolean;
  activeThinkingSteps?: DeepAgentStep[];
  activeStatusLabel?: string | null;
  streamingContent?: string;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isWide?: boolean;
  onToggleWide?: () => void;
  onClose?: () => void;
  properties?: Property[];
  onSelectProperty?: (propertyId: string) => void;
}

const SUGGESTIONS = [
  "Show rentals under 25 mins to Barangaroo",
  "Metro-connected 2BR under $850/wk",
  "Beachside rentals under 35m to Central",
  "Places under 30 mins to Victoria Cross",
  "Compare commute from Manly vs Bondi Beach"
];

interface StepCategory {
  key: string;
  name: string;
  shortLabel: string;
  icon: typeof Route;
  badgeClass: string;
  steps: DeepAgentStep[];
}

function groupStepsByCategory(steps: DeepAgentStep[]): StepCategory[] {
  const categories: Record<string, StepCategory> = {
    commute: {
      key: 'commute',
      name: 'Commute & Transit',
      shortLabel: 'routes',
      icon: Route,
      badgeClass: 'text-sky-700 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/80 border-sky-200/80 dark:border-sky-700/80',
      steps: []
    },
    property: {
      key: 'property',
      name: 'Property Scout',
      shortLabel: 'listings',
      icon: Building2,
      badgeClass: 'text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200/80 dark:border-indigo-700/80',
      steps: []
    },
    lifestyle: {
      key: 'lifestyle',
      name: 'Lifestyle & Area',
      shortLabel: 'areas',
      icon: Palmtree,
      badgeClass: 'text-teal-700 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/80 border-teal-200/80 dark:border-teal-700/80',
      steps: []
    },
    planning: {
      key: 'planning',
      name: 'Plan & Synthesize',
      shortLabel: 'plans',
      icon: BrainCircuit,
      badgeClass: 'text-violet-700 dark:text-violet-200 bg-violet-50 dark:bg-violet-950/80 border-violet-200/80 dark:border-violet-700/80',
      steps: []
    }
  };

  steps.forEach(step => {
    const sName = (step.name || '').toLowerCase();
    const sLabel = (step.label || '').toLowerCase();
    if (sName.includes('commute') || sName.includes('transit') || sLabel.includes('route') || sLabel.includes('commute') || sName.includes('matrix')) {
      categories.commute.steps.push(step);
    } else if (sName.includes('property') || sName.includes('filter') || sName.includes('listing') || sLabel.includes('listing') || sLabel.includes('rental') || sLabel.includes('propert')) {
      categories.property.steps.push(step);
    } else if (sName.includes('lifestyle') || sName.includes('amenit') || sLabel.includes('beach') || sLabel.includes('vibe') || sLabel.includes('lifestyle')) {
      categories.lifestyle.steps.push(step);
    } else {
      categories.planning.steps.push(step);
    }
  });

  return Object.values(categories).filter(c => c.steps.length > 0);
}

const markdownComponents = {
  table: ({ children, ...props }: any) => (
    <div className="my-3.5 w-full overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-white/70 dark:bg-slate-900/60 shadow-xs custom-scrollbar">
      <table className="min-w-full text-left border-collapse text-xs tabular-nums" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead className="bg-slate-100/95 dark:bg-slate-800/95 border-b border-slate-200/90 dark:border-slate-700/90" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }: any) => (
    <th className="px-3.5 py-2.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-left whitespace-nowrap" {...props}>
      {children}
    </th>
  ),
  tbody: ({ children, ...props }: any) => (
    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }: any) => (
    <tr className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors" {...props}>
      {children}
    </tr>
  ),
  td: ({ children, ...props }: any) => (
    <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 text-xs align-top whitespace-nowrap" {...props}>
      {children}
    </td>
  ),
  h1: ({ children, ...props }: any) => (
    <h1 className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1.5" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-xs font-bold text-slate-900 dark:text-white mt-3.5 mb-1.5 tracking-wide uppercase" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-xs font-semibold text-slate-900 dark:text-white mt-2 mb-1" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }: any) => (
    <p className="my-1.5 leading-relaxed text-slate-700 dark:text-slate-200 text-xs" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="my-1.5 space-y-1 list-disc pl-4 text-slate-700 dark:text-slate-300 text-xs" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="my-1.5 space-y-1 list-decimal pl-4 text-slate-700 dark:text-slate-300 text-xs" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-semibold text-slate-900 dark:text-white" {...props}>
      {children}
    </strong>
  ),
  code: ({ children, className, ...props }: any) => {
    const isInline = !className;
    return isInline ? (
      <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-[11px]" {...props}>
        {children}
      </code>
    ) : (
      <pre className="p-3 my-2 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    );
  }
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function linkifyProperties(content: string, properties?: Property[]): string {
  if (!content || !properties || properties.length === 0) return content;

  // Build candidate terms mapped to property IDs
  const candidates: { pattern: string; id: string }[] = [];
  const seenPatterns = new Set<string>();

  for (const prop of properties) {
    if (!prop.title || !prop.id) continue;
    const variants: string[] = [prop.title.trim()];

    const inMatch = prop.title.match(/^(.+?)\s+in\s+([^,]+)$/i);
    if (inMatch) {
      const base = inMatch[1].trim();
      const suburb = inMatch[2].trim();
      variants.push(`${base} (${suburb})`);
      if (base.length >= 8) {
        variants.push(base);
      }
    } else if (prop.suburb) {
      variants.push(`${prop.title.trim()} (${prop.suburb.trim()})`);
    }

    for (const v of variants) {
      const normalized = v.trim();
      if (normalized.length >= 6 && !seenPatterns.has(normalized.toLowerCase())) {
        seenPatterns.add(normalized.toLowerCase());
        candidates.push({ pattern: normalized, id: prop.id });
      }
    }
  }

  if (candidates.length === 0) return content;

  // Sort candidates by length descending so longer titles match first
  candidates.sort((a, b) => b.pattern.length - a.pattern.length);

  const patternToId = new Map<string, string>();
  const regexParts = candidates.map(c => {
    patternToId.set(c.pattern.toLowerCase(), c.id);
    return escapeRegex(c.pattern);
  });

  const combinedRegex = new RegExp(`(${regexParts.join('|')})`, 'gi');

  // Tokenize content into markdown links/code vs normal text
  const tokenRegex = /(\[[^\]]*\]\([^)]*\)|```[\s\S]*?```|`[^`\n]+`)/g;
  const parts = content.split(tokenRegex);

  return parts.map((part, index) => {
    // If it's a captured token (markdown link or code block), leave it untouched
    if (index % 2 === 1) {
      return part;
    }
    // Replace candidate mentions in normal text
    return part.replace(combinedRegex, (match) => {
      const id = patternToId.get(match.toLowerCase());
      if (id) {
        return `[${match}](property:${id})`;
      }
      return match;
    });
  }).join('');
}

export function ChatPanel({ 
  messages, 
  isThinking, 
  onSendMessage, 
  onSelectSession, 
  currentSessionId, 
  isLoggedIn,
  activeThinkingSteps = [],
  activeStatusLabel = null,
  streamingContent = '',
  isMaximized = false,
  onToggleMaximize,
  isWide = false,
  onToggleWide,
  onClose,
  properties = [],
  onSelectProperty
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [expandedStepsMap, setExpandedStepsMap] = useState<Record<string, boolean>>({});
  const [traceViewModeMap, setTraceViewModeMap] = useState<Record<string, 'grouped' | 'timeline'>>({});
  const [elapsedSecs, setElapsedSecs] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const customMarkdownComponents = useMemo(() => ({
    ...markdownComponents,
    a: ({ href, children, ...props }: any) => {
      if (href?.startsWith('property:')) {
        const propertyId = href.replace('property:', '');
        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectProperty?.(propertyId);
            }}
            className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline underline-offset-2 decoration-indigo-300 dark:decoration-indigo-600 hover:decoration-indigo-500 cursor-pointer transition-colors text-left py-0.5"
            title="Highlight property in listings"
          >
            <Building2 className="w-3.5 h-3.5 shrink-0 inline text-indigo-500 dark:text-indigo-400" />
            <span>{children}</span>
          </button>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-medium text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-2"
          {...props}
        >
          <span>{children}</span>
          <ExternalLink className="w-3 h-3 inline ml-0.5 opacity-70" />
        </a>
      );
    }
  }), [onSelectProperty]);

  useEffect(() => {
    let interval: any;
    if (isThinking) {
      setElapsedSecs(0);
      const start = Date.now();
      interval = setInterval(() => {
        setElapsedSecs(Math.round((Date.now() - start) / 100) / 10);
      }, 100);
    } else {
      setElapsedSecs(0);
    }
    return () => clearInterval(interval);
  }, [isThinking]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking, activeThinkingSteps, streamingContent]);

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

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await api.deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        onSelectSession?.(null);
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  return (
    <div className="w-full h-full bg-white/80 dark:bg-slate-900/95 backdrop-blur-3xl flex flex-col overflow-hidden relative text-slate-800 dark:text-slate-100">
      
      {/* Unified Executive Header: Kai Identity & Controls */}
      <div className="px-5 py-3 border-b border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 backdrop-blur-md shrink-0 flex items-center justify-between gap-3 z-20">
        
        {/* Left: Kai Brand Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-slate-900 dark:text-white text-sm whitespace-nowrap">
                Kai
              </h2>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/50">
                Sydney Concierge
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Deep Multi-Agent Active</span>
            </div>
          </div>
        </div>

        {/* Right: Window Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">

          {/* Session History Button */}
          {isLoggedIn && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Chat History"
            >
              {showHistory ? <X className="w-4 h-4" /> : <History className="w-4 h-4" />}
            </button>
          )}

          {/* Width Expand Toggle */}
          {onToggleWide && !isMaximized && (
            <button
              onClick={onToggleWide}
              className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                isWide 
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isWide ? "Standard Width (520px)" : "Expand Table View (720px)"}
            >
              <Columns2 className="w-4 h-4" />
            </button>
          )}

          {/* Maximize Toggle */}
          {onToggleMaximize && (
            <button 
              onClick={onToggleMaximize}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={isMaximized ? "Restore view" : "Maximize chat window"}
            >
              {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          )}

          {/* Close Button */}
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 p-5 overflow-y-auto bg-white/80 dark:bg-slate-900/80 z-20 custom-scrollbar">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Chat History</h3>
            <button 
              onClick={() => {
                onSelectSession?.(null);
                setShowHistory(false);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Chat
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-6">No previous sessions found.</p>
            ) : (
              sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => {
                    onSelectSession?.(s.id);
                    setShowHistory(false);
                  }}
                  className={`group flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                    currentSessionId === s.id 
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200' 
                      : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-semibold truncate">{s.title || 'New Chat'}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {new Date(s.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all shrink-0"
                    title="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Main Message Canvas: Unboxed & Spacious */}
          <div 
            ref={scrollRef}
            className="flex-1 p-5 overflow-y-auto flex flex-col gap-5 custom-scrollbar relative z-10"
          >
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 my-auto">
                <div className="relative mb-3">
                  <div className="w-14 h-14 bg-blue-600 rounded-full shadow-lg shadow-blue-500/25 flex items-center justify-center text-white">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base mb-1">G'day! I'm Kai, your Sydney Concierge</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mb-6 leading-relaxed">
                  I coordinate deep multi-agent research across Sydney rentals, Metro M1 and rail lines, beach access, and fair rent comparisons. What are you looking for?
                </p>

                {/* Suggestion Chips */}
                <div className="w-full max-w-md space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-left px-1">
                    Suggested Questions for Kai
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(s)}
                        className="text-left text-xs font-medium bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/70 shadow-2xs transition-all flex items-center gap-2.5 hover:scale-[1.01]"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const groupedCategories = msg.steps && msg.steps.length > 0 
                  ? groupStepsByCategory(msg.steps) 
                  : [];
                const isExpanded = expandedStepsMap[msg.id] ?? false;
                const traceViewMode = traceViewModeMap[msg.id] ?? 'grouped';

                return msg.role === 'user' ? (
                  /* User Bubble: Clean pill aligned to the right */
                  <div key={msg.id} className="self-end max-w-[85%]">
                    <div className="px-4 py-2.5 rounded-2xl rounded-tr-xs bg-blue-600 text-white text-xs font-medium leading-relaxed shadow-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  /* Assistant Response: Full-width unboxed canvas with generous breathing room */
                  <div 
                    key={msg.id} 
                    className="w-full space-y-3 pt-1 pb-4 text-slate-800 dark:text-slate-100 text-xs leading-relaxed border-b border-slate-100 dark:border-slate-800/60 last:border-b-0"
                  >
                    <div className="w-full">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} 
                        urlTransform={(url) => url}
                        components={customMarkdownComponents}
                      >
                        {linkifyProperties(msg.content, properties)}
                      </ReactMarkdown>
                    </div>

                    {/* Deep Agent Multi-Agent Trace Card */}
                    {msg.agentType === 'deep_agent' && (
                      <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                        {msg.steps && msg.steps.length > 0 ? (
                          <div className="space-y-2">
                            {/* Trace Summary Bar */}
                            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => setExpandedStepsMap(prev => ({ ...prev, [msg.id]: !isExpanded }))}
                                className="flex-1 flex items-center gap-2 min-w-0 text-left hover:opacity-85 transition-opacity"
                              >
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <BrainCircuit className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                  <span className="font-semibold text-[11px] text-slate-800 dark:text-slate-100">
                                    Multi-Agent Trace
                                  </span>
                                </div>

                                {/* Compact Specialist Pills */}
                                <div className="hidden sm:flex items-center gap-1.5 truncate">
                                  {groupedCategories.map(cat => {
                                    const Icon = cat.icon;
                                    return (
                                      <span 
                                        key={cat.key} 
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium shrink-0 ${cat.badgeClass}`}
                                      >
                                        <Icon className="w-2.5 h-2.5 shrink-0" />
                                        <span>{cat.steps.length} {cat.shortLabel}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </button>

                              <div className="flex items-center gap-2 shrink-0">
                                {msg.latencySeconds && (
                                  <span className="flex items-center gap-1 text-[10px] font-mono tabular-nums text-slate-600 dark:text-slate-200 bg-white/90 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700">
                                    <Clock className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
                                    <span>{msg.latencySeconds}s</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setExpandedStepsMap(prev => ({ ...prev, [msg.id]: !isExpanded }))}
                                  className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white rounded-md transition-colors"
                                >
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            {/* Expanded Detailed Breakdown */}
                            {isExpanded && (
                              <div className="mt-2 space-y-2.5 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/90 shadow-inner">
                                {/* View Selector Tab */}
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                    {msg.steps.length} Steps Orchestrated
                                  </span>
                                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/80 text-[10px] font-medium">
                                    <button
                                      type="button"
                                      onClick={() => setTraceViewModeMap(prev => ({ ...prev, [msg.id]: 'grouped' }))}
                                      className={`px-2 py-0.5 rounded transition-all ${
                                        traceViewMode === 'grouped' 
                                          ? 'bg-indigo-600 text-white font-semibold shadow-2xs' 
                                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                                      }`}
                                    >
                                      By Specialist
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setTraceViewModeMap(prev => ({ ...prev, [msg.id]: 'timeline' }))}
                                      className={`px-2 py-0.5 rounded transition-all ${
                                        traceViewMode === 'timeline' 
                                          ? 'bg-indigo-600 text-white font-semibold shadow-2xs' 
                                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                                      }`}
                                    >
                                      Timeline
                                    </button>
                                  </div>
                                </div>

                                {/* View 1: Grouped By Specialist */}
                                {traceViewMode === 'grouped' ? (
                                  <div className="space-y-2.5 pt-1">
                                    {groupedCategories.map(cat => {
                                      const Icon = cat.icon;
                                      return (
                                        <div 
                                          key={cat.key} 
                                          className="rounded-lg p-2.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-2"
                                        >
                                          <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-1.5">
                                              <div className={`p-1 rounded-md border ${cat.badgeClass}`}>
                                                <Icon className="w-3 h-3" />
                                              </div>
                                              <span>{cat.name}</span>
                                            </div>
                                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-300">
                                              {cat.steps.length} actions
                                            </span>
                                          </div>

                                          <div className="space-y-1.5 pl-1">
                                            {cat.steps.map((st, sIdx) => (
                                              <div key={st.id || sIdx} className="flex items-start gap-1.5 text-[11px] leading-tight">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                                <div className="min-w-0 flex-1">
                                                  <p className="font-medium text-slate-800 dark:text-slate-100">
                                                    {st.label}
                                                  </p>
                                                  {st.detail && (
                                                    <p className="text-[10px] text-slate-600 dark:text-slate-200 font-mono mt-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-700/60 break-all leading-normal">
                                                      {st.detail}
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  /* View 2: Sequential Timeline */
                                  <div className="space-y-2 pt-1 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                    {msg.steps.map((st, idx) => (
                                      <div key={st.id || idx} className="flex items-start gap-2 text-[11px]">
                                        <span className="font-mono text-[9px] font-semibold text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0 mt-0.5">
                                          #{idx + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                            <span className="truncate">{st.label}</span>
                                          </div>
                                          {st.detail && (
                                            <p className="text-[10px] text-slate-600 dark:text-slate-200 font-mono mt-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-700/60 break-all leading-normal pl-2">
                                              {st.detail}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold px-1">
                            <span className="flex items-center gap-1.5">
                              <BrainCircuit className="w-3.5 h-3.5" />
                              <span>LangChain Deep Agent Execution</span>
                            </span>
                            {msg.latencySeconds && (
                              <span className="text-slate-400 font-mono text-[10px]">
                                {msg.latencySeconds}s
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            
            {/* Live Thinking / Streaming Card */}
            {isThinking && (
              <div className="self-start flex flex-col w-full">
                <div className="p-4 bg-white/95 dark:bg-slate-800/95 border border-blue-200/90 dark:border-blue-900/70 rounded-2xl shadow-md shadow-blue-500/5 backdrop-blur-md text-xs space-y-3">
                  {/* Card Header with Live Stopwatch */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                      <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {activeStatusLabel || 'Kai is researching Sydney listings & routes...'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono tabular-nums font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span>{elapsedSecs.toFixed(1)}s</span>
                    </span>
                  </div>

                  {/* Live Steps Activity Log - Compact Window */}
                  {activeThinkingSteps.length > 0 && (
                    <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-700/60 pt-2.5">
                      {activeThinkingSteps.length > 3 && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-300 font-medium pl-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{activeThinkingSteps.length - 3} earlier steps completed</span>
                        </div>
                      )}
                      {activeThinkingSteps.slice(-3).map((st, idx, arr) => {
                        const isLast = idx === arr.length - 1;
                        return (
                          <div key={st.id || idx} className="flex items-start gap-1.5 text-[11px] leading-tight">
                            {st.status === 'completed' || !isLast ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <div className="w-3.5 h-3.5 relative shrink-0 mt-0.5 flex items-center justify-center">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping absolute" />
                                <span className="w-2 h-2 rounded-full bg-blue-600 relative" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={`font-medium ${isLast ? 'text-blue-800 dark:text-blue-200 font-semibold' : 'text-slate-800 dark:text-slate-200'}`}>
                                {st.label}
                              </p>
                              {st.detail && (
                                <p className="text-[10px] text-slate-600 dark:text-slate-300 font-mono truncate">{st.detail}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Streaming Response Markdown */}
                  {streamingContent && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} 
                        urlTransform={(url) => url}
                        components={customMarkdownComponents}
                      >
                        {linkifyProperties(streamingContent, properties)}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Input Area */}
          <div className="p-3.5 bg-white/70 dark:bg-slate-900/80 border-t border-slate-200/70 dark:border-slate-800 backdrop-blur-md relative z-10 shrink-0">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Kai about Sydney rentals, commutes, lifestyle..." 
                disabled={isThinking}
                className="w-full pl-4 pr-12 py-3 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-xs backdrop-blur-md shadow-xs disabled:opacity-50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-white font-medium"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isThinking}
                className="absolute right-1.5 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-all shadow-xs disabled:shadow-none"
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
