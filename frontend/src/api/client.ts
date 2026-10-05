const API_ORIGIN = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
const BASE_URL = !API_ORIGIN ? '/api' : (API_ORIGIN.endsWith('/api') ? API_ORIGIN : `${API_ORIGIN.replace(/\/$/, '')}/api`);

export interface DestinationHub {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  hub_type: string;
}

export interface IsochroneSuburb {
  suburb: string;
  latitude: number;
  longitude: number;
  duration_minutes: number;
  transit_mode: string;
  transfers: number;
  peak_frequency_mins: number;
}

export interface IsochroneResponse {
  hub: DestinationHub;
  max_minutes: number;
  suburbs_within_reach: IsochroneSuburb[];
}

export interface Property {
  id: string;
  title: string;
  suburb: string;
  bedrooms: number;
  bathrooms: number;
  weekly_rent: number;
  address: string;
  latitude: number;
  longitude: number;
  distance_to_beach_km: number;
  available_date: string;
  description: string;
  photo_url: string;
  parking_spaces?: number;
  pet_friendly?: boolean;
  has_air_con?: boolean;
  inspection_time?: string;
  is_real_listing?: boolean;
  external_url?: string;
  image_urls?: string[];
  features_list?: string[];
  agency_name?: string;
  agency_logo?: string;
  agent_name?: string;
  agent_photo?: string;
  agent_phone?: string;
  property_type?: string;
  commute_duration_minutes?: number | null;
  transit_mode?: string | null;
  transfers?: number | null;
  estimated_opal_fare?: number | null;
  route_summary?: string | null;
}

export interface Commute {
  origin_suburb: string;
  destination_cbd_hub: string;
  transit_mode: string;
  duration_minutes: number;
  peak_frequency_mins: number;
  transfers?: number;
  estimated_opal_fare?: number;
  route_summary?: string;
}

export interface AgentAction {
  action_type: string;
  data: Record<string, any>;
}

export interface ChatResponse {
  reply: string;
  actions: AgentAction[];
  latency_seconds?: number;
  agent_type?: 'standard' | 'deep_agent';
}

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  auth_provider?: string;
  is_admin?: boolean;
  created_at?: string;
  last_login_at?: string;
  workplace_hub?: string;
  max_commute_mins?: number;
  max_weekly_rent?: number;
  min_bedrooms?: number;
  has_pets?: boolean;
  needs_parking?: boolean;
  lifestyle_vibes?: string[];
  preferred_transit_modes?: string[];
  kai_verbosity?: 'concise' | 'balanced' | 'detailed';
}

export interface AuthResponse {
  token: string;
  user: User;
  is_admin: boolean;
}

export interface AdminOverview {
  range: string;
  include_admins: boolean;
  total_users: number;
  google_users: number;
  legacy_users: number;
  new_signups: number;
  dau: number;
  wau: number;
  chat_sessions: number;
  user_messages: number;
  saves: number;
  requests: number;
  error_rate: number;
  signups_over_time: Array<{ bucket: string; signups: number }>;
  active_users_over_time: Array<{ bucket: string; active_users: number }>;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  auth_provider?: string;
  is_admin: boolean;
  created_at?: string;
  last_login_at?: string;
  last_active_at?: string;
  session_count: number;
  message_count: number;
  saved_count: number;
}

export interface AdminUserDetail {
  profile: User;
  saved_properties: Array<{
    id: string;
    title: string;
    suburb: string;
    weekly_rent: number;
    bedrooms: number;
    saved_at?: string;
  }>;
  sessions: Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
  }>;
}

export interface AdminSessionTranscript {
  session: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    created_at: string;
  }>;
}

export interface AdminChatsAnalytics {
  range: string;
  total_sessions: number;
  total_user_messages: number;
  avg_messages_per_session: number;
  sessions_over_time: Array<{ bucket: string; sessions: number }>;
  messages_over_time: Array<{ bucket: string; user_messages: number; model_messages: number }>;
  most_active_users: Array<{
    id: string;
    username: string;
    email?: string;
    avatar_url?: string;
    user_messages: number;
    sessions: number;
  }>;
  recent_prompts: Array<{
    id: string;
    content: string;
    created_at: string;
    session_id: string;
    session_title: string;
    user_id?: string;
    username?: string;
  }>;
}

