import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { TrendingUp } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

export interface NeighborhoodMarkerData {
  id: string;
  name: string;
  slug: string;
  position: [number, number];
  /** null = not enough listings to state a median; rendered as "—". */
  avgPrice: number | null;
  avgPricePerSqm: number | null;
  avgRent: number | null;
  properties: number;
  /** null = no measured change; rendered as "—" instead of a fake +0%. */
  growth: number | null;
}

interface NeighborhoodMapProps {
  neighborhoods: NeighborhoodMarkerData[];
  height?: string;
  onNeighborhoodSelect?: (neighborhood: NeighborhoodMarkerData) => void;
}

// Custom divIcon for neighborhood markers - small pin style
const createNeighborhoodIcon = (growth: number | null) => {
  // Neutral slate pin when no growth has been measured (never fake green).
  const color = growth === null ? '#475569' : growth >= 0 ? '#059669' : '#dc2626';

  return L.divIcon({
    className: 'neighborhood-marker',
    html: `
      <svg width="22" height="28" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); cursor: pointer;">
        <path d="M11 0C4.925 0 0 4.925 0 11c0 8.25 11 17 11 17s11-8.75 11-17C22 4.925 17.075 0 11 0z" fill="${color}"/>
        <circle cx="11" cy="11" r="4.5" fill="white"/>
      </svg>
    `,
    iconSize: [22, 28],
    iconAnchor: [11, 28],
    popupAnchor: [0, -28],
  });
};

// Component that enables all interactive map features after mount
const MapController: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    // Enable all interactive features explicitly
    map.dragging.enable();
    map.doubleClickZoom.enable();
    map.touchZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();

    // Force the map to recalculate its size after mount
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Set grab cursor for Google Maps-like feel
    const container = map.getContainer();
    container.style.cursor = 'grab';

    const onMouseDown = () => {
      container.style.cursor = 'grabbing';
    };
    const onMouseUp = () => {
      container.style.cursor = 'grab';
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseUp);
    };
  }, [map]);

  return null;
};

const NeighborhoodMap: React.FC<NeighborhoodMapProps> = ({
  neighborhoods,
  height = '500px',
  onNeighborhoodSelect,
}) => {
  const navigate = useNavigate();

  return (
    <MapContainer
      center={[9.01, 38.77]}
      zoom={13}
      style={{ height, width: '100%', borderRadius: '12px' }}
      className="z-0"
      scrollWheelZoom={false}
      dragging={true}
      doubleClickZoom={true}
      touchZoom={true}
      boxZoom={true}
      keyboard={true}
      zoomControl={true}
      attributionControl={true}
      worldCopyJump={true}
      maxZoom={19}
      minZoom={3}
    >
      <MapController />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {neighborhoods.map((neighborhood) => (
        <Marker
          key={neighborhood.id}
          position={neighborhood.position}
          icon={createNeighborhoodIcon(neighborhood.growth)}
        >
          <Popup maxWidth={200} minWidth={160} maxHeight={220} autoPan={true}>
            <div className="font-sans" style={{ width: '180px' }}>
              <h3 className="text-base font-bold text-slate-900 mb-2">{neighborhood.name}</h3>

              <div className="space-y-1 mb-3">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-600">Median Price (recorded units)</span>
                  <span className="text-xs font-semibold text-slate-900">
                    {neighborhood.avgPrice === null
                      ? '—'
                      : `${(neighborhood.avgPrice / 1000000).toFixed(1)}M`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-600">Price/m² (recorded units)</span>
                  <span className="text-xs font-semibold text-slate-900">
                    {neighborhood.avgPricePerSqm === null
                      ? '—'
                      : `${(neighborhood.avgPricePerSqm / 1000).toFixed(0)}K`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-600">Median Rent (recorded units)</span>
                  <span className="text-xs font-semibold text-slate-900">
                    {neighborhood.avgRent === null
                      ? '—'
                      : `${(neighborhood.avgRent / 1000).toFixed(0)}K`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-600">Active Listings</span>
                  <span className="text-xs font-semibold text-slate-900">
                    {neighborhood.properties}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-600">Price Trend</span>
                  <span
                    className={`text-xs font-semibold flex items-center gap-1 ${
                      neighborhood.growth === null
                        ? 'text-slate-500'
                        : neighborhood.growth >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                    }`}
                  >
                    {neighborhood.growth === null ? (
                      '—'
                    ) : (
                      <>
                        <TrendingUp className="w-3 h-3" />
                        {neighborhood.growth >= 0 ? '+' : ''}{neighborhood.growth}%
                      </>
                    )}
                  </span>
                </div>
              </div>

              <button
                onClick={() =>
                  onNeighborhoodSelect
                    ? onNeighborhoodSelect(neighborhood)
                    : navigate(`/neighborhoods/${neighborhood.slug}`)
                }
                className="w-full px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                View Neighborhood
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default NeighborhoodMap;