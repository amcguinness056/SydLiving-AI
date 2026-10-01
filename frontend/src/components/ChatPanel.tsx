import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  ExternalLink,
  Pencil,
  Check,
  MessageSquare,
  Lock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, type ChatSession, type DeepAgentStep, type Property } from '../api/client';
import { cn } from '../lib/utils';

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
  onRequireAuth?: () => void;
}

const SUGGESTIONS = [
  "Show rentals under 25 mins to Barangaroo",
  "Top 3 rated cafes & coffee spots near here",
  "Metro-connected 2BR under $850/wk",
  "Beachside rentals under 35m to Central",
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
      badgeClass: 'text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/80 border-blue-200/80 dark:border-blue-700/80',
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
    <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors" {...props}>
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
      <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-[11px]" {...props}>
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

interface LinkifyCacheData {
  combinedRegex: RegExp | null;
  patternToId: Map<string, string>;
}

let cachedLinkifyKey = '';
let cachedLinkifyData: LinkifyCacheData = { combinedRegex: null, patternToId: new Map() };

function getLinkifyData(properties?: Property[]): LinkifyCacheData {
  if (!properties || properties.length === 0) {
    return { combinedRegex: null, patternToId: new Map() };
  }

  // Fast signature check based on property count and ID concatenation
  const key = properties.length + ':' + properties.map(p => p.id).join(',');
  if (key === cachedLinkifyKey) {
    return cachedLinkifyData;
  }

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

  if (candidates.length === 0) {
    cachedLinkifyKey = key;
    cachedLinkifyData = { combinedRegex: null, patternToId: new Map() };
    return cachedLinkifyData;
  }

  candidates.sort((a, b) => b.pattern.length - a.pattern.length);

  const patternToId = new Map<string, string>();
  const regexParts = candidates.map(c => {
    patternToId.set(c.pattern.toLowerCase(), c.id);
    return escapeRegex(c.pattern);
  });

  const combinedRegex = new RegExp(`(${regexParts.join('|')})`, 'gi');
  cachedLinkifyKey = key;
  cachedLinkifyData = { combinedRegex, patternToId };
  return cachedLinkifyData;
}

function linkifyProperties(content: string, properties?: Property[]): string {
  if (!content) return content;
  const { combinedRegex, patternToId } = getLinkifyData(properties);
  if (!combinedRegex) return content;

  // Tokenize content into markdown links/code vs normal text
  const tokenRegex = /(\[[^\]]*\]\([^)]*\)|```[\s\S]*?```|`[^`\n]+`)/g;
  const parts = content.split(tokenRegex);

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return part;
    }
    return part.replace(combinedRegex, (match) => {
      const id = patternToId.get(match.toLowerCase());
      if (id) {
        return `[${match}](property:${id})`;
      }
      return match;
    });
  }).join('');
}

interface ChatMessageItemProps {
  msg: Message;
  properties?: Property[];
  customMarkdownComponents: any;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  traceViewMode: 'grouped' | 'timeline';
  onSetTraceViewMode: (id: string, mode: 'grouped' | 'timeline') => void;
}

const ChatMessageItem = React.memo(function ChatMessageItem({
  msg,
  properties,
  customMarkdownComponents,
  isExpanded,
  onToggleExpand,
  traceViewMode,
  onSetTraceViewMode
}: ChatMessageItemProps) {
  const groupedCategories = useMemo(() => {
    return msg.steps && msg.steps.length > 0 ? groupStepsByCategory(msg.steps) : [];
  }, [msg.steps]);

  const parsedContent = useMemo(() => {
    return linkifyProperties(msg.content, properties);
  }, [msg.content, properties]);

  if (msg.role === 'user') {
    return (
      <div className="self-end max-w-[85%]">
        <div className="px-4 py-2.5 rounded-2xl rounded-tr-xs bg-blue-600 text-white text-xs font-medium leading-relaxed shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 pt-1 pb-4 text-slate-800 dark:text-slate-100 text-xs leading-relaxed border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
      <div className="w-full">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]} 
          urlTransform={(url) => url}
          components={customMarkdownComponents}
        >
          {parsedContent}
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
                  onClick={() => onToggleExpand(msg.id)}
                  className="flex-1 flex items-center gap-2 min-w-0 text-left hover:opacity-85 transition-opacity"
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    <BrainCircuit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
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
                    onClick={() => onToggleExpand(msg.id)}
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
                        onClick={() => onSetTraceViewMode(msg.id, 'grouped')}
                        className={`px-2 py-0.5 rounded transition-all ${
                          traceViewMode === 'grouped' 
                            ? 'bg-blue-600 text-white font-semibold shadow-2xs' 
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                        }`}
                      >
                        By Specialist
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetTraceViewMode(msg.id, 'timeline')}
                        className={`px-2 py-0.5 rounded transition-all ${
                          traceViewMode === 'timeline' 
                            ? 'bg-blue-600 text-white font-semibold shadow-2xs' 
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
                          <span className="font-mono text-[9px] font-semibold text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 shrink-0 mt-0.5">
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
            <div className="flex items-center justify-between text-[11px] text-blue-700 dark:text-blue-300 font-semibold px-1">
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
});

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
  onSelectProperty,
  onRequireAuth
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [expandedStepsMap, setExpandedStepsMap] = useState<Record<string, boolean>>({});
  const [traceViewModeMap, setTraceViewModeMap] = useState<Record<string, 'grouped' | 'timeline'>>({});
  const [elapsedSecs, setElapsedSecs] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentQuery = useMemo(
    () => [...messages].reverse().find(m => m.role === 'user')?.content || '',
    [messages]
  );

  // Derive what Kai is currently doing based on the user's inquiry, elapsed time, and real subagent steps
  const activeTaskAnalysis = useMemo(() => {
    const q = currentQuery.toLowerCase();

    // Check if user specified a destination hub
    let destination = '';
    if (q.includes('barangaroo')) destination = 'Barangaroo';
    else if (q.includes('martin place')) destination = 'Martin Place';
    else if (q.includes('victoria cross') || q.includes('north sydney')) destination = 'Victoria Cross / North Sydney';
    else if (q.includes('central')) destination = 'Central';
    else if (q.includes('parramatta')) destination = 'Parramatta';
    else if (q.includes('macquarie park') || q.includes('macquarie')) destination = 'Macquarie Park';

    // Check if user mentioned suburbs
    let suburb = '';
    const knownSuburbs = ['newtown', 'crows nest', 'surry hills', 'bondi', 'coogee', 'manly', 'paddington', 'balmain', 'redfern', 'chatswood', 'pyrmont', 'maroubra', 'glebe', 'wollstonecraft'];
    for (const s of knownSuburbs) {
      if (q.includes(s)) {
        suburb = s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    // Check features
    const hasBudget = q.match(/\$?\d{3,4}/);

    // 4 standard sequential phases with descriptive explanations of Kai's actions
    const stages = [
      {
        id: 'analysis',
        name: 'Analyze Requirements',
        actionLabel: destination 
          ? `Targeting commute route to ${destination}${hasBudget ? ` under ${hasBudget[0]}/wk` : ''}` 
          : suburb 
            ? `Analyzing rental opportunities in ${suburb}`
            : 'Deconstructing commute constraints, weekly budget ceiling & lifestyle vibe',
        description: destination
          ? `Deconstructing door-to-door transit goals to ${destination} and aligning lifestyle filters.`
          : 'Parsing your prompt for target hubs, price brackets, bedrooms, and pet/parking requirements.',
        minSecs: 0,
        maxSecs: 1.8
      },
      {
        id: 'transit',
        name: 'Sydney Commute Matrix',
        actionLabel: destination
          ? `Calculating peak door-to-door transit times to ${destination}`
          : 'Querying Transport for NSW transit matrix (Metro, trains, ferries & Opal fares)',
        description: destination
          ? `Querying Sydney Metro M1, Sydney Trains & bus frequencies to verify realistic commute times to ${destination}.`
          : 'Evaluating multi-modal travel times, interchanges, line reliability, and daily Opal fare caps.',
        minSecs: 1.8,
        maxSecs: 4.2
      },
      {
        id: 'properties',
        name: 'Rental Database Scout',
        actionLabel: suburb
          ? `Scanning active listings in ${suburb} matching criteria`
          : 'Searching verified Sydney rental listings matching budget & preferences',
        description: suburb
          ? `Searching available properties in ${suburb} and cross-referencing floor plans, rent, and amenities.`
          : 'Querying active real estate listings to match rent thresholds, bedroom counts, and pet/parking options.',
        minSecs: 4.2,
        maxSecs: 7.0
      },
      {
        id: 'synthesis',
        name: 'Formulate Kai Recommendations',
        actionLabel: 'Synthesizing neighborhood insights & composing candid verdicts',
        description: 'Analyzing suburb pros & cons, comparing rent trade-offs, and compiling personalized recommendations.',
        minSecs: 7.0,
        maxSecs: 999
      }
    ];

    // Determine current active stage index based on elapsed seconds
    let activeStageIdx = 0;
    if (elapsedSecs >= 7.0) activeStageIdx = 3;
    else if (elapsedSecs >= 4.2) activeStageIdx = 2;
    else if (elapsedSecs >= 1.8) activeStageIdx = 1;
    else activeStageIdx = 0;

    // If real backend steps are running, reflect the most recent step
    const runningStep = [...activeThinkingSteps].reverse().find(s => s.status === 'running');
    const currentStatusText = activeStatusLabel || (runningStep ? runningStep.label : stages[activeStageIdx].actionLabel);

    return {
      destination,
      suburb,
      stages,
      activeStageIdx,
      currentStatusText,
      activeStage: stages[activeStageIdx]
    };
  }, [currentQuery, elapsedSecs, activeThinkingSteps, activeStatusLabel]);

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
            className="inline-flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline underline-offset-2 decoration-blue-300 dark:decoration-blue-600 hover:decoration-blue-500 cursor-pointer transition-colors text-left py-0.5"
            title="Highlight property in listings"
          >
            <Building2 className="w-3.5 h-3.5 shrink-0 inline text-blue-500 dark:text-blue-400" />
            <span>{children}</span>
          </button>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-medium text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
          {...props}
        >
          <span>{children}</span>
          <ExternalLink className="w-3 h-3 inline ml-0.5 opacity-70" />
        </a>
      );
    }
  }), [onSelectProperty]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedStepsMap(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSetTraceViewMode = useCallback((id: string, mode: 'grouped' | 'timeline') => {
    setTraceViewModeMap(prev => ({ ...prev, [id]: mode }));
  }, []);

  useEffect(() => {
    let interval: any;
    if (isThinking) {
      setElapsedSecs(0);
      const start = Date.now();
      interval = setInterval(() => {
        setElapsedSecs(Math.round((Date.now() - start) / 100) / 10);
      }, 250);
    } else {
      setElapsedSecs(0);
    }
    return () => clearInterval(interval);
  }, [isThinking]);

  const scrollRafRef = useRef<number | null>(null);
  const userScrolledUpRef = useRef<boolean>(false);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If user scrolled up more than 100px from bottom, keep their view steady
    userScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 100;
  }, []);

  useEffect(() => {
    if (userScrolledUpRef.current) return;
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      if (scrollRef.current && !userScrolledUpRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [messages, isThinking, activeThinkingSteps, streamingContent]);

  useEffect(() => {
    if (showHistory && isLoggedIn) {
      api.getChatSessions().then(setSessions).catch(console.error);
    }
  }, [showHistory, isLoggedIn]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    if (!isLoggedIn) {
      onRequireAuth?.();
      return;
    }
    onSendMessage(input.trim());
    setInput('');
  };

  const handleSuggestionClick = (query: string) => {
    if (isThinking) return;
    if (!isLoggedIn) {
      onRequireAuth?.();
      return;
    }
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

  const handleStartRename = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title || '');
  };

  const handleSaveRename = async (e: React.MouseEvent | React.FormEvent, sessionId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const trimmed = editTitle.trim();
    if (!trimmed || isSavingTitle) return;
    setIsSavingTitle(true);
    try {
      const updated = await api.updateChatSession(sessionId, trimmed);
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: updated.title } : s));
      setEditingSessionId(null);
    } catch (err) {
      console.error("Failed to rename session", err);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(null);
    setEditTitle('');
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
              className={`hidden sm:flex p-1.5 rounded-lg transition-colors items-center justify-center ${
                isWide 
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' 
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
              className="hidden sm:flex p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
              className="flex items-center gap-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/80 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Chat
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-6">No previous sessions found.</p>
            ) : (
              sessions.map(s => {
                const isEditing = editingSessionId === s.id;
                const isCurrent = currentSessionId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (isEditing) return;
                      onSelectSession?.(s.id);
                      setShowHistory(false);
                    }}
                    className={`group flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isCurrent 
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-200' 
                        : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-2">
                      <MessageSquare className={`w-4 h-4 mt-0.5 shrink-0 ${isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <form onSubmit={(e) => handleSaveRename(e, s.id)} className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              autoFocus
                              disabled={isSavingTitle}
                              className="w-full px-2 py-1 text-xs rounded border border-blue-400 dark:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveRename(e, s.id)}
                              disabled={isSavingTitle}
                              className="p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded transition-colors"
                              title="Save title"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelRename}
                              disabled={isSavingTitle}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <>
                            <div className="font-semibold truncate text-[13px] text-slate-900 dark:text-slate-100" title={s.title || 'New Chat'}>
                              {s.title || 'New Chat'}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {new Date(s.updated_at).toLocaleString([], {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(e, s)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                          title="Rename session"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(e, s.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                          title="Delete session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Main Message Canvas: Unboxed & Spacious */}
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
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
              messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  msg={msg}
                  properties={properties}
                  customMarkdownComponents={customMarkdownComponents}
                  isExpanded={expandedStepsMap[msg.id] ?? false}
                  onToggleExpand={handleToggleExpand}
                  traceViewMode={traceViewModeMap[msg.id] ?? 'grouped'}
                  onSetTraceViewMode={handleSetTraceViewMode}
                />
              ))
            )}
            
            {/* Live Thinking / Streaming Card */}
            {isThinking && (
              <div className="self-start flex flex-col w-full animate-in fade-in duration-200">
                <div className="p-4 bg-white/95 dark:bg-slate-800/95 border border-blue-200/90 dark:border-blue-900/70 rounded-2xl shadow-md shadow-blue-500/5 backdrop-blur-md text-xs space-y-3.5">
                  
                  {/* Card Header with Active Indicator & Live Stopwatch */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative flex items-center justify-center shrink-0">
                        <span className="w-3 h-3 rounded-full bg-blue-500/30 animate-ping absolute" />
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 relative" />
                      </div>
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span className="font-extrabold text-blue-700 dark:text-blue-300 text-[11px] tracking-wide uppercase">
                          Kai AI Concierge
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">•</span>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {activeTaskAnalysis.activeStage.name}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono tabular-nums font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span>{elapsedSecs.toFixed(1)}s</span>
                    </span>
                  </div>

                  {/* Primary Current Operation Banner (Explaining EXACTLY what Kai is doing right now) */}
                  <div className="bg-blue-50/80 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/60 rounded-xl p-3">
                    <div className="flex items-start gap-2.5">
                      <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                          {activeTaskAnalysis.currentStatusText}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {activeTaskAnalysis.activeStage.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progressive Multi-Step Activity Pipeline */}
                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      <span>Research & Reasoning Pipeline</span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Stage {activeTaskAnalysis.activeStageIdx + 1} of {activeTaskAnalysis.stages.length}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700/80 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-sky-500 transition-all duration-300 rounded-full"
                        style={{ width: `${Math.min(100, ((activeTaskAnalysis.activeStageIdx + 1) / activeTaskAnalysis.stages.length) * 100)}%` }}
                      />
                    </div>

                    {/* Live Stages Micro-List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {activeTaskAnalysis.stages.map((st, sIdx) => {
                        const isDone = sIdx < activeTaskAnalysis.activeStageIdx;
                        const isCurrent = sIdx === activeTaskAnalysis.activeStageIdx;
                        return (
                          <div 
                            key={st.id}
                            className={cn(
                              "flex items-center gap-2 p-1.5 rounded-lg text-[11px] transition-colors",
                              isCurrent
                                ? "bg-blue-100/50 dark:bg-blue-900/30 text-blue-950 dark:text-blue-100 font-bold border border-blue-200/60 dark:border-blue-800/60"
                                : isDone
                                  ? "text-slate-700 dark:text-slate-300 font-medium"
                                  : "text-slate-500 dark:text-slate-400 opacity-60"
                            )}
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : isCurrent ? (
                              <div className="w-3.5 h-3.5 relative shrink-0 flex items-center justify-center">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping absolute" />
                                <span className="w-2 h-2 rounded-full bg-blue-600 relative" />
                              </div>
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                            )}
                            <span className="truncate">{st.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Real Backend Subagent & Tool Steps (if emitted) */}
                  {activeThinkingSteps.length > 0 && (
                    <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-700/60 pt-2.5">
                      <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 pl-1">
                        Active Subagent Operations ({activeThinkingSteps.length})
                      </div>
                      {activeThinkingSteps.slice(-3).map((st, idx, arr) => {
                        const isLast = idx === arr.length - 1;
                        return (
                          <div key={st.id || idx} className="flex items-start gap-1.5 text-[11px] leading-tight bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            {st.status === 'completed' || !isLast ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <div className="w-3.5 h-3.5 relative shrink-0 mt-0.5 flex items-center justify-center">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping absolute" />
                                <span className="w-2 h-2 rounded-full bg-blue-600 relative" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={`font-medium ${isLast ? 'text-blue-900 dark:text-blue-200 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>
                                {st.label}
                              </p>
                              {st.detail && (
                                <p className="text-[10px] text-slate-600 dark:text-slate-300 font-mono truncate mt-0.5">{st.detail}</p>
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
          
          {/* Input Area or Sign-In Gate */}
          <div className="p-3.5 bg-white/70 dark:bg-slate-900/80 border-t border-slate-200/70 dark:border-slate-800 backdrop-blur-md relative z-10 shrink-0">
            {isLoggedIn ? (
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
                  className="absolute right-1.5 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-all shadow-xs disabled:shadow-none cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3 p-1">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Sign in with Google to chat with Kai</span>
                </div>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 shadow-md shadow-blue-500/20 cursor-pointer transition-all"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
