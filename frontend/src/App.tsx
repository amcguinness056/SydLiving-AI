import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Map } from './components/Map';
import { PropertyCard } from './components/PropertyCard';
import { PropertyPanel } from './components/PropertyPanel';
import { CompareModal } from './components/CompareModal';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { api, type Property, type AgentAction, type User, type UserProfileUpdate, type DeepAgentStep } from './api/client';
import { ChatPanel, type Message } from './components/ChatPanel';
import { KaiLauncher } from './components/KaiLauncher';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Sun, Moon, Heart, LogOut, List, Map as MapIcon, X, SlidersHorizontal, Compass, ArrowLeft } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { cn } from './lib/utils';
import { computeKaiMatch } from './lib/kaiMatch';
import { KaiConciergeHub } from './components/KaiConciergeHub';
import { KaiOnboardingModal } from './components/KaiOnboardingModal';

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
      <div className={cn("rounded-full bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-500 text-white font-black flex items-center justify-center text-[11px] shrink-0 shadow-xs border border-white/40 dark:border-slate-600 select-none", className)}>
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
  petFriendly: boolean;
  needsParking: boolean;
  hasAirCon: boolean;
  kaiPicksOnly: boolean;
  onSearch: (keyword: string, propertyType: string) => void;
  onTogglePetFriendly: () => void;
  onToggleNeedsParking: () => void;
  onToggleHasAirCon: () => void;
  onToggleKaiPicks: () => void;
  onAskKai: (prompt: string) => void;
  onOpenProfile?: () => void;
}