export interface AdminSavedAnalytics {
  range: string;
  total_saves: number;
  unique_savers: number;
  top_properties: Array<{
    id: string;
    title: string;
    suburb: string;
    weekly_rent: number;
    bedrooms: number;
    saves: number;
  }>;
  top_suburbs: Array<{
    suburb: string;
    saves: number;
    avg_rent: number;
  }>;
  saves_over_time: Array<{ bucket: string; saves: number }>;
}

export interface AdminHealthAnalytics {
  range: string;
  total_requests: number;
  server_errors: number;
  error_rate: number;
  p50_ms: number;
  p95_ms: number;
  retention_days: number;
  requests_over_time: Array<{
    bucket: string;
    requests: number;
    errors: number;
    client_errors: number;
    avg_latency_ms: number;
  }>;
  endpoints: Array<{
    endpoint: string;
    requests: number;
    errors: number;
    error_rate: number;
    p50_ms: number;
    p95_ms: number;
  }>;
  external_services: Array<{
    service: string;
    calls: number;
    failures: number;
    avg_latency_ms: number;
    tokens_in?: number;
    tokens_out?: number;
  }>;
  external_over_time: Array<{
    bucket: string;
    service: string;
    calls: number;
  }>;
  recent_errors: Array<{
    ts: string;
    kind: string;
    source: string;
    detail: string;
  }>;
}

export interface UserProfileUpdate {
  workplace_hub?: string;
  max_commute_mins?: number;
  max_weekly_rent?: number;
  min_bedrooms?: number;
  has_pets?: boolean;
  needs_parking?: boolean;
  lifestyle_vibes?: string[];
  preferred_transit_modes?: string[];
  kai_verbosity?: 'concise' | 'balanced' | 'detailed';
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface PropertyFilterParams {
  suburb?: string;
  property_ids?: string[];
  max_rent?: number;
  min_bedrooms?: number;
  destination_hub?: string;
  max_commute_mins?: number;
  keyword?: string;
  property_type?: string;
  pet_friendly?: boolean;
  needs_parking?: boolean;
  has_air_con?: boolean;
  circle?: string;
  polygon?: string;
}

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const userId = localStorage.getItem('user_id');
  if (userId) {
    headers['user-id'] = userId;
  }
  return headers;
};

