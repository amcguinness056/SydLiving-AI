const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE_URL = API_ORIGIN.endsWith('/api') ? API_ORIGIN : `${API_ORIGIN.replace(/\/$/, '')}/api`;

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

export interface PropertyFilterParams {
  suburb?: string;
  max_rent?: number;
  min_bedrooms?: number;
  destination_hub?: string;
  max_commute_mins?: number;
  keyword?: string;
  property_type?: string;
  circle?: string;
  polygon?: string;
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
      if (filters.max_rent !== undefined && filters.max_rent !== null) params.append('max_rent', filters.max_rent.toString());
      if (filters.min_bedrooms !== undefined && filters.min_bedrooms !== null) params.append('min_bedrooms', filters.min_bedrooms.toString());
      if (filters.destination_hub) params.append('destination_hub', filters.destination_hub);
      if (filters.max_commute_mins !== undefined && filters.max_commute_mins !== null) params.append('max_commute_mins', filters.max_commute_mins.toString());
      if (filters.keyword) params.append('keyword', filters.keyword);
      if (filters.property_type) params.append('property_type', filters.property_type);
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
