import { useState, useEffect } from 'react';
import { Sparkles, X, Train, Waves, Compass } from 'lucide-react';

interface KaiLauncherProps {
  onOpenChat: () => void;
  onAskKai: (prompt: string) => void;
  isChatOpen: boolean;
}

export function KaiLauncher({ onOpenChat, onAskKai, isChatOpen }: KaiLauncherProps) {
  const [showGreeting, setShowGreeting] = useState(false);

  useEffect(() => {
    // Show greeting after 1.5s if not previously dismissed this session and chat is closed
    const dismissed = sessionStorage.getItem('sydliving_kai_greeting_dismissed');
    if (!dismissed && !isChatOpen) {
      const timer = setTimeout(() => {
        setShowGreeting(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setShowGreeting(false);
    }
  }, [isChatOpen]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowGreeting(false);
    sessionStorage.setItem('sydliving_kai_greeting_dismissed', 'true');
  };

  const handleChipClick = (e: React.MouseEvent, prompt: string) => {
    e.stopPropagation();
    setShowGreeting(false);
    sessionStorage.setItem('sydliving_kai_greeting_dismissed', 'true');
    onAskKai(prompt);
  };

  if (isChatOpen) return null;

  return (
    <div className="relative flex flex-col items-end gap-3 pointer-events-auto">
      {/* Proactive Speech Bubble / Teaser Card */}
      {showGreeting && (
        <div 
          className="w-[calc(100vw-2.5rem)] max-w-sm sm:w-80 bg-white/95 dark:bg-slate-900/95 border border-blue-200/90 dark:border-blue-900/80 rounded-2xl p-3 sm:p-3.5 shadow-2xl shadow-blue-500/15 backdrop-blur-xl transition-all duration-300 relative animate-in fade-in slide-in-from-bottom-3"
          role="region"
          aria-label="Kai concierge greeting"
        >
          {/* Header with Title and Dismiss */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                G'day! I'm Kai
              </span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.2 rounded-full border border-blue-200/60 dark:border-blue-900/60">
                Sydney Concierge
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Dismiss message"
              aria-label="Dismiss greeting"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Friendly Body Prompt */}
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed py-2">
            Looking for a coastal pad, fast transit commute to the CBD, or a fair rent breakdown? Ask me anything about Sydney living!
          </p>

          {/* Quick Action Chips */}
          <div className="flex flex-col gap-1.5 pt-1">
            <button
              onClick={(e) => handleChipClick(e, "Show me rentals with under 25 mins commute to Barangaroo")}
              className="w-full text-left px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50/80 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/70 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-[11px] font-medium transition-all flex items-center gap-2 group shadow-2xs"
            >
              <Train className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">Fast commute to Barangaroo (&lt; 25m)</span>
            </button>

            <button
              onClick={(e) => handleChipClick(e, "What are the best beachside rentals under $900/wk in the Eastern Suburbs?")}
              className="w-full text-left px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50/80 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/70 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-[11px] font-medium transition-all flex items-center gap-2 group shadow-2xs"
            >
              <Waves className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">Beach pads under $900/wk</span>
            </button>

            <button
              onClick={(e) => handleChipClick(e, "Show 2-bedroom apartments near Sydney Metro stations with high walkability")}
              className="w-full text-left px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50/80 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/70 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-[11px] font-medium transition-all flex items-center gap-2 group shadow-2xs"
            >
              <Compass className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">Metro-connected 2BR spots</span>
            </button>
          </div>

          {/* Speech Bubble Tail */}
          <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white/95 dark:bg-slate-900/95 border-r border-b border-blue-200/90 dark:border-blue-900/80 transform rotate-45" />
        </div>
      )}

      {/* Main Concierge Capsule Button */}
      <button
        onClick={onOpenChat}
        className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-900 text-slate-900 dark:text-white rounded-full shadow-xl shadow-blue-500/20 dark:shadow-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 hover:border-blue-400 dark:hover:border-blue-600 flex items-center gap-2.5 sm:gap-3 transition-all hover:scale-105 active:scale-95 group relative z-50 cursor-pointer"
        title="Chat with Kai — Sydney AI Concierge"
        aria-label="Open chat with Kai Sydney AI Concierge"
      >
        {/* Avatar Medallion with Live Pulse Dot */}
        <div className="relative">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:bg-blue-700 transition-colors">
            <Sparkles className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
          </div>
          <span 
            className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse"
            title="Kai is active"
          />
        </div>

        {/* Text Details */}
        <div className="text-left flex flex-col pr-1">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-900 dark:text-white text-xs leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Ask Kai
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/90 px-1.5 py-0.5 rounded-full border border-blue-200/70 dark:border-blue-900/60">
              AI Guide
            </span>
          </div>
          <span className="hidden sm:inline-block text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
            Sydney Living Concierge
          </span>
        </div>
      </button>
    </div>
  );
}