const SearchFilterBar = React.memo(function SearchFilterBar({
  keyword,
  propertyType,
  petFriendly,
  needsParking,
  hasAirCon,
  kaiPicksOnly,
  onSearch,
  onTogglePetFriendly,
  onToggleNeedsParking,
  onToggleHasAirCon,
  onToggleKaiPicks,
  onAskKai,
  onOpenProfile
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
        className="w-full px-3 py-1.5 bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
        value={localKeyword}
        onChange={e => setLocalKeyword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleApply()}
      />
      <div className="flex gap-2">
        <select 
          className="flex-1 px-2.5 py-1.5 bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-700 dark:text-slate-200"
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

      {/* Feature Toggles & Profile Shortcut */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        <button
          type="button"
          onClick={onToggleKaiPicks}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1 cursor-pointer",
            kaiPicksOnly
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-white/70 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400"
          )}
          title="Show Kai's top-matched Sydney homes (commute & lifestyle score)"
        >
          <Sparkles className={cn("w-3 h-3", kaiPicksOnly ? "text-white" : "text-blue-500")} />
          <span>Kai's Picks</span>
        </button>
        <button
          type="button"
          onClick={onTogglePetFriendly}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1 cursor-pointer",
            petFriendly
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-white/70 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400"
          )}
          title="Filter for pet-friendly Sydney rentals"
        >
          <span>🐾</span>
          <span>Pets</span>
        </button>

        <button
          type="button"
          onClick={onToggleNeedsParking}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1 cursor-pointer",
            needsParking
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-white/70 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400"
          )}
          title="Filter for properties with garage or dedicated parking"
        >
          <span>🚗</span>
          <span>Parking</span>
        </button>

        <button
          type="button"
          onClick={onToggleHasAirCon}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1 cursor-pointer",
            hasAirCon
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-white/70 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400"
          )}
          title="Filter for properties with air conditioning / climate control"
        >
          <span>❄️</span>
          <span>Air Con</span>
        </button>

        {onOpenProfile && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="ml-auto px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 flex items-center gap-1 cursor-pointer transition-colors"
            title="Configure Commute & Vibe Profile"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Profile</span>
          </button>
        )}
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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');
  const [properties, setProperties] = useState<Property[]>([]);
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(() => location.pathname === '/shortlist');
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (location.pathname.startsWith('/property/')) {
      return location.pathname.replace('/property/', '').split('/')[0].split('?')[0] || null;
    }
    return null;
  });
  const [modalPropertyId, setModalPropertyId] = useState<string | null>(() => {
    if (location.pathname.startsWith('/property/')) {
      return location.pathname.replace('/property/', '').split('/')[0].split('?')[0] || null;
    }
    return null;
  });
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
  const [authModalReason, setAuthModalReason] = useState<string | undefined>(undefined);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Shortlist State
  const [shortlistedIds, setShortlistedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sydliving_shortlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const shortlistedIdsRef = React.useRef(shortlistedIds);
  useEffect(() => {
    shortlistedIdsRef.current = shortlistedIds;
  }, [shortlistedIds]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Search & Filter State (synced with URL searchParams)
  const [keywordFilter, setKeywordFilter] = useState(() => searchParams.get('q') || '');
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') || '');
  const [petFriendlyFilter, setPetFriendlyFilter] = useState(() => searchParams.get('pets') === '1' || searchParams.get('pets') === 'true');
  const [parkingFilter, setParkingFilter] = useState(() => searchParams.get('parking') === '1' || searchParams.get('parking') === 'true');
  const [airConFilter, setAirConFilter] = useState(() => searchParams.get('aircon') === '1' || searchParams.get('aircon') === 'true');
  const [kaiPicksOnly, setKaiPicksOnly] = useState(() => searchParams.get('kai') === '1' || searchParams.get('kai') === 'true');
  const [spatialFilter, setSpatialFilter] = useState<{ circle?: string, polygon?: string } | null>(null);
  const [activeFilters, setActiveFilters] = useState<any>(null);

  // Helper to sync filter changes with URL search params
  const updateFilterQuery = useCallback((updates: Record<string, string | boolean | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, val]) => {
        if (val === null || val === false || val === '') {
          next.delete(key);
        } else if (val === true) {
          next.set(key, '1');
        } else {
          next.set(key, String(val));
        }
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Synchronize route pathname changes to component state
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/property/')) {
      const id = path.replace('/property/', '').split('/')[0].split('?')[0];
      if (id) {
        setModalPropertyId(id);
        setSelectedId(id);
      }
    } else if (path === '/shortlist') {
      setShowSavedOnly(true);
      setModalPropertyId(null);
    } else if (path === '/chat') {
      setIsChatOpen(true);
      setModalPropertyId(null);
    } else if (path === '/profile') {
      setIsProfileModalOpen(true);
      setModalPropertyId(null);
    } else if (path === '/concierge') {
      setModalPropertyId(null);
    } else if (path === '/') {
      setModalPropertyId(null);
    }

    if (path !== '/profile') {
      setIsProfileModalOpen(false);
    }
  }, [location.pathname]);

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

  // Auth restore & fetch profile
  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    const username = localStorage.getItem('username');
    const email = localStorage.getItem('user_email') || undefined;
    const avatarUrl = localStorage.getItem('user_avatar') || undefined;
    const onboardingCompleted = localStorage.getItem('sydliving_onboarding_completed') === 'true';

    if (userId && username) {
      setUser({ id: userId, username, email, avatar_url: avatarUrl });
      api.getProfile(userId).then(profile => {
        if (profile) {
          setUser(prev => prev ? { ...prev, ...profile } : profile);
          if (!onboardingCompleted || !profile.workplace_hub) {
            setIsOnboardingOpen(true);
          }
        } else if (!onboardingCompleted) {
          setIsOnboardingOpen(true);
        }
      }).catch(err => {
        console.error("Failed to load user profile", err);
        if (!onboardingCompleted) {
          setIsOnboardingOpen(true);
        }
      });
    }
  }, []);

  const syncUserSavedProperties = useCallback(async (currentShortlist: string[]) => {
    try {
      const remoteProps = await api.syncSavedProperties(currentShortlist);
      if (Array.isArray(remoteProps)) {
        setSavedProperties(remoteProps);
        const remoteIds = remoteProps.map(p => p.id);
        setShortlistedIds(remoteIds);
        localStorage.setItem('sydliving_shortlist', JSON.stringify(remoteIds));
      }
    } catch (err) {
      console.error("Failed to sync saved properties", err);
    }
  }, []);

  const loadProperties = useCallback(async (filters?: any) => {
    setLoading(true);
    const combinedFilters = {
      keyword: keywordFilter || undefined,
      property_type: typeFilter || undefined,
      pet_friendly: petFriendlyFilter ? true : undefined,
      needs_parking: parkingFilter ? true : undefined,
      has_air_con: airConFilter ? true : undefined,
      circle: spatialFilter?.circle,
      polygon: spatialFilter?.polygon,
      ...(filters || {})
    };
    setActiveFilters(
      combinedFilters.suburb || combinedFilters.max_rent || combinedFilters.min_bedrooms || 
      combinedFilters.keyword || combinedFilters.property_type || combinedFilters.circle || combinedFilters.polygon ||
      combinedFilters.pet_friendly || combinedFilters.needs_parking || combinedFilters.has_air_con
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
  }, [keywordFilter, typeFilter, petFriendlyFilter, parkingFilter, airConFilter, spatialFilter]);

  // Reload properties on initial mount or when spatial filters change
  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  // Synchronize saved properties:
  // For authenticated users, sync with backend database.
  // For guest users, hydrate saved properties by property IDs and prune any invalid or deleted listings.
  useEffect(() => {
    if (user) {
      syncUserSavedProperties(shortlistedIdsRef.current);
    } else {
      const currentIds = shortlistedIdsRef.current;
      if (currentIds.length > 0) {
        let isMounted = true;
        api.getProperties({ property_ids: currentIds })
          .then(validProps => {
            if (!isMounted) return;
            if (Array.isArray(validProps)) {
              setSavedProperties(validProps);
              const validIdSet = new Set(validProps.map(p => p.id));
              const prunedIds = currentIds.filter(id => validIdSet.has(id));
              if (prunedIds.length !== currentIds.length) {
                setShortlistedIds(prunedIds);
                localStorage.setItem('sydliving_shortlist', JSON.stringify(prunedIds));
              }
            }
          })
          .catch(err => {
            console.error("Failed to hydrate guest shortlisted properties", err);
          });
        return () => {
          isMounted = false;
        };
      } else {
        setSavedProperties([]);
      }
      setShowSavedOnly(false);
    }
  }, [user, syncUserSavedProperties]);

  const handleSearchFilter = useCallback((newKeyword: string, newType: string) => {
    setKeywordFilter(newKeyword);
    setTypeFilter(newType);
    updateFilterQuery({ q: newKeyword, type: newType });
    loadProperties({
      keyword: newKeyword || undefined,
      property_type: newType || undefined,
      circle: spatialFilter?.circle,
      polygon: spatialFilter?.polygon
    });
  }, [spatialFilter, loadProperties, updateFilterQuery]);

  const handleTogglePetFriendly = useCallback(() => {
    setPetFriendlyFilter(prev => {
      const next = !prev;
      updateFilterQuery({ pets: next });
      loadProperties({ pet_friendly: next ? true : undefined });
      return next;
    });
  }, [loadProperties, updateFilterQuery]);

  const handleToggleParking = useCallback(() => {
    setParkingFilter(prev => {
      const next = !prev;
      updateFilterQuery({ parking: next });
      loadProperties({ needs_parking: next ? true : undefined });
      return next;
    });
  }, [loadProperties, updateFilterQuery]);

  const handleToggleAirCon = useCallback(() => {
    setAirConFilter(prev => {
      const next = !prev;
      updateFilterQuery({ aircon: next });
      loadProperties({ has_air_con: next ? true : undefined });
      return next;
    });
  }, [loadProperties, updateFilterQuery]);

  const handleResetFilters = useCallback(() => {
    setKeywordFilter('');
    setTypeFilter('');
    setPetFriendlyFilter(false);
    setParkingFilter(false);
    setAirConFilter(false);
    setKaiPicksOnly(false);
    setSpatialFilter(null);
    setSearchParams(new URLSearchParams(), { replace: true });
    loadProperties({
      keyword: undefined,
      property_type: undefined,
      pet_friendly: undefined,
      needs_parking: undefined,
      has_air_con: undefined,
      circle: undefined,
      polygon: undefined,
      suburb: undefined,
      max_rent: undefined,
      min_bedrooms: undefined
    });
  }, [loadProperties, setSearchParams]);

  const handleApplyProfileToFilters = useCallback((profile: UserProfileUpdate) => {
    if (profile.has_pets !== undefined) setPetFriendlyFilter(!!profile.has_pets);
    if (profile.needs_parking !== undefined) setParkingFilter(!!profile.needs_parking);
    loadProperties({
      max_rent: profile.max_weekly_rent,
      min_bedrooms: profile.min_bedrooms,
      destination_hub: profile.workplace_hub,
      max_commute_mins: profile.max_commute_mins,
      pet_friendly: profile.has_pets ? true : undefined,
      needs_parking: profile.needs_parking ? true : undefined
    });
  }, [loadProperties]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    const isCurrentlySaved = shortlistedIds.includes(id);
    const nextIds = isCurrentlySaved 
      ? shortlistedIds.filter(item => item !== id) 
      : [...shortlistedIds, id];

    // Optimistic UI update
    setShortlistedIds(nextIds);
    localStorage.setItem('sydliving_shortlist', JSON.stringify(nextIds));

    if (isCurrentlySaved) {
      setSavedProperties(prev => prev.filter(p => p.id !== id));
    } else {
      const match = properties.find(p => p.id === id) || savedProperties.find(p => p.id === id);
      if (match) {
        setSavedProperties(prev => [match, ...prev.filter(p => p.id !== id)]);
      } else {
        api.getProperty(id).then(prop => {
          if (prop) {
            setSavedProperties(prev => [prop, ...prev.filter(p => p.id !== id)]);
          }
        }).catch(() => {});
      }
    }

    // Sync with backend database when logged in
    if (user) {
      try {
        if (isCurrentlySaved) {
          await api.unsaveProperty(id);
        } else {
          await api.saveProperty(id);
        }
      } catch (err) {
        console.error("Failed to sync toggle save with backend", err);
      }
    }
  }, [shortlistedIds, user, properties, savedProperties]);

  const handleToggleSave = handleToggleFavorite;

  const handleOpenProfile = useCallback(() => {
    navigate({ pathname: '/profile', search: location.search });
  }, [navigate, location.search]);

  const handleCloseProfile = useCallback(() => {
    setIsProfileModalOpen(false);
    if (location.pathname === '/profile') {
      navigate({ pathname: '/', search: location.search });
    }
  }, [location.pathname, location.search, navigate]);

  const handleLogin = useCallback((reason?: string) => {
    setAuthModalReason(reason);
    setIsAuthModalOpen(true);
  }, []);

  const handleAuthSuccess = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('user_id', newUser.id);
    localStorage.setItem('username', newUser.username);
    if (newUser.email) localStorage.setItem('user_email', newUser.email);
    if (newUser.avatar_url) localStorage.setItem('user_avatar', newUser.avatar_url);
    syncUserSavedProperties(shortlistedIds);

    // Conversational Onboarding: If user has never completed onboarding or has no workplace_hub
    const onboardingCompleted = localStorage.getItem('sydliving_onboarding_completed') === 'true';
    if (!onboardingCompleted || !newUser.workplace_hub) {
      setIsOnboardingOpen(true);
    }
  };

  const handleOnboardingComplete = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    setIsOnboardingOpen(false);
    navigate({ pathname: '/concierge', search: location.search });
  }, [navigate, location.search]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_avatar');
    setSavedProperties([]);
    setShortlistedIds([]);
    localStorage.removeItem('sydliving_shortlist');
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
    if (!user) {
      handleLogin('Sign in with Google to chat with Kai');
      return;
    }
    // If viewing the enlarged property modal, compare modal, or mobile drawer,
    // close them immediately so Kai opens straight away in the foreground
    setMaximizedPanel(null);
    setIsCompareOpen(false);
    if (isMobile) {
      setModalPropertyId(null);
      setSelectedProperty(null);
    }
    setIsChatOpen(true);
    handleSendMessage(prompt);
  }, [user, handleLogin, handleSendMessage, isMobile]);

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
    navigate({ pathname: `/property/${id}`, search: location.search });
  }, [properties, savedProperties, navigate, location.search]);

  const handleClosePropertyDetail = useCallback(() => {
    setModalPropertyId(null);
    setSelectedProperty(null);
    setSelectedId(null);
    navigate({ pathname: showSavedOnly ? '/shortlist' : '/', search: location.search });
  }, [navigate, showSavedOnly, location.search]);

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
          handleClosePropertyDetail();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maximizedPanel, isCompareOpen, modalPropertyId, handleClosePropertyDetail]);



  const getChatClasses = () => {
    if (isMobile) {
      return "fixed inset-0 z-[160] bg-white dark:bg-slate-900 rounded-none shadow-none border-0 overflow-hidden pointer-events-auto animate-in slide-in-from-bottom duration-300 flex flex-col";
    }
    if (maximizedPanel === 'chat') {
      return "fixed inset-4 z-[160] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-white/50 dark:border-slate-800 overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-300";
    }
    const widthClass = chatWidth === 'wide' ? 'w-[720px] max-w-[calc(100vw-2rem)]' : 'w-[520px] max-w-[calc(100vw-2rem)]';
    return `${widthClass} h-[680px] max-h-[88vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-white/50 dark:border-slate-800 overflow-hidden pointer-events-auto transition-all duration-300 relative z-10`;
  };

  const savedPropertiesList = useMemo(() => Array.isArray(savedProperties) ? savedProperties : [], [savedProperties]);

  // Combined pool of all known properties (search results + saved properties across devices)
  const allPropertiesPool = useMemo<Property[]>(() => {
    const propertyMap: Record<string, Property> = {};
    for (const p of savedPropertiesList) propertyMap[p.id] = p;
    for (const p of properties) propertyMap[p.id] = p;
    return Object.values(propertyMap);
  }, [properties, savedPropertiesList]);

  const displayedProperties = useMemo<Property[]>(() => {
    let list: Property[] = [];
    if (!showSavedOnly) {
      list = properties;
    } else {
      const shortIds = new Set(shortlistedIds);
      const propertyMap: Record<string, Property> = {};
      for (const p of savedPropertiesList) {
        if (shortIds.has(p.id)) propertyMap[p.id] = p;
      }
      for (const p of properties) {
        if (shortIds.has(p.id)) propertyMap[p.id] = p;
      }
      list = Object.values(propertyMap);
    }

    if (kaiPicksOnly) {
      list = list.filter(p => computeKaiMatch(p, user).isKaiPick);
    }

    return list;
  }, [properties, showSavedOnly, savedPropertiesList, shortlistedIds, kaiPicksOnly, user]);

  const activeModalProperty = useMemo<Property | null>(() => {
    if (modalPropertyId) {
      return allPropertiesPool.find(p => p.id === modalPropertyId) || null;
    }
    return selectedProperty;
  }, [modalPropertyId, allPropertiesPool, selectedProperty]);

  return (
    <div className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full bg-slate-100 dark:bg-slate-950 flex flex-col p-2 sm:p-4 gap-2 sm:gap-4 font-sans overflow-hidden transition-colors duration-300">
      
      {/* Top Header Bar */}
      <header className="h-13 sm:h-14 px-3 sm:px-5 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 rounded-2xl shadow-sm flex items-center justify-between shrink-0 z-30">
        <div 
          onClick={() => {
            setShowSavedOnly(false);
            setModalPropertyId(null);
            navigate({ pathname: '/', search: location.search });
          }}
          className="flex items-center gap-2 sm:gap-3 min-w-0 cursor-pointer group"
          title="Return to Sydney explore map"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-600 group-hover:bg-blue-500 flex items-center justify-center text-white shadow-xs shrink-0 transition-colors">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0 flex items-center">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight shrink-0">
              SydLiving AI
            </span>
            <span className="hidden xl:inline-block ml-2 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-100 dark:border-blue-900/40 truncate">
              Sydney Commute & Housing Intelligence
            </span>
          </div>
        </div>

        {/* Primary Desktop Site Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <button
            type="button"
            onClick={() => {
              setShowSavedOnly(false);
              setModalPropertyId(null);
              navigate({ pathname: '/', search: location.search });
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              location.pathname === '/' && !showSavedOnly
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Explore</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (shortlistedIds.length > 0) {
                setIsCompareOpen(true);
              }
              setShowSavedOnly(true);
              navigate({ pathname: '/shortlist', search: location.search });
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              location.pathname === '/shortlist' || showSavedOnly
                ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", shortlistedIds.length > 0 ? "text-rose-500 fill-rose-500" : "text-slate-400")} />
            <span>Shortlist</span>
            {shortlistedIds.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                {shortlistedIds.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              navigate({ pathname: '/concierge', search: location.search });
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              location.pathname === '/concierge'
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Kai Concierge</span>
          </button>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* User Auth & Profile */}
          {user ? (
            <div className="flex items-center gap-1 sm:gap-1.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl p-1 pr-1.5 sm:pr-2 shadow-xs shrink-0">
              <button
                onClick={handleOpenProfile}
                className="flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg px-1.5 py-0.5 transition-colors cursor-pointer"
                title="Edit Commute & Living Profile"
              >
                <UserAvatar user={user} className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[80px] sm:max-w-[110px] truncate">{user.username}</span>
                <span className="hidden md:inline-block px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200/50 dark:border-blue-900/40">
                  Profile
                </span>
              </button>
              <button onClick={handleLogout} className="p-1 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors ml-0.5 cursor-pointer" title="Logout">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => handleLogin()} 
              className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap cursor-pointer"
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


          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 sm:p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all hover:scale-105 active:scale-95 shadow-xs shrink-0 cursor-pointer"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode (Sydney Harbor by Night)"}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />}
          </button>
        </div>
      </header>

      {/* Breadcrumb Navigation Bar (when property details is active) */}
      {modalPropertyId && activeModalProperty && (
        <div className="h-10 px-4 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 rounded-2xl flex items-center justify-between text-xs shrink-0 shadow-xs animate-in fade-in duration-150 z-20">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 min-w-0">
            <button
              onClick={handleClosePropertyDetail}
              className="inline-flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{showSavedOnly ? 'Back to Shortlist' : 'Back to Explore'}</span>
            </button>
            <span className="text-slate-400">/</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
              {activeModalProperty.title}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-black text-blue-600 dark:text-blue-400 text-xs">
              ${activeModalProperty.weekly_rent}/wk
            </span>
            <button
              onClick={() => handleToggleFavorite(activeModalProperty.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold",
                shortlistedIds.includes(activeModalProperty.id)
                  ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:border-rose-900"
                  : "bg-white/80 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              )}
            >
              <Heart className={cn("w-3.5 h-3.5", shortlistedIds.includes(activeModalProperty.id) && "fill-rose-500 text-rose-500")} />
              <span className="hidden sm:inline">{shortlistedIds.includes(activeModalProperty.id) ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Container: Concierge Hub vs Mobile Tabbed View vs Desktop Resizable Split Panels */}
      {location.pathname === '/concierge' ? (
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden rounded-2xl md:rounded-[2rem] bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-2xl">
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <ErrorBoundary>
              <KaiConciergeHub
                properties={allPropertiesPool}
                user={user}
                shortlistedIds={shortlistedIds}
                onToggleFavorite={handleToggleFavorite}
                onSelectProperty={(id) => {
                  handleMapSelect(id);
                }}
                onAskAgent={(prompt) => {
                  setIsChatOpen(true);
                  handleAskAgent(prompt);
                }}
                onOpenProfile={handleOpenProfile}
                onBackToMap={() => {
                  navigate({ pathname: '/', search: location.search });
                }}
                onRequireAuth={() => handleLogin('Sign in with Google to unlock Kai Concierge')}
              />
            </ErrorBoundary>
          </div>

          {/* If mobile, keep the bottom dock so the user can easily switch back to List/Map */}
          {isMobile && (
            <div className="p-2 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 shrink-0">
              <div className="flex items-center justify-around gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowSavedOnly(false);
                    setMobileTab('list');
                    setModalPropertyId(null);
                    navigate({ pathname: '/', search: location.search });
                  }}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer text-white/70 hover:text-white"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="text-[10px]">List ({displayedProperties.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileTab('map');
                    navigate({ pathname: '/', search: location.search });
                  }}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer text-white/70 hover:text-white"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Map</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (shortlistedIds.length > 0) {
                      setIsCompareOpen(true);
                    }
                    setShowSavedOnly(true);
                    navigate({ pathname: '/shortlist', search: location.search });
                  }}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer relative text-white/70 hover:text-white"
                >
                  <div className="relative">
                    <Heart className={cn("w-3.5 h-3.5", shortlistedIds.length > 0 && "text-rose-300 fill-rose-300")} />
                    {shortlistedIds.length > 0 && (
                      <span className="absolute -top-1 -right-2 w-3 h-3 bg-rose-500 text-white rounded-full text-[8px] font-black flex items-center justify-center">
                        {shortlistedIds.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px]">Shortlist</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigate({ pathname: '/concierge', search: location.search });
                  }}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer bg-blue-600 text-white shadow-md shadow-blue-500/25"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                  <span className="text-[10px]">Concierge</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : isMobile ? (
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
                      !showSavedOnly ? "bg-blue-600 text-white shadow-xs" : "bg-white/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setShowSavedOnly(true)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1",
                      showSavedOnly ? "bg-blue-600 text-white shadow-xs" : "bg-white/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
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
                petFriendly={petFriendlyFilter}
                needsParking={parkingFilter}
                hasAirCon={airConFilter}
                kaiPicksOnly={kaiPicksOnly}
                onSearch={handleSearchFilter} 
                onTogglePetFriendly={handleTogglePetFriendly}
                onToggleNeedsParking={handleToggleParking}
                onToggleHasAirCon={handleToggleAirCon}
                onToggleKaiPicks={() => setKaiPicksOnly(v => !v)}
                onAskKai={handleAskAgent}
                onOpenProfile={handleOpenProfile}
              />

              {activeFilters && (
                <div className="px-4 py-2 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-100/80 dark:border-blue-900/50 flex items-center justify-between shrink-0">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Filter Active</span>
                  </span>
                  <button 
                    onClick={handleResetFilters}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-300 hover:text-blue-700 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-slate-700 transition-all shadow-xs cursor-pointer"
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
                      user={user}
                      index={idx}
                      isActive={selectedId === p.id}
                      isFavorite={shortlistedIds.includes(p.id)}
                      isSaved={savedPropertiesList.some(sp => sp.id === p.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleSave={handleToggleSave}
                      onClick={() => {
                        handleMapSelect(p.id);
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
                onSelectProperty={handleMapSelect}
                isDarkMode={isDarkMode}
                user={user}
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
                    onClick={() => handleMapSelect(selectedProperty.id)}
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

          {/* Floating Mobile Bottom Navigation Dock */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto w-[92%] max-w-sm">
            <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white backdrop-blur-2xl border border-white/20 dark:border-slate-700/80 shadow-2xl rounded-2xl p-1.5 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowSavedOnly(false);
                  setMobileTab('list');
                  setModalPropertyId(null);
                  navigate({ pathname: '/', search: location.search });
                }}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer",
                  location.pathname === '/' && mobileTab === 'list' && !showSavedOnly
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25" 
                    : "text-white/70 hover:text-white"
                )}
              >
                <List className="w-3.5 h-3.5" />
                <span className="text-[10px]">List ({displayedProperties.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileTab('map');
                  navigate({ pathname: '/', search: location.search });
                }}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer",
                  location.pathname === '/' && mobileTab === 'map' && !showSavedOnly
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25" 
                    : "text-white/70 hover:text-white"
                )}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span className="text-[10px]">Map</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (shortlistedIds.length > 0) {
                    setIsCompareOpen(true);
                  }
                  setShowSavedOnly(true);
                  navigate({ pathname: '/shortlist', search: location.search });
                }}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer relative",
                  location.pathname === '/shortlist' || showSavedOnly
                    ? "bg-rose-600 text-white shadow-md shadow-rose-500/25" 
                    : "text-white/70 hover:text-white"
                )}
              >
                <div className="relative">
                  <Heart className={cn("w-3.5 h-3.5", shortlistedIds.length > 0 && "text-rose-300 fill-rose-300")} />
                  {shortlistedIds.length > 0 && (
                    <span className="absolute -top-1 -right-2 w-3 h-3 bg-rose-500 text-white rounded-full text-[8px] font-black flex items-center justify-center">
                      {shortlistedIds.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px]">Shortlist</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate({ pathname: '/concierge', search: location.search });
                }}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer",
                  location.pathname === '/concierge'
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25" 
                    : "text-white/70 hover:text-white"
                )}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                <span className="text-[10px]">Concierge</span>
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
                    className={cn("flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors", !showSavedOnly ? "bg-blue-600 text-white shadow-sm" : "bg-white/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700")}
                  >
                    All Properties
                  </button>
                  <button 
                    onClick={() => setShowSavedOnly(true)}
                    className={cn("flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1", showSavedOnly ? "bg-blue-600 text-white shadow-sm" : "bg-white/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700")}
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> Saved ({savedPropertiesList.length || shortlistedIds.length})
                  </button>
                </div>
              </header>

              {/* Keyword & Type Search */}
              <SearchFilterBar 
                keyword={keywordFilter} 
                propertyType={typeFilter} 
                petFriendly={petFriendlyFilter}
                needsParking={parkingFilter}
                hasAirCon={airConFilter}
                kaiPicksOnly={kaiPicksOnly}
                onSearch={handleSearchFilter} 
                onTogglePetFriendly={handleTogglePetFriendly}
                onToggleNeedsParking={handleToggleParking}
                onToggleHasAirCon={handleToggleAirCon}
                onToggleKaiPicks={() => setKaiPicksOnly(v => !v)}
                onAskKai={handleAskAgent} 
                onOpenProfile={handleOpenProfile}
              />

              {activeFilters && (
                <div className="px-4 py-2 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-100/80 dark:border-blue-900/50 flex items-center justify-between shrink-0">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Filter Active</span>
                  </span>
                  <button 
                    onClick={handleResetFilters}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-300 hover:text-blue-700 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-slate-700 transition-all shadow-xs cursor-pointer"
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
                      user={user}
                      index={idx}
                      isActive={selectedId === p.id}
                      isFavorite={shortlistedIds.includes(p.id)}
                      isSaved={savedPropertiesList.some(sp => sp.id === p.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleSave={handleToggleSave}
                      onClick={() => {
                        handleMapSelect(p.id);
                        if (maximizedPanel === 'list') setMaximizedPanel(null);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-slate-300/40 dark:bg-slate-700/40 hover:bg-blue-500/30 transition-colors cursor-col-resize active:bg-blue-500/50 relative z-50" />
          
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
                user={user}
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
            <PanelResizeHandle className="w-1.5 bg-slate-300/40 dark:bg-slate-700/40 hover:bg-blue-500/30 transition-colors cursor-col-resize active:bg-blue-500/50 relative z-50" />
          )}
          {modalPropertyId && activeModalProperty && (
            <Panel defaultSize="24" minSize="20" maxSize="38" className="bg-white dark:bg-slate-900">
              <div className="w-full h-full relative bg-white dark:bg-slate-900">
                <ErrorBoundary>
                  <PropertyPanel 
                    property={activeModalProperty} 
                    user={user}
                    selectedHubName={activeFilters?.destination_hub || user?.workplace_hub || "Martin Place"}
                    onClose={handleClosePropertyDetail} 
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
          <div className="relative w-full max-w-5xl h-full max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/60 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 z-10 animate-in zoom-in-95 duration-200">
            <ErrorBoundary>
              <PropertyPanel 
                property={activeModalProperty} 
                user={user}
                selectedHubName={activeFilters?.destination_hub || user?.workplace_hub || "Martin Place"}
                onClose={() => {
                  setMaximizedPanel(null);
                  handleClosePropertyDetail();
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
              user={user}
              selectedHubName={activeFilters?.destination_hub || user?.workplace_hub || "Martin Place"}
              onClose={handleClosePropertyDetail} 
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
          "fixed flex flex-col items-end gap-4 transition-all duration-300",
          isChatOpen ? "z-[160]" : "z-[110]",
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
              onRequireAuth={() => handleLogin('Sign in with Google to chat with Kai')}
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
          isLoggedIn={!!user}
          onOpenChat={() => {
            if (!user) {
              handleLogin('Sign in with Google to chat with Kai');
              return;
            }
            setIsChatOpen(true);
          }}
          onAskKai={handleAskAgent}
          onRequireAuth={() => handleLogin('Sign in with Google to chat with Kai')}
        />
      </div>

      {/* Shortlist Comparison Modal */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        properties={allPropertiesPool}
        shortlistedIds={shortlistedIds}
        onRemoveFromShortlist={handleToggleFavorite}
        onAskAgent={(prompt) => {
          setIsCompareOpen(false);
          handleAskAgent(prompt);
        }}
        onSelectProperty={(id) => {
          setIsCompareOpen(false);
          handleMapSelect(id);
        }}
      />

      {/* Conversational Profile Onboarding Modal */}
      {user && (
        <KaiOnboardingModal
          isOpen={isOnboardingOpen}
          user={user}
          onComplete={handleOnboardingComplete}
          onClose={() => setIsOnboardingOpen(false)}
        />
      )}

      {/* User Commute & Living Profile Modal */}
      {user ? (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={handleCloseProfile}
          user={user}
          onUpdateUser={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem('username', updatedUser.username);
          }}
          onApplyToFilters={handleApplyProfileToFilters}
        />
      ) : isProfileModalOpen ? (
        <AuthModal
          isOpen={isProfileModalOpen}
          onClose={handleCloseProfile}
          onSuccess={handleAuthSuccess}
        />
      ) : null}

      {/* Google Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthModalReason(undefined);
        }}
        onSuccess={handleAuthSuccess}
        reason={authModalReason}
      />

    </div>
  );
}

export default App;