export const api = {
  loginWithGoogle: async (credential: string): Promise<AuthResponse> => {
    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Authentication failed');
    }
    return await res.json();
  },

  getMe: async (): Promise<{ user: User; is_admin: boolean }> => {
    const res = await fetch(`${BASE_URL}/auth/me`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Not authenticated');
    return await res.json();
  },

  getHubs: async (): Promise<DestinationHub[]> => {
    const res = await fetch(`${BASE_URL}/hubs`);
    const data = await res.json();
    return data.hubs;
  },

  getIsochrones: async (destinationHub: string, maxMinutes: number = 60): Promise<IsochroneResponse> => {
    const res = await fetch(`${BASE_URL}/isochrones?destination_hub=${encodeURIComponent(destinationHub)}&max_minutes=${maxMinutes}`);
    return await res.json();
  },

  getProperties: async (filters?: PropertyFilterParams): Promise<Property[]> => {
    let url = `${BASE_URL}/properties`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.suburb) params.append('suburbs', filters.suburb);
      if (filters.property_ids && filters.property_ids.length > 0) {
        filters.property_ids.forEach(id => params.append('property_ids', id));
      }
      if (filters.max_rent !== undefined && filters.max_rent !== null) params.append('max_rent', filters.max_rent.toString());
      if (filters.min_bedrooms !== undefined && filters.min_bedrooms !== null) params.append('min_bedrooms', filters.min_bedrooms.toString());
      if (filters.destination_hub) params.append('destination_hub', filters.destination_hub);
      if (filters.max_commute_mins !== undefined && filters.max_commute_mins !== null) params.append('max_commute_mins', filters.max_commute_mins.toString());
      if (filters.keyword) params.append('keyword', filters.keyword);
      if (filters.property_type) params.append('property_type', filters.property_type);
      if (filters.pet_friendly !== undefined && filters.pet_friendly !== null) params.append('pet_friendly', filters.pet_friendly ? 'true' : 'false');
      if (filters.needs_parking !== undefined && filters.needs_parking !== null) params.append('needs_parking', filters.needs_parking ? 'true' : 'false');
      if (filters.has_air_con !== undefined && filters.has_air_con !== null) params.append('has_air_con', filters.has_air_con ? 'true' : 'false');
      if (filters.circle) params.append('circle', filters.circle);
      if (filters.polygon) params.append('polygon', filters.polygon);
      
      const query = params.toString();
      if (query) {
        url += `?${query}`;
      }
    }
    const res = await fetch(url, { headers: getHeaders() });
    const data = await res.json();
    return data.results;
  },

  getProfile: async (_userId?: string): Promise<User> => {
    const res = await fetch(`${BASE_URL}/user/profile`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch user profile');
    return await res.json();
  },

  updateProfile: async (_userId: string | undefined, profile: UserProfileUpdate): Promise<User> => {
    const res = await fetch(`${BASE_URL}/user/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(profile)
    });
    if (!res.ok) throw new Error('Failed to update user profile');
    return await res.json();
  },

  // Admin insights endpoints
  getAdminOverview: async (range: string = '7d', includeAdmins: boolean = false): Promise<AdminOverview> => {
    const res = await fetch(`${BASE_URL}/admin/overview?range=${range}&include_admins=${includeAdmins}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin overview');
    return await res.json();
  },

  getAdminUsers: async (includeAdmins: boolean = false): Promise<AdminUserSummary[]> => {
    const res = await fetch(`${BASE_URL}/admin/users?include_admins=${includeAdmins}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin users');
    return await res.json();
  },

  getAdminUserDetail: async (userId: string): Promise<AdminUserDetail> => {
    const res = await fetch(`${BASE_URL}/admin/users/${encodeURIComponent(userId)}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin user detail');
    return await res.json();
  },

  getAdminSessionTranscript: async (userId: string, sessionId: string): Promise<AdminSessionTranscript> => {
    const res = await fetch(`${BASE_URL}/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}/messages`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin session transcript');
    return await res.json();
  },

  getAdminChatTranscript: async (sessionId: string, userId?: string): Promise<AdminSessionTranscript> => {
    const url = userId
      ? `${BASE_URL}/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}/messages`
      : `${BASE_URL}/admin/sessions/${encodeURIComponent(sessionId)}/messages`;
    const res = await fetch(url, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch chat transcript');
    return await res.json();
  },

  getAdminChats: async (range: string = '7d', includeAdmins: boolean = false): Promise<AdminChatsAnalytics> => {
    const res = await fetch(`${BASE_URL}/admin/chats?range=${range}&include_admins=${includeAdmins}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin chats analytics');
    return await res.json();
  },

  getAdminSaved: async (range: string = '7d', includeAdmins: boolean = false): Promise<AdminSavedAnalytics> => {
    const res = await fetch(`${BASE_URL}/admin/saved?range=${range}&include_admins=${includeAdmins}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin saved analytics');
    return await res.json();
  },

  getAdminHealth: async (range: string = '7d', includeAdmins: boolean = false): Promise<AdminHealthAnalytics> => {
    const res = await fetch(`${BASE_URL}/admin/health?range=${range}&include_admins=${includeAdmins}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin health analytics');
    return await res.json();
  },

  syncListings: async (): Promise<{ synced_count: number; message: string; source: string }> => {
    const res = await fetch(`${BASE_URL}/sync/listings`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to sync listings');
    return await res.json();
  },

  getProperty: async (propertyId: string, destinationHub?: string): Promise<Property> => {
    let url = `${BASE_URL}/properties/${encodeURIComponent(propertyId)}`;
    if (destinationHub) {
      url += `?destination_hub=${encodeURIComponent(destinationHub)}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to fetch property: ${res.statusText}`);
    }
    return await res.json();
  },

  getSavedProperties: async (): Promise<Property[]> => {
    try {
      const res = await fetch(`${BASE_URL}/properties/saved`, { headers: getHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  syncSavedProperties: async (propertyIds: string[] = []): Promise<Property[]> => {
    try {
      const res = await fetch(`${BASE_URL}/properties/saved/sync`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ property_ids: propertyIds })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  saveProperty: async (propertyId: string): Promise<void> => {
    await fetch(`${BASE_URL}/properties/saved/${propertyId}`, { method: 'POST', headers: getHeaders() });
  },

  unsaveProperty: async (propertyId: string): Promise<void> => {
    await fetch(`${BASE_URL}/properties/saved/${propertyId}`, { method: 'DELETE', headers: getHeaders() });
  },

  getCommute: async (origin: string, dest: string): Promise<Commute[]> => {
    const res = await fetch(`${BASE_URL}/commute?origin_suburb=${encodeURIComponent(origin)}&destination_cbd_hub=${encodeURIComponent(dest)}`);
    const data = await res.json();
    return data.commutes;
  },

  getChatSessions: async (): Promise<ChatSession[]> => {
    const res = await fetch(`${BASE_URL}/chat/sessions`, { headers: getHeaders() });
    const data = await res.json();
    return data.sessions;
  },

  getChatMessages: async (sessionId: string): Promise<ChatMessage[]> => {
    const res = await fetch(`${BASE_URL}/chat/sessions/${sessionId}/messages`, { headers: getHeaders() });
    const data = await res.json();
    return data.messages;
  },

  deleteChatSession: async (sessionId: string): Promise<void> => {
    await fetch(`${BASE_URL}/chat/sessions/${sessionId}`, { method: 'DELETE', headers: getHeaders() });
  },

  updateChatSession: async (sessionId: string, title: string): Promise<ChatSession> => {
    const res = await fetch(`${BASE_URL}/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ title })
    });
    if (!res.ok) {
      throw new Error('Failed to update session title');
    }
    return await res.json();
  },

  sendChatMessage: async (message: string, history: any[] = [], sessionId?: string): Promise<ChatResponse> => {
    const userId = localStorage.getItem('user_id');
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message, history, session_id: sessionId, user_id: userId })
    });
    return await res.json();
  },

  sendDeepChatMessage: async (message: string, history: any[] = [], sessionId?: string): Promise<ChatResponse> => {
    const userId = localStorage.getItem('user_id');
    const res = await fetch(`${BASE_URL}/chat/deep`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message, history, session_id: sessionId, user_id: userId })
    });
    return await res.json();
  },

  streamDeepChatMessage: async (
    message: string, 
    history: any[] = [], 
    sessionId: string | undefined,
    callbacks: DeepAgentStreamCallbacks
  ): Promise<void> => {
    const userId = localStorage.getItem('user_id');
    const response = await fetch(`${BASE_URL}/chat/deep/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getHeaders()
      },
      body: JSON.stringify({ message, history, session_id: sessionId, user_id: userId })
    });

    if (!response.ok) {
      const errText = await response.text();
      callbacks.onError?.({ message: `HTTP ${response.status}: ${errText}` });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError?.({ message: "No response stream available." });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        if (!block.trim()) continue;
        let eventType = "message";
        let dataStr = "";

        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataStr = line.slice(6).trim();
          }
        }

        if (!dataStr) continue;

        try {
          const payload = JSON.parse(dataStr);
          if (eventType === "status") {
            callbacks.onStatus?.(payload.stage, payload.label);
          } else if (eventType === "step") {
            callbacks.onStep?.(payload);
          } else if (eventType === "step_done") {
            callbacks.onStepDone?.(payload.id, payload.name);
          } else if (eventType === "action") {
            callbacks.onAction?.(payload);
          } else if (eventType === "chunk") {
            callbacks.onChunk?.(payload.text);
          } else if (eventType === "done") {
            callbacks.onDone?.(payload);
          } else if (eventType === "error") {
            callbacks.onError?.(payload);
          }
        } catch (e) {
          console.error("Failed to parse SSE event:", e, block);
        }
      }
    }
  }
};

export interface DeepAgentStep {
  id: string;
  type: 'subagent' | 'plan' | 'tool';
  name: string;
  label: string;
  detail?: string;
  status: 'running' | 'completed' | 'failed';
}

export interface DeepAgentStreamCallbacks {
  onStatus?: (stage: string, label: string) => void;
  onStep?: (step: DeepAgentStep) => void;
  onStepDone?: (id: string, name: string) => void;
  onAction?: (action: AgentAction) => void;
  onChunk?: (text: string) => void;
  onDone?: (result: { reply: string; actions: AgentAction[]; latency_seconds: number; steps?: DeepAgentStep[] }) => void;
  onError?: (err: { message: string; latency_seconds?: number; steps?: DeepAgentStep[]; actions?: AgentAction[] }) => void;
}
