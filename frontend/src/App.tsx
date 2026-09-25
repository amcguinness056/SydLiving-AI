import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Map } from './components/Map';
import { PropertyCard } from './components/PropertyCard';
import { PropertyPanel } from './components/PropertyPanel';
import { CompareModal } from './components/CompareModal';
import { AuthModal } from './components/AuthModal';
import { api, type Property, type AgentAction, type User, type DeepAgentStep } from './api/client';
import { ChatPanel, type Message } from './components/ChatPanel';
import { KaiLauncher } from './components/KaiLauncher';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sparkles, Sun, Moon, Heart, LogOut, List, Map as MapIcon, X } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { cn } from './lib/utils';

type MaximizedState = 'list' | 'map' | 'details' | 'chat' | null;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

function UserAvatar({ user, className = "w-6 h-6" }: { user: { username?: string; avatar_url?: string }, className?: string }) {

  const [imgError, setImgError] = useState(false);
  const initial = (user.username || 'U').charAt(0).toUpperCase();
  
  if (imgError || !user.avatar_url) {
    return (
      <div className={cn("rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-indigo-500 text-white font-black flex items-center justify-center text-[11px] shrink-0 shadow-xs border border-white/40 dark:border-slate-600 select-none", className)}>
        {initial}
      </div>
    );
  }

  return (
    <img 
      src={user.avatar_url}
      alt={user.username || 'User avatar'} 
      onError={() => setImgError(true)}
      className={cn("rounded-full object-cover border border-slate-200 dark:border-slate-600 shrink-0", className)}
    />
  );
}

interface SearchFilterBarProps {
  keyword: string;
  propertyType: string;
  onSearch: (keyword: string, propertyType: string) => void;
  onAskKai: (prompt: string) => void;
}

const SearchFilterBar = React.memo(function SearchFilterBar({
  keyword,
  propertyType,
  onSearch,
  onAskKai
}: SearchFilterBarProps) {
  const [localKeyword, setLocalKeyword] = useState(keyword);
  const [localType, setLocalType] = useState(propertyType);

  useEffect(() => {
    setLocalKeyword(keyword);
  }, [keyword]);

  useEffect(() => {
    setLocalType(propertyType);
  }, [propertyType]);

  const handleApply = () => {
    onSearch(localKeyword, localType);
  };

  return (
    <div className="px-4 py-2.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-b border-white/40 dark:border-slate-800 shadow-sm z-10 shrink-0 flex flex-col gap-2">
      <input 
        type="text"
        placeholder="Search listings & descriptions..."
        className="w-full px-3 py-1.5 bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
        value={localKeyword}
        onChange={e => setLocalKeyword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleApply()}
      />
      <div className="flex gap-2">
        <select 
          className="flex-1 px-2.5 py-1.5 bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-700 dark:text-slate-200"
          value={localType}
          onChange={e => {
            setLocalType(e.target.value);
            onSearch(localKeyword, e.target.value);
          }}
        >
          <option value="">All Types</option>
          <option value="Apartment">Apartment</option>
          <option value="House">House</option>
          <option value="Studio">Studio</option>
          <option value="Terrace">Terrace</option>
          <option value="Sharehouse">Sharehouse</option>
        </select>
        <button 
          onClick={handleApply}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          Search
        </button>
      </div>

      <button
        type="button"
        onClick={() => onAskKai("Show 2-bedroom rentals near Sydney Metro stations with high walkability")}
        className="text-left text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1.5 transition-colors group cursor-pointer pt-0.5"
      >
        <Sparkles className="w-3 h-3 text-blue-500 group-hover:rotate-12 transition-transform shrink-0" />
        <span className="truncate">Or ask Kai: "2BR near Metro with high walkability"</span>
      </button>
    </div>
  );
});

