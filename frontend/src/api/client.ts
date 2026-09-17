const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
  description?: string;
  is_domain_data?: boolean;
  vibe_score?: number;
}

export interface Commute {
  origin_suburb: string;
  destination_cbd_hub: string;
  transit_mode: string;
  duration_minutes: number;
  peak_frequency_mins: number;
  transfers?: number;
  is_live_data?: boolean;
}

export interface TradeoffOption {
  label: string; // "Cheapest" | "Fastest Commute" | "Best Overall"
  property: Property;
  commute_minutes: number;
  transit_mode: string;
  reasoning: string;
  badge_color: string;
}

export interface AgentAction {
  action_type: string;
  data: Record<string, any>;
}

export interface ChatResponse {
  reply: string;
  actions: AgentAction[];
  tradeoffs?: TradeoffOption[];
  session_preferences?: {
    max_rent?: number;
    min_bedrooms?: number;
    target_suburbs?: string[];
    preferred_cbd_hub?: string;
    vibe_query?: string;
  };
}

export const api = {
  getProperties: async (filters?: { suburb?: string, max_rent?: number, min_bedrooms?: number }): Promise<Property[]> => {
    let url = `${BASE_URL}/properties`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.suburb) params.append('suburbs', filters.suburb);
      if (filters.max_rent) params.append('max_rent', filters.max_rent.toString());
      if (filters.min_bedrooms) params.append('min_bedrooms', filters.min_bedrooms.toString());
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
    }
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
  },

  semanticSearch: async (vibe: string, max_rent?: number, min_bedrooms?: number): Promise<Property[]> => {
    const res = await fetch(`${BASE_URL}/properties/semantic-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vibe, max_rent, min_bedrooms })
    });
    const data = await res.json();
    return data.results || [];
  },

  getCommute: async (origin: string, dest: string): Promise<Commute[]> => {
    const res = await fetch(`${BASE_URL}/commute?origin_suburb=${encodeURIComponent(origin)}&destination_cbd_hub=${encodeURIComponent(dest)}`);
    const data = await res.json();
    return data.commutes || [];
  },

  sendChatMessage: async (message: string, history: any[] = [], sessionId: string = 'sydliving-session'): Promise<ChatResponse> => {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, history, session_id: sessionId })
    });
    return await res.json();
  },

  getSessionPreferences: async (sessionId: string = 'sydliving-session') => {
    const res = await fetch(`${BASE_URL}/session/preferences?session_id=${encodeURIComponent(sessionId)}`);
    return await res.json();
  },

  clearSessionPreferences: async (sessionId: string = 'sydliving-session') => {
    const res = await fetch(`${BASE_URL}/session/preferences?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  getFavorites: async (userId: string = 'default-user'): Promise<Property[]> => {
    const res = await fetch(`${BASE_URL}/favorites?user_id=${encodeURIComponent(userId)}`);
    const data = await res.json();
    return data.favorites || [];
  },

  addFavorite: async (propertyId: string, userId: string = 'default-user') => {
    const res = await fetch(`${BASE_URL}/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, property_id: propertyId })
    });
    return await res.json();
  },

  removeFavorite: async (propertyId: string, userId: string = 'default-user') => {
    const res = await fetch(`${BASE_URL}/favorites/${encodeURIComponent(propertyId)}?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  createAlert: async (data: { email: string; suburbs?: string[]; max_rent?: number; min_bedrooms?: number; frequency?: string }) => {
    const res = await fetch(`${BASE_URL}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  getHeatmap: async (cbdHub: string = 'Wynyard', maxMins: number = 60) => {
    const res = await fetch(`${BASE_URL}/heatmap?destination_hub=${encodeURIComponent(cbdHub)}&max_commute_mins=${maxMins}`);
    return await res.json();
  }
};
