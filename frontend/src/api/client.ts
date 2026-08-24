const BASE_URL = 'http://localhost:8000/api';

export interface DestinationHub {
  id: string;
  name: string;
  latitude: float_number;
  longitude: float_number;
  hub_type: string;
}

type float_number = number;

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

export interface PropertyFilterParams {
  suburb?: string;
  max_rent?: number;
  min_bedrooms?: number;
  destination_hub?: string;
  max_commute_mins?: number;
}

export const api = {
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
      
      const query = params.toString();
      if (query) {
        url += `?${query}`;
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


