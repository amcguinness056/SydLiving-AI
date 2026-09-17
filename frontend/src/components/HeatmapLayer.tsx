import { useEffect, useState } from 'react';
import { Circle, Popup } from 'react-leaflet';
import { Train, DollarSign } from 'lucide-react';

export interface SuburbHeatmapPoint {
  suburb: string;
  latitude: number;
  longitude: number;
  median_rent_weekly: number;
  commute_minutes_to_cbd: number;
  transit_mode: string;
  destination_cbd_hub: string;
  cost_per_commute_minute: number;
  efficiency_index: number;
  tier: string;
  tier_color: string;
}

interface HeatmapLayerProps {
  hub?: string;
}

export function HeatmapLayer({ hub = 'Martin Place' }: HeatmapLayerProps) {
  const [points, setPoints] = useState<SuburbHeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:8000/api/heatmap/commute-cost?destination_hub=${encodeURIComponent(hub)}`)
      .then(res => res.json())
      .then(data => {
        setPoints(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load heatmap data", err);
        setLoading(false);
      });
  }, [hub]);

  if (loading) return null;

  const getColor = (tier: string) => {
    if (tier === 'Top Value Sweet Spot') return '#10b981'; // emerald
    if (tier === 'Solid Balance') return '#3b82f6'; // blue
    return '#f59e0b'; // amber
  };

  return (
    <>
      {points.map((pt, idx) => {
        const color = getColor(pt.tier);
        return (
          <Circle
            key={idx}
            center={[pt.latitude, pt.longitude]}
            radius={1200}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.35,
              weight: 2
            }}
          >
            <Popup className="glassmorphic-popup">
              <div className="p-2.5 min-w-[200px] text-slate-800 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h3 className="font-extrabold text-sm text-slate-900">{pt.suburb}</h3>
                  <span 
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: color }}
                  >
                    {pt.efficiency_index}/100
                  </span>
                </div>
                
                <div className="text-[11px] font-semibold text-slate-600">
                  {pt.tier}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-slate-50 p-1.5 rounded-lg">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-0.5">
                      <DollarSign className="w-2.5 h-2.5" /> Rent
                    </span>
                    <span className="font-extrabold text-slate-800">${pt.median_rent_weekly}/wk</span>
                  </div>

                  <div className="bg-slate-50 p-1.5 rounded-lg">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-0.5">
                      <Train className="w-2.5 h-2.5" /> Commute
                    </span>
                    <span className="font-extrabold text-slate-800">{pt.commute_minutes_to_cbd} mins</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                  <span>To {pt.destination_cbd_hub}</span>
                  <span className="font-semibold text-indigo-600">{pt.transit_mode}</span>
                </div>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
}
