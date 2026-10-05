import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  MessageSquare,
  Bookmark,
  Activity,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
  Search,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  api,
  type AdminOverview,
  type AdminUserSummary,
  type AdminUserDetail,
  type AdminSessionTranscript,
  type AdminChatsAnalytics,
  type AdminSavedAnalytics,
  type AdminHealthAnalytics
} from '../api/client';
import { cn } from '../lib/utils';

interface AdminPanelProps {
  onBack: () => void;
  onSelectProperty?: (propertyId: string) => void;
}

type AdminTab = 'overview' | 'users' | 'chats' | 'saved' | 'health';
type TimeRange = '24h' | '7d' | '30d' | 'all';

function formatTimestamp(isoStr?: string): string {
  if (!isoStr) return 'Never';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('en-AU', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatBucketDate(bucket?: string): string {
  if (!bucket) return '';
  // Format YYYY-MM-DD or YYYY-MM-DD HH:MM
  if (bucket.includes(' ')) {
    const parts = bucket.split(' ');
    const d = new Date(parts[0]);
    return `${d.getDate()}/${d.getMonth() + 1} ${parts[1]}`;
  }
  const d = new Date(bucket);
  if (isNaN(d.getTime())) return bucket;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function AdminPanel({ onBack, onSelectProperty }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [range, setRange] = useState<TimeRange>('7d');
  const [includeAdmins, setIncludeAdmins] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tab Data States
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [chats, setChats] = useState<AdminChatsAnalytics | null>(null);
  const [saved, setSaved] = useState<AdminSavedAnalytics | null>(null);
  const [health, setHealth] = useState<AdminHealthAnalytics | null>(null);

  // Search in users tab
  const [userSearch, setUserSearch] = useState<string>('');

  // User drilldown modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState<boolean>(false);

  // Chat transcript view
  const [transcriptSessionId, setTranscriptSessionId] = useState<string | null>(null);
  const [transcriptData, setTranscriptData] = useState<AdminSessionTranscript | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState<boolean>(false);

  const fetchData = useCallback(async (tabToLoad: AdminTab = activeTab) => {
    setError(null);
    try {
      if (tabToLoad === 'overview') {
        const data = await api.getAdminOverview(range, includeAdmins);
        setOverview(data);
      } else if (tabToLoad === 'users') {
        const data = await api.getAdminUsers(includeAdmins);
        setUsers(data);
      } else if (tabToLoad === 'chats') {
        const data = await api.getAdminChats(range, includeAdmins);
        setChats(data);
      } else if (tabToLoad === 'saved') {
        const data = await api.getAdminSaved(range, includeAdmins);
        setSaved(data);
      } else if (tabToLoad === 'health') {
        const data = await api.getAdminHealth(range, includeAdmins);
        setHealth(data);
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setError(err?.message || 'Failed to fetch admin metrics. Please ensure you are authenticated as an admin.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, range, includeAdmins]);

  useEffect(() => {
    setLoading(true);
    fetchData(activeTab);
  }, [activeTab, range, includeAdmins, fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(activeTab);
  };

  const handleOpenUserDetail = async (userId: string) => {
    setSelectedUserId(userId);
    setLoadingUserDetail(true);
    try {
      const data = await api.getAdminUserDetail(userId);
      setUserDetail(data);
    } catch (err) {
      console.error('Failed to load user details:', err);
    } finally {
      setLoadingUserDetail(false);
    }
  };

  const handleOpenTranscript = async (sessionId: string) => {
    setTranscriptSessionId(sessionId);
    setLoadingTranscript(true);
    try {
      const data = await api.getAdminChatTranscript(sessionId);
      setTranscriptData(data);
    } catch (err) {
      console.error('Failed to load chat transcript:', err);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900 text-slate-100 flex flex-col font-sans select-text">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700 cursor-pointer"
            title="Return to explore map"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-400" />
            <span>Back to Map</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                SydLiving Admin Insights
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/70 text-blue-300 border border-blue-700/60 uppercase tracking-wide">
                  Internal
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Global Controls: Time Range & Admin Toggle & Refresh */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700 text-xs">
            {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer uppercase text-[11px]",
                  range === r
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Toggle: Include Admin Activity */}
          <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800">
            <input
              type="checkbox"
              checked={includeAdmins}
              onChange={(e) => setIncludeAdmins(e.target.checked)}
              className="rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-[11px] font-medium">Include Admins</span>
          </label>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh metrics"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin text-blue-400")} />
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-2">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
              activeTab === 'overview'
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
              activeTab === 'users'
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users</span>
          </button>

          <button
            onClick={() => setActiveTab('chats')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
              activeTab === 'chats'
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chats & Kai</span>
          </button>

          <button
            onClick={() => setActiveTab('saved')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
              activeTab === 'saved'
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            )}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Shortlists</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
              activeTab === 'health'
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>API & System Health</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-xs">Loading admin metrics...</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && overview && (
              <div className="space-y-6">
                {/* Metric Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Users</p>
                    <p className="text-2xl font-bold text-white mt-1">{overview.total_users}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {overview.google_users} Google / {overview.legacy_users} Legacy
                    </p>
                  </div>

                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">New Signups</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{overview.new_signups}</p>
                    <p className="text-[10px] text-slate-400 mt-1">In selected range</p>
                  </div>

                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Users</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">{overview.dau}</p>
                    <p className="text-[10px] text-slate-400 mt-1">DAU / WAU: {overview.wau}</p>
                  </div>

                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Chat Sessions</p>
                    <p className="text-2xl font-bold text-sky-400 mt-1">{overview.chat_sessions}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{overview.user_messages} User Messages</p>
                  </div>

                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Saved Properties</p>
                    <p className="text-2xl font-bold text-rose-400 mt-1">{overview.saves}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Total bookmarks</p>
                  </div>

                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">API Requests</p>
                    <p className="text-2xl font-bold text-violet-400 mt-1">{overview.requests}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Err Rate: {(overview.error_rate * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Signups Chart */}
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      Signups Over Time
                    </h3>
                    <div className="h-56 sm:h-64 w-full">
                      {overview.signups_over_time.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={overview.signups_over_time}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                            <XAxis
                              dataKey="bucket"
                              tickFormatter={formatBucketDate}
                              stroke="#64748b"
                              fontSize={11}
                            />
                            <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                              labelFormatter={(label) => `Date: ${label}`}
                            />
                            <Bar dataKey="signups" fill="#10b981" radius={[4, 4, 0, 0]} name="Signups" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-500">
                          No signups recorded in this range.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active Users Chart */}
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      Active Users Over Time
                    </h3>
                    <div className="h-56 sm:h-64 w-full">
                      {overview.active_users_over_time.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={overview.active_users_over_time}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                            <XAxis
                              dataKey="bucket"
                              tickFormatter={formatBucketDate}
                              stroke="#64748b"
                              fontSize={11}
                            />
                            <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                              labelFormatter={(label) => `Date: ${label}`}
                            />
                            <Line
                              type="monotone"
                              dataKey="active_users"
                              stroke="#2563eb"
                              strokeWidth={2}
                              dot={{ r: 3, fill: '#3b82f6' }}
                              name="Active Users"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-500">
                          No active user logs in this range.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-800/60 p-3 sm:p-4 rounded-xl border border-slate-700/80">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      User Directory ({filteredUsers.length})
                    </span>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-800/40">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Provider</th>
                        <th className="py-3 px-4">Signed Up</th>
                        <th className="py-3 px-4">Last Active</th>
                        <th className="py-3 px-4 text-center">Sessions</th>
                        <th className="py-3 px-4 text-center">Msgs</th>
                        <th className="py-3 px-4 text-center">Saves</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                            No users matched your query.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-800/60 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                {u.avatar_url ? (
                                  <img
                                    src={u.avatar_url}
                                    alt={u.username}
                                    className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-[11px] shrink-0">
                                    {(u.username || 'U')[0].toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    <span className="truncate">{u.username}</span>
                                    {u.is_admin && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-600/30 text-blue-300 border border-blue-500/40">
                                        ADMIN
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 truncate">{u.email || u.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-semibold uppercase",
                                  u.auth_provider === 'google'
                                    ? "bg-emerald-950/70 text-emerald-300 border border-emerald-800/60"
                                    : "bg-slate-700/60 text-slate-300 border border-slate-600"
                                )}
                              >
                                {u.auth_provider || 'legacy'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                              {formatTimestamp(u.created_at)}
                            </td>
                            <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                              {formatTimestamp(u.last_active_at || u.last_login_at)}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-sky-400">{u.session_count}</td>
                            <td className="py-3 px-4 text-center font-bold text-blue-400">{u.message_count}</td>
                            <td className="py-3 px-4 text-center font-bold text-rose-400">{u.saved_count}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleOpenUserDetail(u.id)}
                                className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-semibold border border-blue-500/30 transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                Inspect
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CHATS TAB */}
            {activeTab === 'chats' && chats && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-4">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Chat Sessions</p>
                    <p className="text-2xl font-bold text-sky-400 mt-1">{chats.total_sessions}</p>
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-4">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">User Messages</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">{chats.total_user_messages}</p>
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-4">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Avg Messages / Session</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{chats.avg_messages_per_session.toFixed(1)}</p>
                  </div>
                </div>

                {/* Messages Volume Chart */}
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-sky-400" />
                    Messages Volume
                  </h3>
                  <div className="h-56 sm:h-64 w-full">
                    {chats.messages_over_time.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chats.messages_over_time}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                          <XAxis dataKey="bucket" tickFormatter={formatBucketDate} stroke="#64748b" fontSize={11} />
                          <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                          />
                          <Bar dataKey="user_messages" fill="#3b82f6" radius={[4, 4, 0, 0]} name="User Messages" />
                          <Bar dataKey="model_messages" fill="#0284c7" radius={[4, 4, 0, 0]} name="Kai Responses" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500">
                        No messages logged in this range.
                      </div>
                    )}
                  </div>
                </div>

                {/* Most Active Chatters & Recent Prompts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Most Active Chat Users */}
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      Top Active Chatters
                    </h3>
                    <div className="divide-y divide-slate-700/80">
                      {chats.most_active_users.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-500">No active chatter activity.</p>
                      ) : (
                        chats.most_active_users.map((c) => (
                          <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                {(c.username || 'U')[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-white truncate">{c.username}</p>
                                <p className="text-[10px] text-slate-400 truncate">{c.email || c.id}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-blue-400">{c.user_messages} msgs</span>
                              <span className="text-[10px] text-slate-400 block">{c.sessions} sessions</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Recent User Prompts */}
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      Recent Prompts to Kai
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {chats.recent_prompts.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-500">No prompts recorded.</p>
                      ) : (
                        chats.recent_prompts.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleOpenTranscript(p.session_id)}
                            className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer text-xs group"
                          >
                            <p className="text-slate-200 font-medium line-clamp-2 group-hover:text-blue-300">
                              "{p.content}"
                            </p>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                              <span>By {p.username || 'Anonymous'}</span>
                              <span>{formatTimestamp(p.created_at)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SAVED / SHORTLIST TAB */}
            {activeTab === 'saved' && saved && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-4">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Property Saves</p>
                    <p className="text-2xl font-bold text-rose-400 mt-1">{saved.total_saves}</p>
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-4">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Unique Savers</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">{saved.unique_savers}</p>
                  </div>
                </div>

                {/* Saves Over Time */}
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-rose-400" />
                    Saves Over Time
                  </h3>
                  <div className="h-56 sm:h-64 w-full">
                    {saved.saves_over_time.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={saved.saves_over_time}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                          <XAxis dataKey="bucket" tickFormatter={formatBucketDate} stroke="#64748b" fontSize={11} />
                          <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                          />
                          <Bar dataKey="saves" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Saves" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500">
                        No property saves in this range.
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Properties & Top Suburbs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Properties */}
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-rose-400" />
                      Most Saved Properties
                    </h3>
                    <div className="divide-y divide-slate-700/80">
                      {saved.top_properties.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-500">No properties saved yet.</p>
                      ) : (
                        saved.top_properties.map((p) => (
                          <div key={p.id} className="py-3 flex items-center justify-between text-xs group">
                            <div className="min-w-0 pr-3">
                              <p
                                onClick={() => onSelectProperty && onSelectProperty(p.id)}
                                className="font-bold text-white hover:text-blue-400 cursor-pointer truncate flex items-center gap-1.5"
                              >
                                {p.title}
                                <ExternalLink className="w-3 h-3 text-slate-500 inline shrink-0" />
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {p.suburb} • {p.bedrooms} bed • ${p.weekly_rent}/wk
                              </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-rose-950/70 text-rose-300 font-bold border border-rose-800/60 text-xs shrink-0">
                              {p.saves} saves
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Top Suburbs */}
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                      Top Suburbs by Interest
                    </h3>
                    <div className="divide-y divide-slate-700/80">
                      {saved.top_suburbs.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-500">No suburb interest recorded.</p>
                      ) : (
                        saved.top_suburbs.map((s) => (
                          <div key={s.suburb} className="py-3 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-white">{s.suburb}</p>
                              <p className="text-[10px] text-slate-400">Avg Rent: ${Math.round(s.avg_rent)}/wk</p>
                            </div>
                            <span className="font-bold text-blue-400">{s.saves} saves</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* API & HEALTH TAB */}
            {activeTab === 'health' && health && (
              <div className="space-y-6">
                {/* Top Health KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Requests</p>
                    <p className="text-2xl font-bold text-white mt-1">{health.total_requests}</p>
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Server Errors</p>
                    <p className={cn("text-2xl font-bold mt-1", health.server_errors > 0 ? "text-rose-400" : "text-emerald-400")}>
                      {health.server_errors}
                    </p>
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Error Rate</p>
                    <p className={cn("text-2xl font-bold mt-1", health.error_rate > 0.05 ? "text-rose-400" : "text-emerald-400")}>
                      {(health.error_rate * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">p50 Latency</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">{health.p50_ms.toFixed(0)} ms</p>
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">p95 Latency</p>
                    <p className="text-2xl font-bold text-indigo-400 mt-1">{health.p95_ms.toFixed(0)} ms</p>
                  </div>
                </div>

                {/* Request Volume & Latency Trend */}
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Request Volume & Latency
                  </h3>
                  <div className="h-60 sm:h-72 w-full">
                    {health.requests_over_time.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={health.requests_over_time}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                          <XAxis dataKey="bucket" tickFormatter={formatBucketDate} stroke="#64748b" fontSize={11} />
                          <YAxis yAxisId="left" stroke="#64748b" fontSize={11} allowDecimals={false} />
                          <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                          />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="requests"
                            stroke="#2563eb"
                            strokeWidth={2}
                            name="Requests"
                          />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="errors"
                            stroke="#f43f5e"
                            strokeWidth={2}
                            name="5xx Errors"
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="avg_latency_ms"
                            stroke="#38bdf8"
                            strokeDasharray="4 4"
                            name="Avg Latency (ms)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500">
                        No requests recorded in this range.
                      </div>
                    )}
                  </div>
                </div>

                {/* External Services & Top Endpoints */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* External APIs Breakdown */}
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-sky-400" />
                      External Integrations (LLM & Maps)
                    </h3>
                    <div className="divide-y divide-slate-700/80">
                      {health.external_services.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-500">No external API calls logged.</p>
                      ) : (
                        health.external_services.map((s) => (
                          <div key={s.service} className="py-3 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-white capitalize">{s.service}</p>
                              <p className="text-[10px] text-slate-400">
                                Latency: {s.avg_latency_ms.toFixed(0)}ms
                                {s.tokens_in ? ` • Tokens In: ${s.tokens_in.toLocaleString()}` : ''}
                                {s.tokens_out ? ` • Tokens Out: ${s.tokens_out.toLocaleString()}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-blue-400">{s.calls} calls</span>
                              {s.failures > 0 && (
                                <span className="text-[10px] text-rose-400 block font-semibold">
                                  {s.failures} failed
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Top Endpoints Table */}
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      Top Endpoints
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-700 text-slate-400 text-[10px] uppercase">
                            <th className="py-2">Endpoint</th>
                            <th className="py-2 text-center">Reqs</th>
                            <th className="py-2 text-center">p50</th>
                            <th className="py-2 text-center">p95</th>
                            <th className="py-2 text-right">Error %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {health.endpoints.slice(0, 8).map((ep) => (
                            <tr key={ep.endpoint}>
                              <td className="py-2 font-mono text-[11px] text-slate-200 truncate max-w-[180px]">
                                {ep.endpoint}
                              </td>
                              <td className="py-2 text-center font-bold text-white">{ep.requests}</td>
                              <td className="py-2 text-center text-slate-400">{ep.p50_ms.toFixed(0)}ms</td>
                              <td className="py-2 text-center text-slate-400">{ep.p95_ms.toFixed(0)}ms</td>
                              <td className={cn("py-2 text-right font-semibold", ep.error_rate > 0 ? "text-rose-400" : "text-emerald-400")}>
                                {(ep.error_rate * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Recent Errors Log */}
                {health.recent_errors.length > 0 && (
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
                    <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      Recent Errors Log
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {health.recent_errors.map((err, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/50 text-xs">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-rose-300">
                            <span>{err.source} • {err.kind}</span>
                            <span className="text-slate-500 font-normal">{formatTimestamp(err.ts)}</span>
                          </div>
                          <p className="text-rose-200/90 font-mono text-[11px] mt-1 break-all">{err.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* USER DETAIL INSPECTOR MODAL */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white">User Inspector</h2>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {loadingUserDetail || !userDetail ? (
                <div className="py-12 flex justify-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  {/* User Profile Summary */}
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                    {userDetail.profile.avatar_url ? (
                      <img
                        src={userDetail.profile.avatar_url}
                        alt={userDetail.profile.username}
                        className="w-12 h-12 rounded-full border border-slate-600 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-lg flex items-center justify-center">
                        {(userDetail.profile.username || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-base text-white">{userDetail.profile.username}</h3>
                      <p className="text-xs text-slate-400">{userDetail.profile.email || userDetail.profile.id}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                          Hub: {userDetail.profile.workplace_hub || 'Not set'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                          Max Rent: ${userDetail.profile.max_weekly_rent || 0}/wk
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                          Bedrooms: {userDetail.profile.min_bedrooms || 0}+
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Saved Properties */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-rose-400" />
                      Saved Properties ({userDetail.saved_properties.length})
                    </h4>
                    {userDetail.saved_properties.length === 0 ? (
                      <p className="text-xs text-slate-500 p-3 bg-slate-800/30 rounded-lg">No saved properties.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {userDetail.saved_properties.map((p) => (
                          <div
                            key={p.id}
                            className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-semibold text-white">{p.title}</p>
                              <p className="text-[10px] text-slate-400">{p.suburb} • ${p.weekly_rent}/wk • {p.bedrooms} beds</p>
                            </div>
                            <span className="text-[10px] text-slate-500">{formatTimestamp(p.saved_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chat Sessions */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                      Chat Sessions ({userDetail.sessions.length})
                    </h4>
                    {userDetail.sessions.length === 0 ? (
                      <p className="text-xs text-slate-500 p-3 bg-slate-800/30 rounded-lg">No chat sessions.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {userDetail.sessions.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => handleOpenTranscript(s.id)}
                            className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 flex items-center justify-between text-xs hover:border-blue-500 transition-colors cursor-pointer group"
                          >
                            <div>
                              <p className="font-semibold text-white group-hover:text-blue-300">{s.title}</p>
                              <p className="text-[10px] text-slate-400">{s.message_count} messages</p>
                            </div>
                            <span className="text-blue-400 text-[11px] font-semibold flex items-center gap-0.5">
                              View Transcript
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHAT TRANSCRIPT MODAL */}
      {transcriptSessionId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold text-white truncate max-w-sm">
                  {transcriptData?.session.title || 'Chat Transcript'}
                </h2>
              </div>
              <button
                onClick={() => setTranscriptSessionId(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {loadingTranscript || !transcriptData ? (
                <div className="py-12 flex justify-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  {transcriptData.messages.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-8">No messages found in this session.</p>
                  ) : (
                    transcriptData.messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "p-3 rounded-xl text-xs space-y-1 max-w-[90%]",
                          m.role === 'user'
                            ? "ml-auto bg-blue-600 text-white"
                            : "mr-auto bg-slate-800 text-slate-200 border border-slate-700"
                        )}
                      >
                        <div className="flex items-center justify-between text-[10px] opacity-75">
                          <span className="font-bold uppercase tracking-wider">{m.role === 'user' ? 'User' : 'Kai'}</span>
                          <span>{formatTimestamp(m.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
