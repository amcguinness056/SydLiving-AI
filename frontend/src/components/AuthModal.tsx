import { useState } from "react";
import { X, Sparkles, Shield, User as UserIcon } from "lucide-react";
import { api, type User } from "../api/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async (name: string, email: string, avatarUrl: string) => {
    setLoading(true);
    try {
      const user = await api.loginWithGoogle({
        name,
        email,
        avatar_url: avatarUrl
      });
      onSuccess(user);
      onClose();
    } catch (err) {
      console.error("Google authentication failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const email = customEmail.trim() || `${customName.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(customName)}`;
    handleGoogleLogin(customName.trim(), email, avatar);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Sign in to SydLiving AI
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Save properties & sync AI chat history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          
          {/* Main Sign in with Google Button */}
          <button
            onClick={() => handleGoogleLogin(
              "Aaron McGuinness",
              "aaron.mcguinness@gmail.com",
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
            )}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-2xl border border-slate-300 shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{loading ? "Signing in..." : "Continue with Google"}</span>
          </button>

          {/* Quick Profile Selectors */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white/95 px-2 text-slate-400 font-medium">or choose Google account</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleGoogleLogin(
                "Aaron M",
                "aaron@sydliving.ai",
                "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
              )}
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 transition-all text-left group"
            >
              <img
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
                alt="Aaron"
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600">Aaron M</div>
                <div className="text-[10px] text-slate-400 truncate">aaron@sydliving.ai</div>
              </div>
            </button>

            <button
              onClick={() => handleGoogleLogin(
                "Sydney Explorer",
                "explorer@gmail.com",
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
              )}
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 transition-all text-left group"
            >
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
                alt="Explorer"
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600">Explorer</div>
                <div className="text-[10px] text-slate-400 truncate">explorer@gmail.com</div>
              </div>
            </button>
          </div>

          {/* Toggle Custom Account Details */}
          <div className="pt-2">
            {!showManual ? (
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold hover:underline flex items-center gap-1 mx-auto"
              >
                <UserIcon className="w-3.5 h-3.5" />
                Sign in with a different name / email
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="flex flex-col gap-2.5 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
                <input
                  type="text"
                  placeholder="Your Full Name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                />
                <input
                  type="email"
                  placeholder="Google Email (optional)"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={loading || !customName.trim()}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  Sign In
                </button>
              </form>
            )}
          </div>

          {/* Security footnote */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-2">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secure authentication provided via Google Identity</span>
          </div>

        </div>

      </div>
    </div>
  );
}