function App() {
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');
  const [properties, setProperties] = useState<Property[]>([]);
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalPropertyId, setModalPropertyId] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep selectedProperty in sync if properties update
  useEffect(() => {
    if (modalPropertyId) {
      const match = properties.find(p => p.id === modalPropertyId) || savedProperties.find(p => p.id === modalPropertyId);
      if (match) {
        setSelectedProperty(match);
      }
    }
  }, [properties, savedProperties, modalPropertyId]);

  
  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('sydliving_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Shortlist State
  const [shortlistedIds, setShortlistedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sydliving_shortlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Search & Filter State
  const [keywordFilter, setKeywordFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [spatialFilter, setSpatialFilter] = useState<{ circle?: string, polygon?: string } | null>(null);
  const [activeFilters, setActiveFilters] = useState<any>(null);

  // UI State
  const [maximizedPanel, setMaximizedPanel] = useState<MaximizedState>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState<'normal' | 'wide'>('normal');

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeThinkingSteps, setActiveThinkingSteps] = useState<DeepAgentStep[]>([]);
  const [activeStatusLabel, setActiveStatusLabel] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');

  // Apply dark mode class to html document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sydliving_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sydliving_theme', 'light');
    }
  }, [isDarkMode]);

  // Persist shortlist
  useEffect(() => {
    localStorage.setItem('sydliving_shortlist', JSON.stringify(shortlistedIds));
  }, [shortlistedIds]);

  // Auth restore
  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    const username = localStorage.getItem('username');
    const email = localStorage.getItem('user_email') || undefined;
    const avatarUrl = localStorage.getItem('user_avatar') || undefined;
    if (userId && username) {
      setUser({ id: userId, username, email, avatar_url: avatarUrl });
    }
  }, []);

  const loadSavedProperties = useCallback(async () => {
    try {
      const data = await api.getSavedProperties();
      setSavedProperties(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load saved properties", err);
      setSavedProperties([]);
    }
  }, []);

  const loadProperties = useCallback(async (filters?: any) => {
    setLoading(true);
    const combinedFilters = {
      keyword: keywordFilter || undefined,
      property_type: typeFilter || undefined,
      circle: spatialFilter?.circle,
      polygon: spatialFilter?.polygon,
      ...(filters || {})
    };
    setActiveFilters(
      combinedFilters.suburb || combinedFilters.max_rent || combinedFilters.min_bedrooms || 
      combinedFilters.keyword || combinedFilters.property_type || combinedFilters.circle || combinedFilters.polygon 
        ? combinedFilters 
        : null
    );
    try {
      const data = await api.getProperties(combinedFilters);
      setProperties(data);
    } catch (err) {
      console.error("Failed to load properties", err);
    } finally {
      setLoading(false);
    }
  }, [keywordFilter, typeFilter, spatialFilter]);

  // Reload properties on initial mount or when spatial filters change
  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (user) {
      loadSavedProperties();
    } else {
      setSavedProperties([]);
      setShowSavedOnly(false);
    }
  }, [user, loadSavedProperties]);

  const handleSearchFilter = useCallback((newKeyword: string, newType: string) => {
    setKeywordFilter(newKeyword);
    setTypeFilter(newType);
    loadProperties({
      keyword: newKeyword || undefined,
      property_type: newType || undefined,
      circle: spatialFilter?.circle,
      polygon: spatialFilter?.polygon
    });
  }, [spatialFilter, loadProperties]);

  const handleToggleFavorite = useCallback((id: string) => {
    setShortlistedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  const handleToggleSave = useCallback(async (id: string, isSaved: boolean) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      if (isSaved) {
        await api.unsaveProperty(id);
      } else {
        await api.saveProperty(id);
      }
      loadSavedProperties();
    } catch (err) {
      console.error("Failed to toggle save", err);
    }
  }, [user, loadSavedProperties]);

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('user_id', newUser.id);
    localStorage.setItem('username', newUser.username);
    if (newUser.email) localStorage.setItem('user_email', newUser.email);
    if (newUser.avatar_url) localStorage.setItem('user_avatar', newUser.avatar_url);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_avatar');
    setCurrentSessionId(null);
    setMessages([]);
    setChatHistory([]);
  };

  const handleAgentAction = useCallback((action: AgentAction) => {
    if (action.action_type === 'update_properties') {
      loadProperties(action.data);
    } else if (action.action_type === 'update_commute_filters') {
      loadProperties({
        suburb: action.data.suburb,
        destination_hub: action.data.destination_hub,
        max_commute_mins: action.data.max_commute_minutes,
        max_rent: action.data.max_rent < 99999 ? action.data.max_rent : undefined,
        min_bedrooms: action.data.min_bedrooms > 0 ? action.data.min_bedrooms : undefined
      });
    } else if (action.action_type === 'set_session') {
      setCurrentSessionId(action.data.session_id);
    }
  }, [loadProperties]);

  const handleSendMessage = useCallback(async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);
    setActiveThinkingSteps([]);
    setActiveStatusLabel(null);
    setStreamingContent('');

    try {
      let accumulatedText = '';
      let finalSteps: DeepAgentStep[] = [];
      let finalLatency = 0;
      let finalActions: AgentAction[] = [];
      const seenActionKeys = new Set<string>();

      await api.streamDeepChatMessage(
        text,
        chatHistory,
        currentSessionId || undefined,
        {
          onStatus: (_stage, label) => {
            setActiveStatusLabel(label);
          },
          onStep: (step) => {
            setActiveThinkingSteps(prev => {
              const idx = prev.findIndex(s => s.id === step.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...step };
                return copy;
              }
              return [...prev, step];
            });
          },
          onStepDone: (id) => {
            setActiveThinkingSteps(prev =>
              prev.map(s => s.id === id ? { ...s, status: 'completed' as const } : s)
            );
          },
          onAction: (action) => {
            const key = JSON.stringify(action);
            if (!seenActionKeys.has(key)) {
              seenActionKeys.add(key);
              handleAgentAction(action);
            }
          },
          onChunk: (chunk) => {
            accumulatedText += chunk;
            setStreamingContent(accumulatedText);
          },
          onDone: (result) => {
            accumulatedText = result.reply || accumulatedText;
            finalSteps = result.steps || [];
            finalLatency = result.latency_seconds;
            finalActions = result.actions || [];
          },
          onError: (err) => {
            console.error("Deep agent stream error:", err);
            if (err.steps) finalSteps = err.steps;
            if (err.latency_seconds) finalLatency = err.latency_seconds;
            if (err.actions) finalActions = err.actions;
            if (!accumulatedText) {
              accumulatedText = `Oops! ${err.message || 'Something went wrong while processing your request.'}`;
            } else {
              accumulatedText += `\n\n*(Note: Generation was interrupted: ${err.message})*`;
            }
          }
        }
      );

      // Run any actions that were not executed during streaming
      if (finalActions.length > 0) {
        finalActions.forEach(action => {
          const key = JSON.stringify(action);
          if (!seenActionKeys.has(key)) {
            seenActionKeys.add(key);
            handleAgentAction(action);
          }
        });
      }

      const replyContent = accumulatedText || "I've synthesized the research and updated the map and property listings.";
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: replyContent,
        agentType: 'deep_agent',
        latencySeconds: finalLatency || undefined,
        steps: finalSteps.length > 0 ? finalSteps : undefined
      };

      setMessages(prev => [...prev, agentMsg]);
      setChatHistory(prev => [
        ...prev,
        { role: 'user', parts: text },
        { role: 'model', parts: replyContent }
      ]);
    } catch (err) {
      console.error("Failed to stream deep chat", err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: 'Oops! I had trouble connecting to the Deep Agent server.'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
      setActiveThinkingSteps([]);
      setActiveStatusLabel(null);
      setStreamingContent('');
    }
  }, [chatHistory, currentSessionId, handleAgentAction]);

  const handleAskAgent = useCallback((prompt: string) => {
    setIsChatOpen(true);
    handleSendMessage(prompt);
  }, [handleSendMessage]);

  const handleSelectSession = useCallback(async (sessionId: string | null) => {
    setCurrentSessionId(sessionId);
    if (!sessionId) {
      setMessages([]);
      setChatHistory([]);
      return;
    }
    try {
      const msgs = await api.getChatMessages(sessionId);
      const formattedMsgs = msgs.map(m => ({ id: m.id, role: m.role as 'user' | 'model', content: m.content }));
      setMessages(formattedMsgs);
      const history = formattedMsgs.map(m => ({ role: m.role, parts: m.content }));
      setChatHistory(history);
    } catch (err) {
      console.error("Failed to load session messages", err);
    }
  }, []);

  const toggleMaximize = (panel: MaximizedState) => {
    setMaximizedPanel(prev => prev === panel ? null : panel);
  };

  const handleMapSelect = useCallback((id: string) => {
    setSelectedId(id);
    setModalPropertyId(id);
    const match = properties.find(p => p.id === id) || savedProperties.find(p => p.id === id);
    if (match) setSelectedProperty(match);
    setMaximizedPanel(prev => prev === 'chat' ? null : prev);
  }, [properties, savedProperties]);

  const handleChatSelectProperty = useCallback(async (id: string) => {
    setSelectedId(id);
    const exists = properties.some(p => p.id === id) || savedProperties.some(p => p.id === id);
    if (!exists) {
      try {
        const fetched = await api.getProperty(id);
        if (fetched) {
          setProperties(prev => [fetched, ...prev.filter(p => p.id !== id)]);
        }
      } catch (err) {
        console.error("Failed to load property for selection", err);
      }
    }
    setMaximizedPanel(prev => prev === 'chat' ? null : prev);
    setTimeout(() => {
      const card = document.getElementById(`property-card-${id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }, [properties, savedProperties]);

  // Handle Escape key to restore maximized panels or close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (maximizedPanel) {
          setMaximizedPanel(null);
        } else if (isCompareOpen) {
          setIsCompareOpen(false);
        } else if (modalPropertyId) {
          setModalPropertyId(null);
          setSelectedProperty(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maximizedPanel, isCompareOpen, modalPropertyId]);


  const handleMobileMapSelect = useCallback((id: string) => {
    setSelectedId(id);
    const match = properties.find(p => p.id === id) || savedProperties.find(p => p.id === id);
    if (match) setSelectedProperty(match);
  }, [properties, savedProperties]);

  const getChatClasses = () => {
    if (isMobile) {
      return "fixed inset-0 z-[160] bg-white dark:bg-slate-900 rounded-none shadow-none border-0 overflow-hidden pointer-events-auto animate-in slide-in-from-bottom duration-300 flex flex-col";
    }
    if (maximizedPanel === 'chat') {
      return "fixed inset-4 z-[120] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-white/50 dark:border-slate-800 overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-300";
    }
    const widthClass = chatWidth === 'wide' ? 'w-[720px] max-w-[calc(100vw-2rem)]' : 'w-[520px] max-w-[calc(100vw-2rem)]';
    return `${widthClass} h-[680px] max-h-[88vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-white/50 dark:border-slate-800 overflow-hidden pointer-events-auto transition-all duration-300 relative z-10`;
  };

  const savedPropertiesList = useMemo(() => Array.isArray(savedProperties) ? savedProperties : [], [savedProperties]);

  const displayedProperties = useMemo(() => {
    if (!showSavedOnly) return properties;
    const savedIds = new Set(savedPropertiesList.map(sp => sp.id));
    const shortIds = new Set(shortlistedIds);
    return properties.filter(p => savedIds.has(p.id) || shortIds.has(p.id));
  }, [properties, showSavedOnly, savedPropertiesList, shortlistedIds]);

  const activeModalProperty = useMemo(() => {
    if (modalPropertyId) {
      return properties.find(p => p.id === modalPropertyId) || savedPropertiesList.find(p => p.id === modalPropertyId) || null;
    }
    return selectedProperty;
  }, [modalPropertyId, properties, savedPropertiesList, selectedProperty]);

  return (
    <div className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full bg-slate-100 dark:bg-slate-950 flex flex-col p-2 sm:p-4 gap-2 sm:gap-4 font-sans overflow-hidden transition-colors duration-300">
      
      {/* Top Header Bar */}
      <header className="h-13 sm:h-14 px-3 sm:px-5 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 rounded-2xl shadow-sm flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0 flex items-center">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight shrink-0">
              SydLiving AI
            </span>
            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-100 dark:border-indigo-900/40 truncate">
              Sydney Commute & Housing Intelligence
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* User Auth */}
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl px-2 sm:px-2.5 py-1 shadow-xs shrink-0">
              <UserAvatar user={user} className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[80px] sm:max-w-[110px] truncate">{user.username}</span>
              <button onClick={handleLogout} className="p-1 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors ml-0.5" title="Logout">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin} 
              className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in</span>
            </button>
          )}

          {/* Shortlist Comparison Button */}
          <button
            onClick={() => setIsCompareOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-xs transition-all hover:scale-105 active:scale-95 shrink-0 whitespace-nowrap"
            title="Shortlist & Compare"
          >
            <Heart className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", shortlistedIds.length > 0 ? "text-rose-500 fill-rose-500" : "text-slate-400")} />
            <span className="hidden sm:inline">Shortlist</span>
            {shortlistedIds.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black shrink-0">
                {shortlistedIds.length}
              </span>
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 sm:p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all hover:scale-105 active:scale-95 shadow-xs shrink-0"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode (Sydney Harbor by Night)"}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />}
          </button>
        </div>
      </header>

      {/* Main Container: Mobile Tabbed View vs Desktop Resizable Split Panels */}
      {isMobile ? (
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-xl">
          {mobileTab === 'list' ? (
            <div className="flex flex-col h-full bg-slate-50/80 dark:bg-slate-950 min-h-0">
              {/* Mobile Header / Counts */}
              <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                    Sydney Rental Listings
                  </h2>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {loading ? 'Finding listings...' : `${displayedProperties.length} properties available`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setShowSavedOnly(false)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors",
                      !showSavedOnly ? "bg-indigo-600 text-white shadow-xs" : "bg-white/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setShowSavedOnly(true)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1",
                      showSavedOnly ? "bg-indigo-600 text-white shadow-xs" : "bg-white/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                    <span>Saved ({savedPropertiesList.length || shortlistedIds.length})</span>
                  </button>
                </div>
              </div>

              {/* Keyword & Type Search */}
              <SearchFilterBar 
                keyword={keywordFilter} 
                propertyType={typeFilter} 
                onSearch={handleSearchFilter} 
                onAskKai={handleAskAgent} 
              />

              {activeFilters && (
                <div className="px-4 py-2 bg-indigo-50/90 dark:bg-indigo-950/40 border-b border-indigo-100/80 dark:border-indigo-900/50 flex items-center justify-between shrink-0">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Filter Active</span>
                  </span>
                  <button 
                    onClick={() => {
                      setKeywordFilter('');
                      setTypeFilter('');
                      setSpatialFilter(null);
                      loadProperties();
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-slate-700 transition-all shadow-xs"
                  >
                    Reset
                  </button>
                </div>
              )}

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto p-3.5 pb-24 flex flex-col gap-3.5 custom-scrollbar overscroll-contain touch-pan-y">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-500 animate-pulse text-xs">
                    Loading Sydney properties...
                  </div>
                ) : displayedProperties.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/40 dark:border-slate-800 text-xs">
                    {showSavedOnly ? "No saved properties yet. Click the heart icon on a property to save it!" : "No properties match your current search filters. Try clearing your search or filters!"}
                  </div>
                ) : (
                  displayedProperties.map((p, idx) => (
                    <PropertyCard 
                      key={p.id}
                      property={p} 
                      index={idx}
                      isActive={selectedId === p.id}
                      isFavorite={shortlistedIds.includes(p.id)}
                      isSaved={savedPropertiesList.some(sp => sp.id === p.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleSave={handleToggleSave}
                      onClick={() => {
                        setSelectedId(p.id);
                        setModalPropertyId(p.id);
                        setSelectedProperty(p);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Mobile Map View */
            <div className="relative w-full h-full min-h-0 flex-1 overflow-hidden bg-slate-200 dark:bg-slate-950">
              <Map 
                properties={displayedProperties} 
                selectedPropertyId={selectedId} 
                onSelectProperty={handleMobileMapSelect}
                isDarkMode={isDarkMode}
                onDrawCreated={(layer: any, type: string) => {
                  let spatial: any = null;
                  if (type === 'circle') {
                    const latlng = layer.getLatLng();
                    const radius = layer.getRadius();
                    spatial = { circle: `${latlng.lat},${latlng.lng},${radius}` };
                  } else if (type === 'polygon' || type === 'rectangle') {
                    const latlngs = layer.getLatLngs()[0];
                    const points = latlngs.map((ll: any) => `${ll.lat},${ll.lng}`).join(';');
                    spatial = { polygon: points };
                  }
                  setSpatialFilter(spatial);
                }}
                onDrawDeleted={() => {
                  setSpatialFilter(null);
                }}
              />

              {/* Floating Bottom Preview Card when a property is selected on map */}
              {selectedProperty && (
                <div className="absolute bottom-20 left-3 right-3 z-30 animate-in slide-in-from-bottom-4 duration-200">
                  <div 
                    onClick={() => setModalPropertyId(selectedProperty.id)}
                    className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-2xl flex items-center gap-3 cursor-pointer"
                  >
                    <img 
                      src={selectedProperty.photo_url || "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80"}
                      alt={selectedProperty.title}
                      className="w-20 h-20 rounded-xl object-cover shrink-0 shadow-xs"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80";
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-blue-600 dark:text-blue-400 font-extrabold text-sm">
                          ${selectedProperty.weekly_rent}
                          <span className="text-[10px] font-normal text-slate-500">/wk</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {selectedProperty.bedrooms}b • {selectedProperty.bathrooms}ba
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">{selectedProperty.title}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{selectedProperty.suburb} • {selectedProperty.distance_to_beach_km.toFixed(1)}km to beach</p>
                      <div className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                        <span>Tap for full details</span>
                        <span className="text-xs">→</span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProperty(null);
                        setSelectedId(null);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 self-start"
                      title="Dismiss preview"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Floating Bottom Switcher Dock [ 📋 Listings | 🗺️ Map ] */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
            <div className="bg-slate-900/90 dark:bg-slate-900/95 text-white backdrop-blur-xl border border-white/20 dark:border-slate-700/80 shadow-2xl rounded-full p-1 flex items-center gap-1">
              <button
                onClick={() => setMobileTab('list')}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer",
                  mobileTab === 'list' 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25 scale-100" 
                    : "text-white/80 hover:text-white"
                )}
              >
                <List className="w-3.5 h-3.5" />
                <span>Listings</span>
                <span className="text-[10px] opacity-80 font-mono">({displayedProperties.length})</span>
              </button>

              <button
                onClick={() => setMobileTab('map')}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer",
                  mobileTab === 'map' 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25 scale-100" 
                    : "text-white/80 hover:text-white"
                )}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Main Split Panels Container (Desktop) */
        <div className="flex-1 min-h-0 relative">
          <PanelGroup 
            orientation="horizontal" 
            className="w-full h-full rounded-[2rem] overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70"
          >
          
          {/* Left Panel: Property List */}
          <Panel defaultSize="25" minSize="20" maxSize="40" className="bg-slate-50/80 dark:bg-slate-950 flex flex-col h-full min-w-0">
            <div className="flex flex-col bg-slate-50/80 dark:bg-slate-950 h-full w-full">
              <header className="flex flex-col px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 shadow-xs z-10 shrink-0 gap-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                      Sydney Rental Listings
                    </h2>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {loading ? 'Finding listings...' : `${displayedProperties.length} properties available`}
                    </p>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowSavedOnly(false)}
                    className={cn("flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors", !showSavedOnly ? "bg-indigo-600 text-white shadow-sm" : "bg-white/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700")}
                  >
                    All Properties
                  </button>
                  <button 
                    onClick={() => setShowSavedOnly(true)}
                    className={cn("flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1", showSavedOnly ? "bg-indigo-600 text-white shadow-sm" : "bg-white/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700")}
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> Saved ({savedPropertiesList.length || shortlistedIds.length})
                  </button>
                </div>
              </header>

              {/* Keyword & Type Search */}
              <SearchFilterBar 
                keyword={keywordFilter} 
                propertyType={typeFilter} 
                onSearch={handleSearchFilter} 
                onAskKai={handleAskAgent} 
              />

              {activeFilters && (
                <div className="px-4 py-2 bg-indigo-50/90 dark:bg-indigo-950/40 border-b border-indigo-100/80 dark:border-indigo-900/50 flex items-center justify-between shrink-0">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Filter Active</span>
                  </span>
                  <button 
                    onClick={() => {
                      setKeywordFilter('');
                      setTypeFilter('');
                      setSpatialFilter(null);
                      loadProperties();
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-slate-700 transition-all shadow-xs"
                  >
                    Reset
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3.5 custom-scrollbar relative z-0">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-500 animate-pulse text-xs">
                    Loading Sydney properties...
                  </div>
                ) : displayedProperties.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/40 dark:border-slate-800 text-xs">
                    {showSavedOnly ? "No saved properties yet. Click the heart icon on a property to save it!" : "No properties match your current search filters. Try clearing your search or filters!"}
                  </div>
                ) : (
                  displayedProperties.map((p, idx) => (
                    <PropertyCard 
                      key={p.id}
                      property={p} 
                      index={idx}
                      isActive={selectedId === p.id}
                      isFavorite={shortlistedIds.includes(p.id)}
                      isSaved={savedPropertiesList.some(sp => sp.id === p.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleSave={handleToggleSave}
                      onClick={() => {
                        setSelectedId(p.id);
                        setModalPropertyId(p.id);
                        setSelectedProperty(p);
                        if (maximizedPanel === 'list') setMaximizedPanel(null);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-indigo-900/5 dark:bg-indigo-400/10 hover:bg-indigo-500/30 transition-colors cursor-col-resize active:bg-indigo-500/50 relative z-50" />
          
          {/* Center Panel: Map Canvas */}
          <Panel className="bg-slate-200 dark:bg-slate-950 min-w-0">
            <div className="w-full h-full relative bg-slate-200 dark:bg-slate-950 min-w-0">
              <Map 
                properties={displayedProperties} 
                selectedPropertyId={selectedId} 
                onSelectProperty={handleMapSelect}
                isMaximized={maximizedPanel === 'map'}
                onToggleMaximize={() => toggleMaximize('map')}
                isDarkMode={isDarkMode}
                onDrawCreated={(layer: any, type: string) => {
                  let spatial: any = null;
                  if (type === 'circle') {
                    const latlng = layer.getLatLng();
                    const radius = layer.getRadius();
                    spatial = { circle: `${latlng.lat},${latlng.lng},${radius}` };
                  } else if (type === 'polygon' || type === 'rectangle') {
                    const latlngs = layer.getLatLngs()[0];
                    const points = latlngs.map((ll: any) => `${ll.lat},${ll.lng}`).join(';');
                    spatial = { polygon: points };
                  }
                  setSpatialFilter(spatial);
                }}
                onDrawDeleted={() => {
                  setSpatialFilter(null);
                }}
              />
            </div>
          </Panel>

          {/* Right Panel: Property Details */}
          {modalPropertyId && activeModalProperty && (
            <PanelResizeHandle className="w-1.5 bg-indigo-900/5 dark:bg-indigo-400/10 hover:bg-indigo-500/30 transition-colors cursor-col-resize active:bg-indigo-500/50 relative z-50" />
          )}
          {modalPropertyId && activeModalProperty && (
            <Panel defaultSize="24" minSize="20" maxSize="38" className="bg-white dark:bg-slate-900">
              <div className="w-full h-full relative bg-white dark:bg-slate-900">
                <ErrorBoundary>
                  <PropertyPanel 
                    property={activeModalProperty} 
                    onClose={() => {
                      setModalPropertyId(null);
                      setSelectedProperty(null);
                    }} 
                    isMaximized={false}
                    onToggleMaximize={() => toggleMaximize('details')}
                    isFavorite={shortlistedIds.includes(activeModalProperty.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onAskAgent={handleAskAgent}
                  />
                </ErrorBoundary>
              </div>
            </Panel>
          )}

        </PanelGroup>
      </div>
      )}

      {/* Maximized Property Details Lightbox Modal (Desktop & Tablet) */}
      {!isMobile && maximizedPanel === 'details' && activeModalProperty && (
        <div 
          className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-6 md:p-8 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Property details enlarged view"
        >
          {/* Backdrop (click to restore split view) */}
          <div 
            onClick={() => setMaximizedPanel(null)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer" 
            title="Click to restore split view (Esc)"
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-5xl h-full max-h-[92vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/60 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 z-10 animate-in zoom-in-95 duration-200">
            <ErrorBoundary>
              <PropertyPanel 
                property={activeModalProperty} 
                onClose={() => {
                  setMaximizedPanel(null);
                  setModalPropertyId(null);
                  setSelectedProperty(null);
                }} 
                isMaximized={true}
                onToggleMaximize={() => setMaximizedPanel(null)}
                isFavorite={shortlistedIds.includes(activeModalProperty.id)}
                onToggleFavorite={handleToggleFavorite}
                onAskAgent={handleAskAgent}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* Mobile Full-Screen Property Details Drawer */}
      {isMobile && modalPropertyId && activeModalProperty && (
        <div className="fixed inset-0 z-[150] bg-white dark:bg-slate-900 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
          <ErrorBoundary>
            <PropertyPanel 
              property={activeModalProperty} 
              onClose={() => {
                setModalPropertyId(null);
                setSelectedProperty(null);
              }} 
              isFavorite={shortlistedIds.includes(activeModalProperty.id)}
              onToggleFavorite={handleToggleFavorite}
              onAskAgent={handleAskAgent}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Floating AI Chat Widget */}
      <div 
        className={cn(
          "fixed z-[110] flex flex-col items-end gap-4 transition-all duration-300",
          isMobile 
            ? (isChatOpen ? "inset-0 pointer-events-auto" : "bottom-20 right-3 pointer-events-none") 
            : "bottom-6 right-6 pointer-events-none"
        )}
      >
        {/* Chat Window */}
        {isChatOpen && (
          <div className={getChatClasses()}>
            <ChatPanel 
              messages={messages} 
              isThinking={isThinking} 
              onSendMessage={handleSendMessage} 
              onSelectSession={handleSelectSession}
              currentSessionId={currentSessionId}
              isLoggedIn={!!user}
              activeThinkingSteps={activeThinkingSteps}
              activeStatusLabel={activeStatusLabel}
              streamingContent={streamingContent}
              isMaximized={maximizedPanel === 'chat'}
              onToggleMaximize={() => toggleMaximize('chat')}
              isWide={chatWidth === 'wide'}
              onToggleWide={() => setChatWidth(w => w === 'normal' ? 'wide' : 'normal')}
              onClose={() => setIsChatOpen(false)}
              properties={properties}
              onSelectProperty={handleChatSelectProperty}
            />
          </div>
        )}

        {/* Floating Concierge Launcher (only when chat is closed) */}
        <KaiLauncher 
          isChatOpen={isChatOpen}
          onOpenChat={() => setIsChatOpen(true)}
          onAskKai={handleAskAgent}
        />
      </div>

      {/* Shortlist Comparison Modal */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        properties={properties}
        shortlistedIds={shortlistedIds}
        onRemoveFromShortlist={handleToggleFavorite}
        onAskAgent={(prompt) => {
          setIsCompareOpen(false);
          handleAskAgent(prompt);
        }}
        onSelectProperty={(id) => {
          setSelectedId(id);
          setModalPropertyId(id);
          const match = properties.find(p => p.id === id) || savedProperties.find(p => p.id === id);
          if (match) setSelectedProperty(match);
        }}
      />

      {/* Google Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

    </div>
  );
}

export default App;
