const BASE_URL = 'http://localhost:8000/api';

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
}

export interface Commute {
  origin_suburb: string;
  destination_cbd_hub: string;
  transit_mode: string;
  duration_minutes: number;
  peak_frequency_mins: number;
}

export interface AgentAction {
  action_type: string;
  data: Record<string, any>;
}

export interface ChatResponse {
  reply: string;
  actions: AgentAction[];
}

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  auth_provider?: string;
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

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const userId = localStorage.getItem('user_id');
  if (userId) {
    headers['user-id'] = userId;
  }
  return headers;
};

export const api = {
  login: async (username: string): Promise<User> => {
    const res = await fetch(`${BASE_URL}/auth/login?username=${encodeURIComponent(username)}`, { method: 'POST' });
    return await res.json();
  },

  loginWithGoogle: async (profile: { name: string, email?: string, avatar_url?: string }): Promise<User> => {
    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    return await res.json();
  },

  getProperties: async (filters?: { suburb?: string, max_rent?: number, min_bedrooms?: number, keyword?: string, property_type?: string, circle?: string, polygon?: string }): Promise<Property[]> => {
    let url = `${BASE_URL}/properties`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.suburb) params.append('suburbs', filters.suburb);
      if (filters.max_rent) params.append('max_rent', filters.max_rent.toString());
      if (filters.min_bedrooms) params.append('min_bedrooms', filters.min_bedrooms.toString());
      if (filters.keyword) params.append('keyword', filters.keyword);
      if (filters.property_type) params.append('property_type', filters.property_type);
      if (filters.circle) params.append('circle', filters.circle);
      if (filters.polygon) params.append('polygon', filters.polygon);
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
    }
    const res = await fetch(url, { headers: getHeaders() });
    const data = await res.json();
    return data.results;
  },

  getSavedProperties: async (): Promise<Property[]> => {
    const res = await fetch(`${BASE_URL}/properties/saved`, { headers: getHeaders() });
    return await res.json();
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

  sendChatMessage: async (message: string, history: any[] = [], sessionId?: string): Promise<ChatResponse> => {
    const userId = localStorage.getItem('user_id');
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message, history, session_id: sessionId, user_id: userId })
    });
    return await res.json();
  }
};
