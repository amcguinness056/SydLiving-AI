import { useEffect, useState } from 'react';
import { Map } from './components/Map';
import { PropertyCard } from './components/PropertyCard';
import { api, type Property } from './api/client';
import { Search, Sparkles } from 'lucide-react';

function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getProperties();
        setProperties(data);
      } catch (err) {
        console.error("Failed to load properties", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
              placeholder="Filter suburbs..." 
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
            ) : (
              properties.map(p => (
                <div key={p.id} className="snap-start shrink-0">
                  <PropertyCard 
                    property={p} 
                    isActive={selectedId === p.id}
                    onClick={() => setSelectedId(p.id)}
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

      {/* Right Panel: AI Assistant (Placeholder for Iteration 6) */}
      <div className="w-[400px] bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-xl flex flex-col overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="p-6 border-b border-white/20 bg-white/40">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            AI Relocation Assistant
          </h2>
          <p className="text-xs text-slate-500 mt-1">Powered by Gemini Pro</p>
        </div>

        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center text-slate-400">
          <div className="w-16 h-16 bg-white/50 rounded-2xl shadow-sm flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-indigo-300" />
          </div>
          <p className="text-sm">Agent Interface<br/>(Coming in Iteration 6)</p>
        </div>
        
        <div className="p-4 bg-white/40 border-t border-white/20">
          <div className="bg-white/50 border border-white border-b-0 rounded-t-xl p-3 text-sm text-slate-400 flex items-center">
            Ask me anything about Sydney rentals...
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
