import { useEffect, useState } from 'react';
import { Map } from './components/Map';
import { PropertyCard } from './components/PropertyCard';
import { PropertyPanel } from './components/PropertyPanel';
import { CompareModal } from './components/CompareModal';
import { api, type Property, type AgentAction, type DestinationHub, type IsochroneResponse } from './api/client';
import { ChatPanel, type Message } from './components/ChatPanel';
import { Sparkles, Maximize, Minimize, MessageCircle, X, Sun, Moon, Heart } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { cn } from './lib/utils';


type MaximizedState = 'list' | 'map' | 'details' | 'chat' | null;

function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalPropertyId, setModalPropertyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('sydliving_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

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

  // UI State
  const [maximizedPanel, setMaximizedPanel] = useState<MaximizedState>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<any>(null);


  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);

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

  // Initial load of hubs
  useEffect(() => {
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
  }, []);

  // Reload properties & isochrones when active hub or max commute changes
  useEffect(() => {
    loadProperties({ destination_hub: activeHub, max_commute_mins: maxCommuteMins });
    loadIsochrones(activeHub, maxCommuteMins);
  }, [activeHub, maxCommuteMins]);

  async function loadIsochrones(hubName: string, maxMins: number) {
    try {
      const data = await api.getIsochrones(hubName, maxMins);
      setIsochroneData(data);
    } catch (err) {
      console.error("Failed to load isochrones", err);
    }
  }

  async function loadProperties(filters?: { 
    suburb?: string, 
    max_rent?: number, 
    min_bedrooms?: number,
    destination_hub?: string,
    max_commute_mins?: number
  }) {
    setLoading(true);
    const combinedFilters = {
      destination_hub: activeHub,
      max_commute_mins: maxCommuteMins,
      ...(filters || {})
    };
    setActiveFilters(filters?.suburb || filters?.max_rent || filters?.min_bedrooms ? combinedFilters : null);
    try {
      const data = await api.getProperties(combinedFilters);
      setProperties(data);
    } catch (err) {
      console.error("Failed to load properties", err);
    } finally {
      setLoading(false);
    }
  }

  const handleToggleFavorite = (id: string) => {
    setShortlistedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
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
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const response = await api.sendChatMessage(text, chatHistory);
      
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
          <Panel defaultSize="25" minSize="20" maxSize="40" className="bg-white/20 dark:bg-slate-900/20">
            <div className={cn(getMaximizedClasses('list'), "flex flex-col bg-white/20 dark:bg-slate-900/20 backdrop-blur-xl")}>
              <header className="flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/60 dark:border-slate-800 shadow-xs z-10 shrink-0">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                    Properties within {maxCommuteMins}m
                  </h2>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {loading ? 'Evaluating routes...' : `${properties.length} listings to ${activeHub}`}
                  </p>
                </div>
                <button 
                  onClick={() => toggleMaximize('list')}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/80 dark:hover:bg-slate-800 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                  title={maximizedPanel === 'list' ? "Restore view" : "Enlarge list"}
                >
                  {maximizedPanel === 'list' ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </header>

              {activeFilters && (
                <div className="px-4 py-2 bg-indigo-50/90 dark:bg-indigo-950/40 border-b border-indigo-100/80 dark:border-indigo-900/50 flex items-center justify-between shrink-0">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>AI Filter Active</span>
                  </span>
                  <button 
                    onClick={() => loadProperties()}
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
                ) : properties.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/40 dark:border-slate-800 text-xs">
                    No properties found within {maxCommuteMins} mins of {activeHub}. Try expanding the reach slider!
                  </div>
                ) : (
                  properties.map(p => (
                    <PropertyCard 
                      key={p.id}
                      property={p} 
                      isActive={selectedId === p.id}
                      isFavorite={shortlistedIds.includes(p.id)}
                      onToggleFavorite={handleToggleFavorite}
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
          <Panel className="bg-slate-200 dark:bg-slate-950">
            <div className={cn(getMaximizedClasses('map'), "bg-slate-200 dark:bg-slate-950")}>
              <Map 
                properties={properties} 
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

    </div>
  );
}

export default App;

