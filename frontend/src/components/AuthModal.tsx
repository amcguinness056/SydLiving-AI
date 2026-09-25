import { useState, useEffect, useRef, useCallback } from "react";
import { X, Sparkles, Shield } from "lucide-react";
import { api, type User } from "../api/client";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "752861145108-ql61rl87or43s9pg5la1j7s54f8rcinu.apps.googleusercontent.com";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [, setLoading] = useState(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        
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
        <div className="p-6 flex flex-col gap-5">
          
          {/* Real Google Identity Services Button Container */}
          <div className="w-full flex justify-center min-h-[44px]">
            <div ref={googleBtnRef} className="w-full flex justify-center" />
          </div>

          {/* Security footnote */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secure authentication provided via Google Identity</span>
          </div>

        </div>

      </div>
    </div>
  );
}
