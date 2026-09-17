import { useState } from 'react';
import { X, Bell, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { api } from '../api/client';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSuburbs?: string[];
  maxRent?: number;
}

export function AlertModal({ isOpen, onClose, activeSuburbs = [], maxRent }: AlertModalProps) {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.createAlert({
        email: email.trim(),
        suburbs: activeSuburbs,
        max_rent: maxRent,
        frequency: frequency
      });

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Could not register alert subscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/60 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">
                New Listing Alerts
              </h2>
              <p className="text-xs text-slate-500">Get notified when matching rentals are listed</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    required
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-slate-800"
                  />
                </div>
              </div>

              {/* Summary of Active Criteria */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                <span className="text-[11px] font-bold text-slate-500 block uppercase">Matching Criteria</span>
                <div className="text-slate-700 flex items-center gap-2">
                  <span>Suburbs: <strong>{activeSuburbs.length > 0 ? activeSuburbs.join(', ') : 'All Sydney'}</strong></span>
                </div>
                {maxRent && (
                  <div className="text-slate-700">
                    Max Rent: <strong>${maxRent}/week</strong>
                  </div>
                )}
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notification Frequency
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFrequency('instant')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      frequency === 'instant' 
                        ? 'bg-amber-50 border-amber-300 text-amber-800' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ⚡ Instant Notification
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('daily')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      frequency === 'daily' 
                        ? 'bg-amber-50 border-amber-300 text-amber-800' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    📅 Daily Digest
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe to Alerts"}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-800">Alert Activated!</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                We'll email <strong>{email}</strong> the moment new properties matching your Sydney criteria are discovered.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
