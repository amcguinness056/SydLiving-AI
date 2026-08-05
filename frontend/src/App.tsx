import { useEffect, useState } from 'react';
import { Map } from './components/Map';
import { PropertyCard } from './components/PropertyCard';
import { PropertyPanel } from './components/PropertyPanel';
import { api, type Property, type AgentAction } from './api/client';
import { ChatPanel, type Message } from './components/ChatPanel';
import { Search, Sparkles } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';

function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalPropertyId, setModalPropertyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  // Initial load
  useEffect(() => {
    loadProperties();
  }, []);

  async function loadProperties(filters?: { suburb?: string, max_rent?: number, min_bedrooms?: number }) {
    setLoading(true);
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
    // We could add update_commute here in the future to show commute routes on the map
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

  return (
    <div className="min-h-screen bg-slate-100 flex p-4 gap-4 h-screen font-sans overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      
      <PanelGroup 
        orientation="horizontal" 
        className="w-full h-full rounded-[2rem] overflow-hidden shadow-2xl border border-white/40 bg-white/40 backdrop-blur-xl"
      >
        
        {/* Left Panel: Property List */}
        <Panel defaultSize={25} minSize={20} maxSize={40} className="flex flex-col relative h-full bg-white/20">
          <header className="flex items-center gap-2 px-4 py-4 bg-white/60 backdrop-blur-xl border-b border-white/40 shadow-sm z-10 shrink-0">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
              SydLiving AI
            </h1>
          </header>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-slate-400 animate-pulse">Loading properties...</div>
            ) : properties.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white/40 backdrop-blur-md rounded-2xl border border-white/40">
                No properties found matching this criteria. Try asking for something else!
              </div>
            ) : (
              properties.map(p => (
                <PropertyCard 
                  key={p.id}
                  property={p} 
                  isActive={selectedId === p.id}
                  onClick={() => {
                    setSelectedId(p.id);
                    setModalPropertyId(p.id);
                  }}
                />
              ))
            )}
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-indigo-900/5 hover:bg-indigo-500/30 transition-colors cursor-col-resize active:bg-indigo-500/50 relative z-50" />
        
        {/* Center Panel: Map */}
        <Panel className="relative h-full bg-slate-200">
          <Map properties={properties} selectedPropertyId={selectedId} />
        </Panel>

        {/* Right Panel: Property Details & Chat */}
        {modalPropertyId && (
          <PanelResizeHandle className="w-1.5 bg-indigo-900/5 hover:bg-indigo-500/30 transition-colors cursor-col-resize active:bg-indigo-500/50 relative z-50" />
        )}
        {modalPropertyId && (
          <Panel defaultSize={30} minSize={20} maxSize={50} className="relative h-full bg-white">
            <PropertyPanel 
              property={properties.find(p => p.id === modalPropertyId)!} 
              onClose={() => setModalPropertyId(null)} 
            />
          </Panel>
        )}

        <PanelResizeHandle className="w-1.5 bg-indigo-900/5 hover:bg-indigo-500/30 transition-colors cursor-col-resize active:bg-indigo-500/50 relative z-50" />

        <Panel defaultSize={25} minSize={20} maxSize={40} className="h-full">
          <ChatPanel 
            messages={messages} 
            isThinking={isThinking} 
            onSendMessage={handleSendMessage} 
          />
        </Panel>

      </PanelGroup>

    </div>
  );
}

export default App;
