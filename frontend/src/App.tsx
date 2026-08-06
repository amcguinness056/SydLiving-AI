import { useEffect, useState } from 'react';
import { Map } from './components/Map';
import { PropertyCard } from './components/PropertyCard';
import { PropertyPanel } from './components/PropertyPanel';
import { api, type Property, type AgentAction } from './api/client';
import { ChatPanel, type Message } from './components/ChatPanel';
import { Sparkles, Maximize, Minimize, MessageCircle, X, Briefcase } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { cn } from './lib/utils';
import { booleanPointInPolygon, point } from '@turf/turf';

type MaximizedState = 'list' | 'map' | 'details' | 'chat' | null;

function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalPropertyId, setModalPropertyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [maximizedPanel, setMaximizedPanel] = useState<MaximizedState>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(0);
  const [activeFilters, setActiveFilters] = useState<any>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);

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
          contours: [{ time: 15 }, { time: 30 }, { time: 45 }]
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
    loadProperties();
  }, []);

  async function loadProperties(filters?: { suburb?: string, max_rent?: number, min_bedrooms?: number }) {
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

  const handleAgentAction = (action: AgentAction) => {
    if (action.action_type === 'update_properties') {
      loadProperties(action.data);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // Send chat with history format expected by backend
      const response = await api.sendChatMessage(text, chatHistory);
      
      const agentMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', content: response.reply };
      setMessages(prev => [...prev, agentMsg]);
      
      // Update history for next turn
      setChatHistory(prev => [
        ...prev, 
        { role: 'user', parts: text }, 
        { role: 'model', parts: response.reply }
      ]);

      // Process state sync actions
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

  const handleLayout = (sizes: number[]) => {
    if (sizes.length === 3) {
      setRightPanelWidth(sizes[2]);
    } else {
      setRightPanelWidth(0);
    }
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

  return (
    <div className="min-h-screen bg-slate-100 flex p-4 gap-4 h-screen font-sans overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 relative">
      
      {/* @ts-ignore */}
      <PanelGroup 
        orientation="horizontal" 
        className="w-full h-full rounded-[2rem] overflow-hidden shadow-2xl border border-white/40 bg-white/40 backdrop-blur-xl"
        {...({onLayout: handleLayout} as any)}
      >
        
        {/* Left Panel: Property List */}
        <Panel defaultSize="25" minSize="20" maxSize="40" className="bg-white/20">
          <div className={cn(getMaximizedClasses('list'), "flex flex-col bg-white/20 backdrop-blur-xl")}>
            <header className="flex items-center justify-between px-4 py-4 bg-white/60 backdrop-blur-xl border-b border-white/40 shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-indigo-500" />
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
                  SydLiving AI
                </h1>
              </div>
              <button 
                onClick={() => toggleMaximize('list')}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white/50 rounded-lg transition-colors"
                title={maximizedPanel === 'list' ? "Restore view" : "Enlarge list"}
              >
                {maximizedPanel === 'list' ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </header>

            {activeFilters && (
              <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-indigo-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Filter Applied
                </span>
                <button 
                  onClick={() => loadProperties()}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200 transition-colors shadow-sm"
                >
                  Reset List
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
                const filteredProperties = properties.filter(p => {
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
                      No properties found matching this criteria. Try asking for something else!
                    </div>
                  );
                }

                return filteredProperties.map(p => (
                  <PropertyCard 
                    key={p.id}
                    property={p} 
                    isActive={selectedId === p.id}
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
        <Panel className="bg-slate-200">
          <div className={cn(getMaximizedClasses('map'), "bg-slate-200")}>
            <Map 
              properties={properties} 
              selectedPropertyId={selectedId} 
              onSelectProperty={handleMapSelect}
              isMaximized={maximizedPanel === 'map'}
              onToggleMaximize={() => toggleMaximize('map')}
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
          <Panel defaultSize="22" minSize="20" maxSize="35" className="bg-white">
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
        style={{ right: maximizedPanel === 'chat' ? '1.5rem' : `calc(${rightPanelWidth}vw + 1.5rem)` }}
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

    </div>
  );
}

export default App;
