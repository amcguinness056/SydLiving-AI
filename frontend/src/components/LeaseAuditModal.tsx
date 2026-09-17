import { useState } from 'react';
import { X, ShieldAlert, ShieldCheck, AlertTriangle, Upload, Sparkles, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

interface RedFlag {
  severity: string;
  category: string;
  title: string;
  clause_excerpt: string;
  nsw_legislation_reference: string;
  recommended_action: string;
}

interface LeaseAuditResult {
  risk_level: string;
  risk_score: number;
  weekly_rent?: number;
  bond_amount?: number;
  bond_weeks_ratio?: number;
  lease_term_months?: number;
  red_flags: RedFlag[];
  extracted_clauses_summary: string[];
  is_aws_analyzed: boolean;
}

interface LeaseAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeaseAuditModal({ isOpen, onClose }: LeaseAuditModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LeaseAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPasteText('');
      setError(null);
    }
  };

  const handleAudit = async () => {
    if (!file && !pasteText.trim()) {
      setError("Please select a lease PDF or paste agreement clauses.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('lease_text', pasteText.trim());
      }

      const res = await fetch('http://localhost:8000/api/lease/audit', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Audit failed: ${res.statusText}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to audit lease. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (level: string) => {
    if (level === 'HIGH') {
      return {
        bg: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
        icon: ShieldAlert,
        text: 'High Risk • Statutory Red Flags Found'
      };
    }
    if (level === 'MEDIUM') {
      return {
        bg: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
        icon: AlertTriangle,
        text: 'Moderate Risk • Review Recommended'
      };
    }
    return {
      bg: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
      icon: ShieldCheck,
      text: 'Low Risk • Standard NSW Tenancy Terms'
    };
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/60 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>Lease & Inspection Auditor</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  AWS Textract & Comprehend
                </span>
              </h2>
              <p className="text-xs text-slate-500">Scan NSW residential tenancy agreements for illegal clauses & bond traps</p>
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
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {!result ? (
            <>
              {/* File Upload Box */}
              <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition-colors bg-indigo-50/20">
                <input 
                  type="file" 
                  accept=".pdf,application/pdf" 
                  id="lease-upload" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
                <label htmlFor="lease-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-800 text-sm mb-1">
                    {file ? file.name : "Upload Tenancy Agreement (PDF)"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {file ? `${(file.size / 1024).toFixed(1)} KB selected` : "Drag and drop or click to browse"}
                  </span>
                </label>
              </div>

              {/* Or Paste text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Or Paste Agreement Clauses
                </label>
                <textarea 
                  value={pasteText}
                  onChange={(e) => { setPasteText(e.target.value); setFile(null); }}
                  placeholder="Paste special conditions, bond clauses, or full agreement text here..."
                  rows={4}
                  className="w-full text-xs p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono text-slate-800"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {error}
                </div>
              )}

              <button
                onClick={handleAudit}
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing with AWS Textract & Comprehend...</span>
                  </>
                ) : (
                  <>
                    <span>Run NSW Tenancy Compliance Audit</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          ) : (
            /* Results View */
            <div className="space-y-5">
              {/* Risk Level Banner */}
              {(() => {
                const badge = getRiskBadge(result.risk_level);
                const Icon = badge.icon;
                return (
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${badge.bg}`}>
                    <div className="flex items-center gap-3">
                      <Icon className="w-7 h-7 shrink-0" />
                      <div>
                        <h3 className="font-extrabold text-sm">{badge.text}</h3>
                        <p className="text-xs opacity-90">Risk Score: {result.risk_score} / 100</p>
                      </div>
                    </div>
                    {result.bond_weeks_ratio && (
                      <div className="text-right">
                        <span className="text-xs font-semibold block">Bond Ratio</span>
                        <span className="text-sm font-extrabold">{result.bond_weeks_ratio}x weekly rent</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Extracted Key Facts */}
              {result.extracted_clauses_summary.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {result.weekly_rent && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <span className="text-[11px] text-slate-500 font-medium block">Weekly Rent</span>
                      <span className="text-sm font-extrabold text-slate-800">${result.weekly_rent}</span>
                    </div>
                  )}
                  {result.bond_amount && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <span className="text-[11px] text-slate-500 font-medium block">Stated Bond</span>
                      <span className="text-sm font-extrabold text-slate-800">${result.bond_amount}</span>
                    </div>
                  )}
                  {result.lease_term_months && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <span className="text-[11px] text-slate-500 font-medium block">Lease Term</span>
                      <span className="text-sm font-extrabold text-slate-800">{result.lease_term_months} Months</span>
                    </div>
                  )}
                </div>
              )}

              {/* Red Flags List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  <span>Flagged Clauses & Legal Recommendations ({result.red_flags.length})</span>
                </h4>

                {result.red_flags.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>No statutory red flags detected! Agreement aligns with standard NSW Fair Trading terms.</span>
                  </div>
                ) : (
                  result.red_flags.map((rf, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${rf.severity === 'HIGH' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                          {rf.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {rf.category}
                        </span>
                      </div>
                      <p className="text-xs font-mono bg-slate-50 p-2 rounded-lg text-slate-700 border border-slate-100">
                        "{rf.clause_excerpt}"
                      </p>
                      <div className="text-[11px] text-indigo-700 font-semibold">
                        📜 {rf.nsw_legislation_reference}
                      </div>
                      <div className="text-[11px] text-slate-600 bg-amber-50/60 p-2 rounded-lg border border-amber-100/60">
                        💡 <strong>Action:</strong> {rf.recommended_action}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reset button */}
              <button
                onClick={() => { setResult(null); setFile(null); setPasteText(''); }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors"
              >
                Scan Another Agreement
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
