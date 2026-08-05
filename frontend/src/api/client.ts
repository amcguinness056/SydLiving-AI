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
    return data.results;
  },
  getCommute: async (origin: string, dest: string): Promise<Commute[]> => {
    const res = await fetch(`${BASE_URL}/commute?origin_suburb=${encodeURIComponent(origin)}&destination_cbd_hub=${encodeURIComponent(dest)}`);
    const data = await res.json();
    return data.commutes;
  },
  sendChatMessage: async (message: string, history: any[] = []): Promise<ChatResponse> => {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, history })
    });
    return await res.json();
  }
};

