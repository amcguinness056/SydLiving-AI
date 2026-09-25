import { useState, useEffect, useRef, useCallback } from "react";
import { X, Sparkles, Shield, User as UserIcon } from "lucide-react";
import { api, type User } from "../api/client";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "752861145108-ql61rl87or43s9pg5la1j7s54f8rcinu.apps.googleusercontent.com";

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
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogleLogin = useCallback(async (name: string, email: string, avatarUrl: string) => {
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
  }, [onSuccess, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const setupGoogleAuth = () => {
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: { credential?: string }) => {
              if (!response.credential) return;
              try {
                const base64Url = response.credential.split(".")[1];
                const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                const jsonPayload = decodeURIComponent(
                  atob(base64)
                    .split("")
                    .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                    .join("")
                );
                const payload = JSON.parse(jsonPayload);
                handleGoogleLogin(
                  payload.name || payload.email || "Google User",
                  payload.email || "",
                  payload.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name || "User")}&background=4285F4&color=fff&rounded=true`
                );
              } catch (parseErr) {
                console.error("Error parsing Google credential", parseErr);
              }
            }
          });

          if (googleBtnRef.current) {
            googleBtnRef.current.innerHTML = "";
            (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
              theme: "outline",
              size: "large",
              width: 360,
              text: "continue_with",
              shape: "pill"
            });
          }
        } catch (e) {
          console.error("Google Identity Services setup error", e);
        }
      }
    };

    if ((window as any).google?.accounts?.id) {
      setupGoogleAuth();
    } else {
      const timer = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(timer);
          setupGoogleAuth();
        }
      }, 100);
      return () => clearInterval(timer);
    }
  }, [isOpen, handleGoogleLogin]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const email = customEmail.trim() || `${customName.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(customName.trim())}&background=4285F4&color=fff&rounded=true&bold=true`;
    handleGoogleLogin(customName.trim(), email, avatar);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                Sign in to SydLiving AI
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Save properties & sync AI chat history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          
          {/* Real Google Identity Services Button Container */}
          <div className="w-full flex justify-center min-h-[44px]">
            <div ref={googleBtnRef} className="w-full flex justify-center" />
          </div>

          {/* Quick Profile Selectors */}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white/95 dark:bg-slate-900/95 px-2 text-slate-400 dark:text-slate-500 font-medium">or test profile</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleGoogleLogin(
                "Aaron McGuinness",
                "aaron.mcguinness@gmail.com",
                ""
              )}
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-750 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                A
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Aaron M</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">aaron@gmail.com</div>
              </div>
            </button>

            <button
              onClick={() => handleGoogleLogin(
                "Sydney Explorer",
                "explorer@gmail.com",
                ""
              )}
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-750 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                S
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Explorer</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">explorer@gmail.com</div>
              </div>
            </button>
          </div>


          {/* Toggle Custom Account Details */}
          <div className="pt-2">
            {!showManual ? (
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold hover:underline flex items-center gap-1 mx-auto"
              >
                <UserIcon className="w-3.5 h-3.5" />
                Sign in with a different name / email
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="flex flex-col gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
                <input
                  type="text"
                  placeholder="Your Full Name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                />
                <input
                  type="email"
                  placeholder="Google Email (optional)"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 pt-2">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secure authentication provided via Google Identity</span>
          </div>

        </div>

      </div>
    </div>
  );
}
