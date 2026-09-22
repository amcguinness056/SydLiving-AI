import { useEffect, useState } from 'react';
import { Map } from './components/Map';
import { PropertyCard } from './components/PropertyCard';
import { PropertyPanel } from './components/PropertyPanel';
import { CompareModal } from './components/CompareModal';
import { AuthModal } from './components/AuthModal';
import { api, type Property, type AgentAction, type DestinationHub, type IsochroneResponse, type User } from './api/client';
import { ChatPanel, type Message } from './components/ChatPanel';
import { Sparkles, Maximize, Minimize, MessageCircle, X, ShieldCheck, Heart, Bell, Sun, Moon, LogOut } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { cn } from './lib/utils';
import { LeaseAuditModal } from './components/LeaseAuditModal';
import { SavedFavoritesModal } from './components/SavedFavoritesModal';
import { AlertModal } from './components/AlertModal';

type MaximizedState = 'list' | 'map' | 'details' | 'chat' | null;

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

function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalPropertyId, setModalPropertyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  
  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('sydliving_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Hubs and Commute Reach State
  const [hubs, setHubs] = useState<DestinationHub[]>([]);
  const [activeHub, setActiveHub] = useState<string>('Barangaroo');
  const [maxCommuteMins, setMaxCommuteMins] = useState<number>(35);
  const [isochroneData, setIsochroneData] = useState<IsochroneResponse | null>(null);

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
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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

  async function loadFavorites() {
    try {
      const favs = await api.getFavorites();
      setFavorites(favs);
    } catch (err) {
      console.error("Failed to load favorites", err);
    }
  }

  const toggleFavorite = async (propertyId: string) => {
    handleToggleFavorite(propertyId);
    try {
      const isFav = favorites.some(f => f.id === propertyId);
      if (isFav) {
        await api.removeFavorite(propertyId);
        setFavorites(prev => prev.filter(f => f.id !== propertyId));
      } else {
        await api.addFavorite(propertyId);
        const prop = properties.find(p => p.id === propertyId);
        if (prop) {
          setFavorites(prev => [...prev, prop]);
        }
      }
    } catch (err) {
      console.error("Failed to toggle favorite", err);
    }
  };


  // Persist shortlist
  useEffect(() => {
    localStorage.setItem('sydliving_shortlist', JSON.stringify(shortlistedIds));
  }, [shortlistedIds]);

  // Auth restore & initial load
  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    const username = localStorage.getItem('username');
    const email = localStorage.getItem('user_email') || undefined;
    const avatarUrl = localStorage.getItem('user_avatar') || undefined;
    if (userId && username) {
      setUser({ id: userId, username, email, avatar_url: avatarUrl });
    }

    async function loadHubs() {
      try {
        const hubList = await api.getHubs();
        setHubs(hubList);
        if (hubList.length > 0 && !activeHub) {
          setActiveHub(hubList[0].name);
        }
      } catch (err) {
        console.error("Failed to load destination hubs", err);
      }
    }
    loadHubs();
    loadFavorites();
  }, []);

  // Reload properties & isochrones when active hub, commute, or spatial filters change
  useEffect(() => {
    loadProperties({ 
      destination_hub: activeHub, 
      max_commute_mins: maxCommuteMins,
      keyword: keywordFilter || undefined,
      property_type: typeFilter || undefined,
      circle: spatialFilter?.circle,
      polygon: spatialFilter?.polygon
    });
    loadIsochrones(activeHub, maxCommuteMins);
  }, [activeHub, maxCommuteMins, spatialFilter]);

  useEffect(() => {
    if (user) {
      loadSavedProperties();
    } else {
      setSavedProperties([]);
      setShowSavedOnly(false);
    }
  }, [user]);

  async function loadSavedProperties() {
    try {
      const data = await api.getSavedProperties();
      setSavedProperties(data);
    } catch (err) {
      console.error("Failed to load saved properties", err);
    }
  }

  async function loadIsochrones(hubName: string, maxMins: number) {
    try {
      const data = await api.getIsochrones(hubName, maxMins);
      setIsochroneData(data);
    } catch (err) {
      console.error("Failed to load isochrones", err);
    }
  }

  async function loadProperties(filters?: any) {
    setLoading(true);
    const combinedFilters = {
      destination_hub: activeHub,
      max_commute_mins: maxCommuteMins,
      keyword: keywordFilter || undefined,
      property_type: typeFilter || undefined,
      circle: spatialFilter?.circle,
      polygon: spatialFilter?.polygon,
      ...(filters || {})
    };
    setActiveFilters(filters?.suburb || filters?.max_rent || filters?.min_bedrooms || filters?.keyword || filters?.property_type || filters?.circle || filters?.polygon ? combinedFilters : null);
    try {
      const data = await api.getProperties(combinedFilters);
      setProperties(data);
    } catch (err) {
      console.error("Failed to load properties", err);
    } finally {
      setLoading(false);
    }
  }

  const applyFilters = () => {
    loadProperties({
      keyword: keywordFilter || undefined,
      property_type: typeFilter || undefined,
      circle: spatialFilter?.circle,
      polygon: spatialFilter?.polygon
    });
  };

  const handleToggleFavorite = (id: string) => {
    setShortlistedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSave = async (id: string, isSaved: boolean) => {
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
  };

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

  const handleAgentAction = (action: AgentAction) => {
    if (action.action_type === 'update_properties') {
      loadProperties(action.data);
    } else if (action.action_type === 'update_commute_filters') {
      if (action.data.destination_hub) {
        setActiveHub(action.data.destination_hub);
      }
      if (action.data.max_commute_minutes) {
        setMaxCommuteMins(action.data.max_commute_minutes);
      }
      loadProperties({
        destination_hub: action.data.destination_hub || activeHub,
        max_commute_mins: action.data.max_commute_minutes || maxCommuteMins,
        max_rent: action.data.max_rent < 99999 ? action.data.max_rent : undefined,
        min_bedrooms: action.data.min_bedrooms > 0 ? action.data.min_bedrooms : undefined
      });
    } else if (action.action_type === 'set_session') {
      setCurrentSessionId(action.data.session_id);
    }
  };

  const [sessionPreferences, setSessionPreferences] = useState<any>(null);

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const response = await api.sendChatMessage(text, chatHistory, currentSessionId || undefined);
      
      const agentMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        content: response.reply,
        tradeoffs: response.tradeoffs
      };
      setMessages(prev => [...prev, agentMsg]);
      if (response.session_preferences) {
        setSessionPreferences(response.session_preferences);
      }
      
      setChatHistory(prev => [
        ...prev, 
        { role: 'user', parts: text }, 
        { role: 'model', parts: response.reply }
      ]);

      if (response.actions && response.actions.length > 0) {
        response.actions.forEach(action => handleAgentAction(action));
      }
    } catch (err) {
      console.error("Failed to send message", err);
      const errorMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', content: 'Oops! I had trouble connecting to the server.' };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSelectSession = async (sessionId: string | null) => {
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
  };

  const toggleMaximize = (panel: MaximizedState) => {
    setMaximizedPanel(prev => prev === panel ? null : panel);
  };

  const handleMapSelect = (id: string) => {
    setSelectedId(id);
    setModalPropertyId(id);
  };


  const getMaximizedClasses = (panelName: MaximizedState) => {
    if (maximizedPanel === panelName) {
      return "fixed inset-4 z-[100] rounded-[2rem] shadow-2xl border border-white/40 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300";
    }
    return "w-full h-full relative";
  };

  const getChatClasses = () => {
    if (maximizedPanel === 'chat') {
      return "fixed inset-4 z-[120] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-white/50 dark:border-slate-800 overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-300";
    }
    return "w-[420px] h-[620px] max-h-[82vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-white/50 dark:border-slate-800 overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-8 fade-in duration-300 relative z-10";
  };

  const displayedProperties = showSavedOnly 
    ? properties.filter(p => savedProperties.some(sp => sp.id === p.id) || shortlistedIds.includes(p.id)) 
    : properties;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col p-3 sm:p-4 gap-3 sm:gap-4 h-screen font-sans overflow-hidden relative transition-colors duration-300">
      
      {/* Top Header Bar */}
      <header className="h-14 px-5 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 rounded-2xl shadow-sm flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-base font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 dark:from-indigo-400 dark:to-blue-400">
              SydLiving AI
            </span>
            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-100 dark:border-indigo-900/40">
              Sydney Commute & Housing Intelligence
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Audit Lease Button */}
          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all shadow-xs"
            title="Audit tenancy agreement for illegal clauses"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden md:inline">Audit Lease</span>
          </button>

          {/* New Listing Alerts Button */}
          <button
            onClick={() => setIsAlertModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/80 rounded-xl border border-amber-200 dark:border-amber-800 transition-all shadow-xs"
            title="Set up new listing alerts"
          >
            <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden md:inline">Alerts</span>
          </button>

          {/* User Auth */}
          {user ? (
            <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl px-2.5 py-1 shadow-xs">
              <UserAvatar user={user} className="w-5.5 h-5.5" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[110px] truncate">{user.username}</span>
              <button onClick={handleLogout} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors ml-0.5" title="Logout">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin} 
              className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-2"
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
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-xs transition-all hover:scale-105 active:scale-95"
          >
            <Heart className={cn("w-4 h-4", shortlistedIds.length > 0 ? "text-rose-500 fill-rose-500" : "text-slate-400")} />
            <span>Shortlist</span>
            {shortlistedIds.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                {shortlistedIds.length}
              </span>
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all hover:scale-105 active:scale-95 shadow-xs"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode (Sydney Harbor by Night)"}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>
      </header>

      {/* Main Split Panels Container */}
      <div className="flex-1 min-h-0 relative">
        <PanelGroup 
          orientation="horizontal" 
          className="w-full h-full rounded-[2rem] overflow-hidden shadow-2xl border border-white/50 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl"
        >
          
          {/* Left Panel: Property List */}
          <Panel defaultSize="25" minSize="20" maxSize="40" className="bg-white/20 dark:bg-slate-900/20 flex flex-col h-full min-w-0">
            <div className={cn(getMaximizedClasses('list'), "flex flex-col bg-white/20 dark:bg-slate-900/20 backdrop-blur-xl h-full")}>
              <header className="flex flex-col px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/60 dark:border-slate-800 shadow-xs z-10 shrink-0 gap-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                      Listings to {activeHub}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {loading ? 'Evaluating routes...' : `${displayedProperties.length} properties within ${maxCommuteMins}m`}
                    </p>
                  </div>
                  <button 
                    onClick={() => toggleMaximize('list')}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/80 dark:hover:bg-slate-800 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                    title={maximizedPanel === 'list' ? "Restore view" : "Enlarge list"}
                  >
                    {maximizedPanel === 'list' ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
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
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> Saved ({savedProperties.length || shortlistedIds.length})
                  </button>
                </div>
              </header>

              {/* Keyword & Type Search */}
              <div className="px-4 py-2.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-b border-white/40 dark:border-slate-800 shadow-sm z-10 shrink-0 flex flex-col gap-2">
                <input 
                  type="text"
                  placeholder="Search listings & descriptions..."
                  className="w-full px-3 py-1.5 bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  value={keywordFilter}
                  onChange={e => setKeywordFilter(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyFilters()}
                />
                <div className="flex gap-2">
                  <select 
                    className="flex-1 px-2.5 py-1.5 bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-700 dark:text-slate-200"
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                  >
                    <option value="">All Types</option>
                    <option value="Apartment">Apartment</option>
                    <option value="House">House</option>
                    <option value="Studio">Studio</option>
                    <option value="Terrace">Terrace</option>
                    <option value="Sharehouse">Sharehouse</option>
                  </select>
                  <button 
                    onClick={applyFilters}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Search
                  </button>
                </div>
              </div>

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
                    Calculating door-to-door transit commutes...
                  </div>
                ) : displayedProperties.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/40 dark:border-slate-800 text-xs">
                    {showSavedOnly ? "No saved properties yet. Click the heart icon on a property to save it!" : `No properties found within ${maxCommuteMins} mins of ${activeHub}. Try expanding the reach slider!`}
                  </div>
                ) : (
                  displayedProperties.map((p, idx) => (
                    <PropertyCard 
                      key={p.id}
                      property={p} 
                      index={idx}
                      isActive={selectedId === p.id}
                      isFavorite={shortlistedIds.includes(p.id)}
                      isSaved={savedProperties.some(sp => sp.id === p.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleSave={handleToggleSave}
                      selectedHubName={activeHub}
                      onClick={() => {
                        setSelectedId(p.id);
                        setModalPropertyId(p.id);
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
            <div className={cn(getMaximizedClasses('map'), "bg-slate-200 dark:bg-slate-950 min-w-0")}>
              <Map 
                properties={displayedProperties} 
                selectedPropertyId={selectedId} 
                onSelectProperty={handleMapSelect}
                isMaximized={maximizedPanel === 'map'}
                onToggleMaximize={() => toggleMaximize('map')}
                isDarkMode={isDarkMode}
                hubs={hubs}
                activeHubName={activeHub}
                onSelectHub={setActiveHub}
                maxCommuteMins={maxCommuteMins}
                onChangeMaxCommute={setMaxCommuteMins}
                isochroneData={isochroneData}
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
          {modalPropertyId && (
            <PanelResizeHandle className="w-1.5 bg-indigo-900/5 dark:bg-indigo-400/10 hover:bg-indigo-500/30 transition-colors cursor-col-resize active:bg-indigo-500/50 relative z-50" />
          )}
          {modalPropertyId && (
            <Panel defaultSize="24" minSize="20" maxSize="38" className="bg-white dark:bg-slate-900">
              <div className={cn(getMaximizedClasses('details'), "bg-white dark:bg-slate-900")}>
                <PropertyPanel 
                  property={properties.find(p => p.id === modalPropertyId)!} 
                  onClose={() => setModalPropertyId(null)} 
                  isMaximized={maximizedPanel === 'details'}
                  onToggleMaximize={() => toggleMaximize('details')}
                  isFavorite={shortlistedIds.includes(modalPropertyId)}
                  onToggleFavorite={handleToggleFavorite}
                  selectedHubName={activeHub}
                />
              </div>
            </Panel>
          )}

        </PanelGroup>
      </div>

      {/* Floating AI Chat Widget */}
      <div 
        className="fixed bottom-6 right-6 z-[110] flex flex-col items-end gap-4 pointer-events-none transition-all duration-300"
      >
        {/* Chat Window */}
        {isChatOpen && (
          <div className={getChatClasses()}>
            <div className="h-full relative z-10 bg-white/60 dark:bg-slate-900/70 backdrop-blur-3xl flex flex-col">
              <div className="px-5 py-3.5 border-b border-indigo-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/60 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
                  <span className="font-bold text-slate-800 dark:text-white text-sm">SydLiving AI</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => toggleMaximize('chat')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    title={maximizedPanel === 'chat' ? "Restore view" : "Enlarge chat"}
                  >
                    {maximizedPanel === 'chat' ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setIsChatOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    title="Close chat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 relative overflow-hidden">
                <ChatPanel 
                  messages={messages} 
                  isThinking={isThinking} 
                  onSendMessage={handleSendMessage} 
                  onSelectProperty={(id) => handleMapSelect(id)}
                  sessionPreferences={sessionPreferences}
                  onSelectSession={handleSelectSession}
                  currentSessionId={currentSessionId}
                  isLoggedIn={!!user}
                />
              </div>
            </div>
          </div>
        )}

        {/* Floating Action Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-15 h-15 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl shadow-indigo-300 dark:shadow-indigo-950/60 flex items-center justify-center transition-all hover:scale-105 active:scale-95 pointer-events-auto group relative z-50"
        >
          {isChatOpen ? (
            <X className="w-6 h-6 transition-transform group-hover:rotate-90" />
          ) : (
            <MessageCircle className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Lease & Inspection Report Audit Modal */}
      <LeaseAuditModal 
        isOpen={isAuditModalOpen} 
        onClose={() => setIsAuditModalOpen(false)} 
      />

      {/* Saved Listings / Shortlist Modal */}
      <SavedFavoritesModal 
        isOpen={isFavoritesModalOpen}
        onClose={() => setIsFavoritesModalOpen(false)}
        favorites={favorites.length > 0 ? favorites : properties.filter(p => shortlistedIds.includes(p.id))}
        onRemoveFavorite={(id) => toggleFavorite(id)}
        onSelectProperty={(id) => {
          handleMapSelect(id);
          setIsFavoritesModalOpen(false);
        }}
      />

      {/* New Listing Alert Subscription Modal */}
      <AlertModal 
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        activeSuburbs={activeFilters?.suburb ? [activeFilters.suburb] : []}
        maxRent={activeFilters?.max_rent}
      />

      {/* Shortlist Comparison Modal */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        properties={properties}
        shortlistedIds={shortlistedIds}
        onRemoveFromShortlist={handleToggleFavorite}
        onSelectProperty={(id) => {
          setSelectedId(id);
          setModalPropertyId(id);
        }}
        selectedHubName={activeHub}
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
