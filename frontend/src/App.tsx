import { useEffect, useState } from 'react';
import { Map } from './components/Map';
import { PropertyCard } from './components/PropertyCard';
import { PropertyPanel } from './components/PropertyPanel';
import { AuthModal } from './components/AuthModal';
import { api, type Property, type AgentAction, type User } from './api/client';
import { ChatPanel, type Message } from './components/ChatPanel';
import { Sparkles, Maximize, Minimize, MessageCircle, X, LogOut, Heart, Briefcase } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { cn } from './lib/utils';
import { booleanPointInPolygon, point } from '@turf/turf';

type MaximizedState = 'list' | 'map' | 'details' | 'chat' | null;

function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalPropertyId, setModalPropertyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // UI State
  const [maximizedPanel, setMaximizedPanel] = useState<MaximizedState>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [activeFilters, setActiveFilters] = useState<any>(null);

  // Search State
  const [keywordFilter, setKeywordFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [spatialFilter, setSpatialFilter] = useState<{ circle?: string, polygon?: string } | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Commute state
  const [workplace, setWorkplace] = useState<{ lat: number, lng: number } | null>(null);
  const [isSettingWorkplace, setIsSettingWorkplace] = useState(false);
  const [isochrones, setIsochrones] = useState<any>(null);
  const [maxCommuteTime, setMaxCommuteTime] = useState<number | null>(null);

  const fetchIsochrones = async (lat: number, lng: number) => {
    try {
      const res = await fetch('https://valhalla1.openstreetmap.de/isochrone', {
        method: 'POST',
        body: JSON.stringify({
          locations: [{ lat, lon: lng }],
          costing: "auto",
          contours: [{ time: 15 }, { time: 30 }, { time: 45 }],
          polygons: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        setIsochrones(data);
        if (!maxCommuteTime) setMaxCommuteTime(30);
      }
    } catch (err) {
      console.error("Failed to fetch isochrones", err);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isSettingWorkplace) {
      setWorkplace({ lat, lng });
      setIsSettingWorkplace(false);
      fetchIsochrones(lat, lng);
    }
  };

  // Initial load
  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    const username = localStorage.getItem('username');
    const email = localStorage.getItem('user_email') || undefined;
    const avatarUrl = localStorage.getItem('user_avatar') || undefined;
    if (userId && username) {
      setUser({ id: userId, username, email, avatar_url: avatarUrl });
    }
    loadProperties();
  }, []);

  useEffect(() => {
    if (user) {
      loadSavedProperties();
    } else {
      setSavedProperties([]);
      setShowSavedOnly(false);
    }
  }, [user]);

  async function loadProperties(filters?: any) {
    setLoading(true);
    setActiveFilters(filters || null);
    try {
      const data = await api.getProperties(filters);
      setProperties(data);
      setSelectedId(null);
      setModalPropertyId(null);
    } catch (err) {
      console.error("Failed to load properties", err);
    } finally {
      setLoading(false);
    }
  }

  const applyFilters = () => {
    const filters = {
      ...activeFilters,
      keyword: keywordFilter || undefined,
      property_type: typeFilter || undefined,
      circle: spatialFilter?.circle,
      polygon: spatialFilter?.polygon
    };
    loadProperties(filters);
  };

  async function loadSavedProperties() {
    try {
      const data = await api.getSavedProperties();
      setSavedProperties(data);
    } catch (err) {
      console.error("Failed to load saved properties", err);
    }
  }

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

  const handleToggleSave = async (id: string, isSaved: boolean) => {
    if (!user) {
      alert("Please login to save properties");
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

  const handleAgentAction = (action: AgentAction) => {
    if (action.action_type === 'update_properties') {
      loadProperties(action.data);
    } else if (action.action_type === 'set_session') {
      setCurrentSessionId(action.data.session_id);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const response = await api.sendChatMessage(text, chatHistory, currentSessionId || undefined);
      
      const agentMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', content: response.reply };
      setMessages(prev => [...prev, agentMsg]);
      
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
      return "fixed inset-4 z-[100] rounded-[2rem] shadow-2xl border border-white/40 overflow-hidden animate-in fade-in zoom-in-95 duration-300";
    }
    return "w-full h-full relative";
  };

  const getChatClasses = () => {
    if (maximizedPanel === 'chat') {
      return "fixed inset-4 z-[120] bg-white rounded-[2rem] shadow-2xl border border-white/50 overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-300";
    }
    return "w-[400px] h-[600px] max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-white/50 overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-8 fade-in duration-300 relative z-10";
  };

  const displayedProperties = showSavedOnly ? properties.filter(p => savedProperties.some(sp => sp.id === p.id)) : properties;

  return (
    <div className="min-h-screen bg-slate-100 flex p-4 gap-4 h-screen font-sans overflow-hidden relative">
      
      <PanelGroup 
        orientation="horizontal" 
        className="w-full h-full rounded-[2rem] overflow-hidden shadow-2xl border border-white/50 bg-white/40 backdrop-blur-xl"
      >
        
        {/* Left Panel: Property List */}
        {/* @ts-ignore */}
        <Panel id="left-panel" defaultSize="25%" minSize="20%" maxSize="40%" className="bg-white/20 flex flex-col h-full min-w-0">
          <div className={cn(getMaximizedClasses('list'), "flex flex-col bg-white/20 backdrop-blur-xl h-full")}>
            <header className="flex flex-col px-4 py-3.5 bg-white/80 backdrop-blur-xl border-b border-white/60 shadow-xs z-10 shrink-0 gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                      SydLiving AI
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500">
                      {loading ? 'Searching...' : `${properties.length} Sydney Listings`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user ? (
                    <div className="flex items-center gap-2 bg-white/80 border border-slate-200/80 rounded-xl px-2 py-1 shadow-xs">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={user.username} 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=4285F4&color=fff&rounded=true&bold=true`;
                          }}
                          className="w-5 h-5 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <img 
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=4285F4&color=fff&rounded=true&bold=true`}
                          alt={user.username} 
                          className="w-5 h-5 rounded-full object-cover border border-slate-200"
                        />
                      )}
                      <span className="text-xs font-bold text-slate-700 max-w-[100px] truncate">{user.username}</span>
                      <button onClick={handleLogout} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-0.5" title="Logout">
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={handleLogin} 
                      className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-2 hover:shadow-sm"
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
                  <button 
                    onClick={() => toggleMaximize('list')}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white/80 rounded-xl border border-transparent hover:border-slate-200 transition-all"
                    title={maximizedPanel === 'list' ? "Restore view" : "Enlarge list"}
                  >
                    {maximizedPanel === 'list' ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowSavedOnly(false)}
                  className={cn("flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors", !showSavedOnly ? "bg-indigo-600 text-white shadow-sm" : "bg-white/50 text-slate-600 hover:bg-white")}
                >
                  All Properties
                </button>
                <button 
                  onClick={() => setShowSavedOnly(true)}
                  className={cn("flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1", showSavedOnly ? "bg-indigo-600 text-white shadow-sm" : "bg-white/50 text-slate-600 hover:bg-white")}
                >
                  <Heart className="w-3.5 h-3.5" /> Saved ({savedProperties.length})
                </button>
              </div>
            </header>

            <div className="px-4 py-3 bg-white/40 backdrop-blur-md border-b border-white/40 shadow-sm z-10 shrink-0 flex flex-col gap-2">
              <input 
                type="text"
                placeholder="Search descriptions..."
                className="w-full px-3 py-2 bg-white/60 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={keywordFilter}
                onChange={e => setKeywordFilter(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
              />
              <div className="flex gap-2">
                <select 
                  className="flex-1 px-3 py-2 bg-white/60 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-700"
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Search
                </button>
              </div>
            </div>

            {activeFilters && (
              <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200/80 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>AI Filter Active</span>
                </span>
                <button 
                  onClick={() => {
                    setKeywordFilter('');
                    setTypeFilter('');
                    setSpatialFilter(null);
                    loadProperties();
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200 transition-all shadow-xs"
                >
                  Clear Filter
                </button>
              </div>
            )}

            {/* Commute Isochrones Panel */}
            <div className="px-4 py-3 bg-white/60 backdrop-blur-xl border-b border-white/40 flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-emerald-500" />
                  Commute Isochrones
                </span>
                <button 
                  onClick={() => setIsSettingWorkplace(!isSettingWorkplace)}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 rounded-full border transition-colors shadow-sm",
                    isSettingWorkplace 
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300 animate-pulse" 
                      : "bg-white text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border-slate-200 hover:border-emerald-200"
                  )}
                >
                  {isSettingWorkplace ? "Click on map..." : workplace ? "Change Workplace" : "Set Workplace"}
                </button>
              </div>
              
              {workplace && isochrones && (
                <div className="flex gap-2">
                  {[15, 30, 45].map(time => (
                    <button
                      key={time}
                      onClick={() => setMaxCommuteTime(maxCommuteTime === time ? null : time)}
                      className={cn(
                        "flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-all",
                        maxCommuteTime === time 
                          ? "bg-emerald-500 text-white border-emerald-600 shadow-md" 
                          : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                      )}
                    >
                      {time} min
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar relative z-0">
              {(() => {
                const filteredProperties = displayedProperties.filter(p => {
                  if (workplace && isochrones && maxCommuteTime) {
                    const feature = isochrones.features.find((f: any) => f.properties.contour === maxCommuteTime);
                    if (feature) {
                      const pt = point([p.longitude, p.latitude]);
                      return booleanPointInPolygon(pt, feature);
                    }
                  }
                  return true;
                });

                if (loading) {
                  return <div className="p-8 text-center text-slate-400 animate-pulse">Loading properties...</div>;
                }
                
                if (filteredProperties.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400 bg-white/40 backdrop-blur-md rounded-2xl border border-white/40">
                      {showSavedOnly ? "No saved properties yet. Click the heart on a property to save it!" : "No properties found matching this criteria. Try asking for something else!"}
                    </div>
                  );
                }

                return filteredProperties.map(p => (
                  <PropertyCard 
                    key={p.id}
                    property={p} 
                    isActive={selectedId === p.id}
                    isSaved={savedProperties.some(sp => sp.id === p.id)}
                    onToggleSave={handleToggleSave}
                    onClick={() => {
                      setSelectedId(p.id);
                      setModalPropertyId(p.id);
                      if (maximizedPanel === 'list') setMaximizedPanel(null);
                    }}
                  />
                ));
              })()}
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-indigo-900/5 hover:bg-indigo-500/30 transition-colors cursor-col-resize active:bg-indigo-500/50 relative z-50" />
        
        {/* Center Panel: Map */}
        {/* @ts-ignore */}
        <Panel id="map-panel" defaultSize="75%" className="bg-slate-200 min-w-0">
          <div className={cn(getMaximizedClasses('map'), "bg-slate-200 min-w-0")}>
            <Map 
              properties={displayedProperties} 
              selectedPropertyId={selectedId} 
              onSelectProperty={handleMapSelect}
              isMaximized={maximizedPanel === 'map'}
              onToggleMaximize={() => toggleMaximize('map')}
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
                const filters = { ...activeFilters, keyword: keywordFilter || undefined, property_type: typeFilter || undefined, ...spatial };
                loadProperties(filters);
              }}
              onDrawDeleted={() => {
                setSpatialFilter(null);
                const filters = { ...activeFilters, keyword: keywordFilter || undefined, property_type: typeFilter || undefined };
                delete filters.circle;
                delete filters.polygon;
                loadProperties(filters);
              }}
              workplace={workplace}
              isochrones={isochrones}
              isSettingWorkplace={isSettingWorkplace}
              onMapClick={handleMapClick}
            />
          </div>
        </Panel>

        {/* Right Panel: Property Details */}
        {modalPropertyId && (
          <PanelResizeHandle className="w-1.5 bg-indigo-900/5 hover:bg-indigo-500/30 transition-colors cursor-col-resize active:bg-indigo-500/50 relative z-50" />
        )}
        {modalPropertyId && (
          /* @ts-ignore */
          <Panel id="details-panel" defaultSize="22%" minSize="20%" maxSize="35%" className="bg-white">
            <div className={cn(getMaximizedClasses('details'), "bg-white")}>
              <PropertyPanel 
                property={properties.find(p => p.id === modalPropertyId)!} 
                onClose={() => setModalPropertyId(null)} 
                isMaximized={maximizedPanel === 'details'}
                onToggleMaximize={() => toggleMaximize('details')}
              />
            </div>
          </Panel>
        )}

      </PanelGroup>

      {/* Floating AI Chat Widget */}
      <div 
        className="fixed bottom-6 z-[110] flex flex-col items-end gap-4 pointer-events-none transition-all duration-300"
        style={{ right: maximizedPanel === 'chat' ? '1.5rem' : `calc(35vw + 1.5rem)` }}
      >
        
        {/* Chat Window */}
        {isChatOpen && (
          <div className={getChatClasses()}>
            <div className="h-full relative z-10 bg-white/60 backdrop-blur-3xl flex flex-col">
              <div className="px-5 py-4 border-b border-indigo-100 bg-white/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  <span className="font-bold text-slate-800">SydLiving AI</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => toggleMaximize('chat')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    title={maximizedPanel === 'chat' ? "Restore view" : "Enlarge chat"}
                  >
                    {maximizedPanel === 'chat' ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setIsChatOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    title="Close chat"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 relative overflow-hidden">
                <ChatPanel 
                  messages={messages} 
                  isThinking={isThinking} 
                  onSendMessage={handleSendMessage} 
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
          className="w-16 h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl shadow-indigo-200 flex items-center justify-center transition-all hover:scale-105 active:scale-95 pointer-events-auto group relative z-50"
        >
          {isChatOpen ? (
            <X className="w-7 h-7 transition-transform group-hover:rotate-90" />
          ) : (
            <MessageCircle className="w-7 h-7" />
          )}
        </button>
      </div>

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
