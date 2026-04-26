import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Loader2, Search, Map as MapIcon, X, Check, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet + Vite/React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const LocationSelector = ({ label, placeholder, name, value, coordinates, onChange, onCoordinatesChange, icon: Icon = MapPin, autoTrigger = false }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // India center
  const [pinPos, setPinPos] = useState(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (autoTrigger && !value && !coordinates?.length) {
      handleAutoFill();
    }
  }, []);

  // Requirement 1: Browser GPS First Priority (Simplified Area Name)
  const handleAutoFill = () => {
    if (!navigator.geolocation) return;
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        
        // LOGIC: If accuracy is poor (>5km), it's likely an ISP Hub (like Hyderabad)
        if (accuracy > 5000) {
          toast.info("📍 Browser GPS is imprecise. Using ISP location (might be wrong city).", {
            position: "bottom-center",
            autoClose: 3000
          });
        }

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`);
          const data = await res.json();
          const simplified = simplifyAddress(data);
          onChange(simplified);
          onCoordinatesChange([longitude, latitude]);
          setMapCenter([latitude, longitude]);
          setPinPos([latitude, longitude]);
        } catch (err) {
          console.error(err);
          toast.error("Network error during location fetch");
        } finally {
          setIsLoading(false);
        }
      },
      (err) => {
        setIsLoading(false);
        if (err.code === 1) toast.error("📍 Location access denied. Please enable GPS.");
        else if (err.code === 3) toast.error("📍 Location request timed out.");
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  };

  const [modalSearch, setModalSearch] = useState('');
  const handleModalSearch = async (e) => {
    e.preventDefault();
    if (!modalSearch) return;
    setIsLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(modalSearch)}&format=json&countrycodes=in&limit=1`);
      const data = await res.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setMapCenter([lat, lon]);
        setPinPos([lat, lon]);
        handleReverseGeocode(lat, lon);
      } else {
        toast.error("Location not found");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const simplifyAddress = (data) => {
    const a = data.address;
    if (!a) return data.display_name?.split(',')[0] || "Unknown Location";
    const main = a.suburb || a.neighbourhood || a.city_district || a.road || a.commercial || a.industrial || "";
    const city = a.city || a.town || a.village || a.state_district || "";
    if (main && city) return `${main}, ${city}`;
    if (main) return main;
    if (city) return city;
    return data.display_name?.split(',')[0] || "Unknown Location";
  };

  // Requirement 2: Live Search Suggestions (India Only)
  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);
    
    // Clear coordinates if user is typing (Requirement 3: Coordinates are truth, but search happens live)
    // Actually, we keep coordinates until they pick a suggestion or drop a pin.
    // If they just type and submit, the fallback (Req 5) handles it.

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (val.length < 3) {
      setSuggestions([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&countrycodes=in&addressdetails=1&limit=5`);
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 500);
  };

  const selectSuggestion = (s) => {
    const simplified = simplifyAddress(s);
    onChange(simplified);
    onCoordinatesChange([parseFloat(s.lon), parseFloat(s.lat)]);
    setSuggestions([]);
    setShowSuggestions(false);
    setPinPos([parseFloat(s.lat), parseFloat(s.lon)]);
    setMapCenter([parseFloat(s.lat), parseFloat(s.lon)]);
  };

  // Reactive Map Centering
  const MapCenterer = ({ center }) => {
    const map = useMapEvents({});
    useEffect(() => {
      if (center) {
        map.setView(center, 15, { animate: true });
      }
    }, [center, map]);
    return null;
  };

  // Fix for map tiles not loading in modals
  const MapFixer = () => {
    const map = useMapEvents({});
    useEffect(() => {
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 300);
      return () => clearTimeout(timer);
    }, [map]);
    return null;
  };

  // Sync map center with user live location when map opens if no coords exist
  useEffect(() => {
    if (showMap && !coordinates?.length && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setMapCenter([latitude, longitude]);
          setPinPos([latitude, longitude]);
          handleReverseGeocode(latitude, longitude);
        },
        (err) => console.warn("Location access denied", err),
        { enableHighAccuracy: true }
      );
    } else if (showMap && coordinates?.length === 2) {
      // If we already have coordinates, center on them
      setMapCenter([coordinates[1], coordinates[0]]);
      setPinPos([coordinates[1], coordinates[0]]);
    }
  }, [showMap]);

  // Requirement 4: Map Pin Drop Backup
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPinPos([lat, lng]);
        setMapCenter([lat, lng]); // Sync center with pin to avoid jump-backs
        handleReverseGeocode(lat, lng);
      },
    });
    return null;
  };

  const handleReverseGeocode = async (lat, lng) => {
    setIsLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
      const data = await res.json();
      const simplified = simplifyAddress(data);
      onChange(simplified);
      onCoordinatesChange([lng, lat]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3 relative group">
      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1 block">{label}</label>
      <div className="relative">
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none z-10" />
        <input 
          type="text" 
          placeholder={placeholder} 
          className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl py-4 pl-11 pr-20 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-slate-700 font-bold text-sm md:text-base"
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        />
        
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 md:gap-2">
          {isLoading && <Loader2 size={16} className="animate-spin text-indigo-500 mr-1" />}
          
          <button 
            type="button" 
            onClick={() => setShowMap(true)}
            className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
            title="Pick on Map"
          >
            <MapIcon size={16} />
          </button>

          {!isLoading && coordinates && coordinates.length > 0 ? (
            <div className="bg-emerald-50 text-emerald-600 p-1 rounded-full border border-emerald-100 shadow-sm" title="Coordinates Captured">
              <Check size={12} />
            </div>
          ) : (
            <button 
              type="button" 
              onClick={handleAutoFill}
              className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
              title="Use Current Location"
            >
              <Navigation size={16} className="rotate-45" />
            </button>
          )}
        </div>

        {/* Suggestions List */}
        {showSuggestions && suggestions.length > 0 && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowSuggestions(false)}></div>
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 py-2 animate-in fade-in slide-in-from-top-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectSuggestion(s)}
                  className="w-full px-6 py-4 hover:bg-indigo-50 text-left flex items-start gap-4 transition-colors group/item border-b border-slate-50 last:border-0"
                >
                  <MapPin className="h-5 w-5 text-slate-300 group-hover/item:text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-slate-800 tracking-tight">{simplifyAddress(s)}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 line-clamp-1">{s.display_name}</p>
                  </div>
                </button>
              ))}
              <button 
                type="button"
                onClick={() => { setShowMap(true); setShowSuggestions(false); }}
                className="w-full px-6 py-4 bg-slate-50 hover:bg-indigo-600 hover:text-white text-indigo-600 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <MapIcon size={14} /> Cannot find location? Drop a pin
              </button>
            </div>
          </>
        )}
      </div>

      <button 
        type="button" 
        onClick={() => setShowMap(true)}
        className="ml-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-1.5 transition-colors group/link w-fit"
      >
        <MapIcon size={10} className="group-hover/link:scale-110 transition-transform" />
        Point on Map
      </button>

      {/* Map Modal for Pin Drop */}
      {showMap && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-0 md:p-10 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl md:rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-white overflow-hidden flex flex-col h-full md:h-auto md:max-h-[90vh]">
            
            {/* Rigid Header */}
            <div className="h-24 md:h-32 p-6 md:p-10 border-b border-slate-50 flex items-center justify-between shrink-0 bg-white">
               <div>
                 <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter">Select Exact Location</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 italic">Precision Pin-Drop Required</p>
               </div>
               <button onClick={() => setShowMap(false)} className="h-12 w-12 md:h-16 md:w-16 rounded-2xl md:rounded-3xl bg-slate-50 hover:bg-red-50 hover:text-red-500 text-slate-400 transition-all flex items-center justify-center">
                  <X size={24} />
               </button>
            </div>
            
            {/* Rigid Map Body */}
            <div className="flex-1 md:flex-none relative h-full md:h-[500px] w-full bg-slate-100 overflow-hidden">
              
              {/* Internal Modal Search Bar (Fixed: Use div instead of form to avoid nested form error) */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] w-[90%] md:w-auto">
                 <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-2xl border border-slate-100">
                    <input 
                      type="text" 
                      placeholder="Search your city/area..." 
                      className="px-4 py-2 w-full md:w-64 focus:outline-none font-bold text-sm"
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleModalSearch(e)}
                    />
                    <button 
                      type="button" 
                      onClick={handleModalSearch}
                      className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center"
                    >
                       {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    </button>
                 </div>
              </div>

              <MapContainer 
                center={mapCenter} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapFixer />
                <MapCenterer center={mapCenter} />
                <MapEvents />
                {pinPos && <Marker position={pinPos} />}
              </MapContainer>

              {/* Status Overlay */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center gap-3 w-full px-4">
                 <div className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] flex items-center gap-3 shadow-2xl border border-white/10">
                    {isLoading ? (
                      <><Loader2 size={12} className="animate-spin text-indigo-400" /> Verifying Point...</>
                    ) : (
                      <><Sparkles size={12} className="text-indigo-400" /> Drop a pin on the map</>
                    )}
                 </div>

                 {value && pinPos && !isLoading && (
                   <div className="bg-white/95 backdrop-blur shadow-2xl border border-slate-200 px-6 py-4 rounded-3xl flex flex-col items-center animate-in slide-in-from-top-4 duration-500 max-w-sm text-center gap-3">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Detected Area</p>
                        <p className="text-sm font-black text-slate-800 italic">{value}</p>
                      </div>
                      <button 
                        onClick={() => setShowMap(false)}
                        className="bg-indigo-600 text-white px-5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                      >
                         Use This Location <Check size={12} />
                      </button>
                   </div>
                 )}
              </div>
            </div>

            {/* Rigid Footer */}
            <div className="p-6 md:p-8 shrink-0 bg-white border-t border-slate-50">
               <button 
                 type="button"
                 onClick={() => setShowMap(false)}
                 disabled={isLoading || !pinPos}
                 className="w-full h-14 md:h-18 bg-indigo-600 hover:bg-slate-900 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl md:rounded-3xl font-black text-xs md:text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
               >
                 Verify & Save Location <Check size={20} />
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;
