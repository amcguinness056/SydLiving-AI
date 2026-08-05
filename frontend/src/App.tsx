import { useEffect, useState } from 'react';
import { Map } from './components/Map';
import { PropertyCard } from './components/PropertyCard';
import { PropertyModal } from './components/PropertyModal';
import { api, type Property, type AgentAction } from './api/client';
import { ChatPanel, type Message } from './components/ChatPanel';
import { Search, Sparkles } from 'lucide-react';

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
      
      {/* Left Panel: Explore (Map & Cards) */}
      <div className="flex-1 flex flex-col gap-4 h-full relative">
        <header className="flex items-center gap-2 px-4 py-3 bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm z-10 relative">
          <Sparkles className="w-6 h-6 text-indigo-500" />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
            SydLiving AI
          </h1>
          <div className="ml-auto relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter suburbs (use chat)..." 
              className="w-full pl-9 pr-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm backdrop-blur-sm"
              disabled
            />
          </div>
        </header>

        <div className="flex-1 relative flex gap-4 min-h-0">
          {/* Property List */}
          <div className="w-96 flex flex-col gap-4 overflow-y-auto pr-2 pb-4 snap-y z-10 relative custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-slate-400 animate-pulse">Loading properties...</div>
            ) : properties.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white/40 backdrop-blur-md rounded-2xl border border-white/40">
                No properties found matching this criteria. Try asking for something else!
              </div>
            ) : (
              properties.map(p => (
                <div key={p.id} className="snap-start shrink-0">
                  <PropertyCard 
                    property={p} 
                    isActive={selectedId === p.id}
                    onClick={() => {
                      setSelectedId(p.id);
                      setModalPropertyId(p.id);
                    }}
                  />
                </div>
              ))
            )}
          </div>
          
          {/* Map View */}
          <div className="flex-1 relative z-0">
            <Map properties={properties} selectedPropertyId={selectedId} />
          </div>
        </div>
      </div>

      {/* Right Panel: AI Assistant */}
      <ChatPanel 
        messages={messages} 
        isThinking={isThinking} 
        onSendMessage={handleSendMessage} 
      />

      {/* Property Modal */}
      {modalPropertyId && (
        <PropertyModal 
          property={properties.find(p => p.id === modalPropertyId)!} 
          onClose={() => setModalPropertyId(null)} 
        />
      )}
    </div>
  );
}

export default App;
