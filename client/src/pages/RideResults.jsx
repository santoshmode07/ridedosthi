import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, MapPin, Calendar, Clock, Users, ArrowRight, ArrowLeft, ShieldCheck, 
  Star, Info, X, Navigation as NavIcon, Filter, User, IdCard, FileText, 
  ChevronRight, Car, Loader2, LayoutDashboard, LogOut, TrendingUp,
  Map, Sparkles, CheckCircle2, Phone, CreditCard, Banknote, Bike
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import BookingModal from '../components/BookingModal';
import PassengerList from '../components/PassengerList';

const RideCountdown = ({ date, time, expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      try {
        if (!date || !time) return;
        
        // Parse departure time
        const datePart = (typeof date === 'string' && date.includes('T')) ? date.split('T')[0] : date;
        const [hours, minsPart] = time.split(':');
        const departure = new Date(datePart);
        departure.setHours(parseInt(hours), parseInt(minsPart), 0, 0);
        
        const now = new Date();
        const expiry = expiresAt ? new Date(expiresAt) : new Date(departure.getTime() + 10 * 60000); // Fallback to +10 mins
        
        if (now < departure) {
          const diff = departure - now;
          const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff / 60000) % 60);
          const secs = Math.floor((diff % 60000) / 1000);

          if (hoursLeft > 24) {
            setTimeLeft(`${Math.floor(hoursLeft / 24)}d ${hoursLeft % 24}h`);
          } else if (hoursLeft > 0) {
            setTimeLeft(`${hoursLeft}h ${mins}m`);
          } else if (mins > 0) {
            setTimeLeft(`${mins}m ${secs}s left`);
          } else {
            setTimeLeft(`${secs}s left`);
          }
        } else if (now < expiry) {
          setTimeLeft('BOARDING');
        } else {
          setTimeLeft('EXPIRED');
        }
      } catch (err) {
        setTimeLeft('READY');
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [date, time, expiresAt]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 shadow-sm animate-in fade-in zoom-in duration-500">
      <div className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></div>
      <Clock size={12} className="text-rose-600" />
      <span className="text-[11px] font-black text-rose-700 uppercase tracking-tight">{timeLeft}</span>
    </div>
  );
};

const RideResults = () => {
  const { user, logout } = useAuth();
  const { socket, isConnected } = useSocket();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState(null);
  const [bookingRide, setBookingRide] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const date = searchParams.get('date');
  const pLat = searchParams.get('passengerLat');
  const pLng = searchParams.get('passengerLng');
  const dLat = searchParams.get('destinationLat');
  const dLng = searchParams.get('destinationLng');
  const vehicleType = searchParams.get('vehicleType');

  useEffect(() => {
    const fetchRides = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          from: from || '',
          to: to || '',
          date: date || '',
          passengerLat: pLat || '',
          passengerLng: pLng || '',
          destinationLat: dLat || '',
          destinationLng: dLng || '',
          vehicleType: vehicleType || ''
        }).toString();
        
        const res = await api.get(`/rides?${query}`);
        setRides(res.data.data);
      } catch (err) {
        toast.error('Failed to fetch rides');
      } finally {
        setLoading(false);
      }
    };
    fetchRides();
  }, [from, to, date, pLat, pLng, dLat, dLng, vehicleType]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleSeatUpdate = (data) => {
      console.log('[Socket] Seat update on RideResults:', data);
      setRides(prev => prev.map(ride => {
        if (ride._id === data.rideId) {
          return {
            ...ride,
            seatsAvailable: data.seatsAvailable,
            status: data.seatsAvailable === 0 ? 'full' : 'available'
          };
        }
        return ride;
      }));

      // If viewing details of THIS ride, update it too
      if (selectedRide && selectedRide._id === data.rideId) {
         setSelectedRide(prev => ({
            ...prev,
            seatsAvailable: data.seatsAvailable,
            status: data.seatsAvailable === 0 ? 'full' : 'available'
         }));
      }
    };

    socket.on('seat_updated', handleSeatUpdate);
    return () => socket.off('seat_updated', handleSeatUpdate);
  }, [socket, isConnected, selectedRide]);

  const handleBook = (ride) => {
    // 1. Initial Checks
    if (ride.driver === user._id || ride.driver?._id === user._id) {
       toast.error('You cannot book your own ride');
       return;
    }

    if (ride.driverGender === 'female' && user.gender === 'male') {
       toast.error('This ride is for female passengers only');
       return;
    }

    if (ride.genderPreference === 'male-only' && user.gender === 'female') {
       toast.error('This ride is for male passengers only');
       return;
    }

    setShowBookingModal(true);
  };

  const handleConfirmBooking = async (paymentMethod, paymentIntentId) => {
    setBookingRide(true);
    try {
      const payload = {
        rideId: selectedRide._id,
        boardingAddress: selectedRide.from,
        boardingCoordinates: selectedRide.fromCoordinates.coordinates,
        dropoffAddress: to || selectedRide.to,
        dropoffCoordinates: [parseFloat(dLng), parseFloat(dLat)],
        paymentMethod,
        paymentIntentId
      };

      const res = await api.post('/bookings', payload);
      
      if (res.data.success) {
        toast.success('Ride booked successfully! Seat secured.');
        setShowBookingModal(false);
        setSelectedRide(null);
        
        // Refresh list
        const query = new URLSearchParams({
          from: from || '',
          to: to || '',
          date: date || '',
          passengerLat: pLat || '',
          passengerLng: pLng || '',
          destinationLat: dLat || '',
          destinationLng: dLng || ''
        }).toString();
        const refreshed = await api.get(`/rides?${query}`);
        setRides(refreshed.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed. Try again.');
    } finally {
      setBookingRide(false);
    }
  };

  const openRideDetails = async (id) => {
    try {
      const query = new URLSearchParams({
        passengerLat: pLat || '',
        passengerLng: pLng || '',
        destinationLat: dLat || '',
        destinationLng: dLng || ''
      }).toString();
      const res = await api.get(`/rides/${id}?${query}`);
      setSelectedRide(res.data.data);
    } catch (err) {
      toast.error('Could not load ride details');
    }
  };

   const getTrustScoreInfo = (score) => {
     if (score >= 90) return { color: 'text-emerald-600 bg-emerald-50 border-emerald-100', label: 'Highly Reliable' };
     if (score >= 70) return { color: 'text-amber-600 bg-amber-50 border-amber-100', label: 'Generally Reliable' };
     if (score >= 50) return { color: 'text-orange-600 bg-orange-50 border-orange-100', label: 'Rides with Caution' };
     return { color: 'text-rose-600 bg-rose-50 border-rose-100', label: 'Unreliable' };
   };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-outfit">
      <nav className="sticky top-0 left-0 right-0 z-[100] px-6 md:px-12 py-4 bg-white/70 backdrop-blur-2xl border-b border-slate-200/50 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-4 group">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200 transform group-hover:rotate-12 transition-transform duration-300">
              <LayoutDashboard className="text-white h-5 w-5" />
            </div>
            <span className="font-bold text-2xl tracking-tighter text-slate-800">Ride<span className="text-indigo-600">Dosthi</span></span>
          </Link>
        </div>

        <div className="hidden lg:flex items-center gap-6 bg-slate-50/50 px-6 py-2 rounded-2xl border border-slate-100 italic">
           <div className="flex items-center gap-2">
              <MapPin size={14} className="text-indigo-600" />
              <span className="text-xs font-black text-slate-600 truncate max-w-[120px]">{from || 'Anywhere'}</span>
           </div>
           <ChevronRight size={12} className="text-slate-300" />
           <div className="flex items-center gap-2">
              <NavIcon size={14} className="text-purple-600" />
              <span className="text-xs font-black text-slate-600 truncate max-w-[120px]">{to || 'Global'}</span>
           </div>
           <div className="w-[1px] h-4 bg-slate-200 mx-2"></div>
           <div className="flex items-center gap-2">
              <Calendar size={14} className="text-indigo-600" />
              <span className="text-xs font-black text-slate-600">{date || 'Any Date'}</span>
           </div>
        </div>

        <div className="flex items-center gap-6">
          {user?.priorityBadgeExpires && new Date(user.priorityBadgeExpires) > new Date() && (
            <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-100/10 group cursor-help relative" title="Priority Passenger Active">
               <Star fill="#6366f1" size={12} className="text-indigo-500 animate-pulse" />
               <span className="text-[9px] font-black text-white uppercase tracking-widest hidden sm:block italic">Priority</span>
               <div className="absolute -bottom-12 right-0 bg-slate-900 text-white text-[8px] font-black px-3 py-2 rounded-xl border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[110]">
                  ACTIVE UNTIL {new Date(user.priorityBadgeExpires).toLocaleDateString()}
               </div>
            </div>
          )}

          <div className="hidden lg:flex items-center gap-8">
             <Link to="/find-rides" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">Find Rides</Link>
             <Link to="/offer-ride" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">Offer Ride</Link>
          </div>
          <div className="h-8 w-[1px] bg-slate-200 hidden lg:block"></div>
          <button onClick={logout} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center">
             <LogOut size={20} />
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 md:py-10">
         <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-4">
               <Link to="/find-rides" className="h-10 w-10 rounded-xl bg-white text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-200 flex items-center justify-center group">
                 <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
               </Link>
               <div>
                 <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 italic uppercase">
                   Available <span className="text-indigo-600">Rides.</span>
                 </h2>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {(!from && !to && !date) ? `${rides.length} live offers` : `Matched ${rides.length} trips for your route`}
                 </p>
               </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Compact Priority Badge */}
              {user?.priorityBadgeExpires && new Date(user.priorityBadgeExpires) > new Date() && (
                 <div className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-sm border border-slate-800 flex items-center gap-2">
                    <Star fill="#6366f1" size={14} className="text-indigo-500" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-100">Priority Active</p>
                 </div>
              )}

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 h-fit">
                 <button className="h-9 px-5 rounded-lg bg-white text-slate-900 font-black text-[10px] shadow-sm uppercase tracking-widest flex items-center gap-2 hover:text-indigo-600 transition-all">
                    <Filter size={14} /> Filter 
                 </button>
                 <button className="h-9 px-5 rounded-lg text-slate-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-white transition-all">
                    <TrendingUp size={14} /> Low Price
                 </button>
              </div>
            </div>
         </div>

         {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
             {[1,2,3].map(i => (
               <div key={i} className="h-[450px] bg-white border border-slate-100 rounded-[4rem] animate-pulse relative overflow-hidden shadow-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white/30"></div>
                  <div className="absolute top-10 right-10 w-24 h-24 bg-slate-100 rounded-2xl"></div>
               </div>
             ))}
           </div>
         ) : rides.length === 0 ? (
           <div className="text-center py-48 flex flex-col items-center bg-white/50 backdrop-blur-sm rounded-[5rem] border border-slate-100 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
              <div className="h-44 w-44 bg-slate-50 border border-slate-100 rounded-[3.5rem] flex items-center justify-center mb-10 rotate-12 shadow-[inset_0_10px_30px_rgba(0,0,0,0.02)] relative z-10 hover:rotate-0 transition-transform duration-700">
                 <Map className="text-slate-200" size={96} />
              </div>
              <h3 className="text-5xl font-black text-slate-900 tracking-tighter mb-6 relative z-10 italic uppercase">Route Neutralized.</h3>
              <p className="text-slate-500 max-w-md font-bold text-xl leading-relaxed relative z-10 italic opacity-60">
                 No verified connections found for this sequence. Adjust your parameters or check global hubs.
              </p>
              <Link to="/find-rides" className="mt-14 px-12 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] hover:bg-indigo-600 hover:scale-105 transition-all shadow-2xl shadow-indigo-100 relative z-10">
                 REBOOT SEARCH
              </Link>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {rides.map((ride) => (
                 <motion.div
                   key={ride._id}
                   whileHover={{ y: -15, shadow: '0 50px 100px -20px rgba(0,0,0,0.1)' }}
                   onClick={() => openRideDetails(ride._id)}
                   className="bg-white p-10 rounded-[4.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.06)] border-2 border-slate-100/50 cursor-pointer group relative overflow-hidden transition-all duration-500"
                 >
                   {/* Background Gradient Detail */}
                   <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 opacity-0 group-hover:opacity-40 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 transition-opacity duration-700"></div>

                   {/* Safety & Status Badge */}
                   <div className="absolute top-0 right-12 flex">
                      {ride.genderPreference !== 'any' && (
                        <div className={`px-6 py-4 rounded-b-[2.5rem] text-[10px] font-black tracking-[0.3em] flex items-center gap-2 uppercase z-10 shadow-xl border-t-0 ${ride.genderPreference === 'female-only' ? 'bg-pink-600 text-white shadow-pink-100' : 'bg-slate-900 text-indigo-400 shadow-slate-200'}`}>
                          <ShieldCheck size={14} className="fill-current/20" /> 
                          {ride.genderPreference.replace('-only', '')}
                        </div>
                      )}
                      <div className="px-6 py-4 rounded-b-[2.5rem] bg-white text-slate-900 text-[10px] font-black tracking-[0.3em] flex items-center gap-2 uppercase z-10 shadow-xl border-t-0 border-l border-slate-100">
                         {ride.vehicleType === 'Bike' ? <Bike size={14} className="text-indigo-600" /> : <Car size={14} className="text-indigo-600" />}
                         {ride.vehicleType || 'Car'}
                      </div>
                   </div>

                   <div className="flex items-center gap-5 mb-10">
                        <div className="h-20 w-20 rounded-2xl bg-white shadow-xl flex items-center justify-center text-slate-200 overflow-hidden border-2 border-white shrink-0 ring-4 ring-slate-50 group-hover:ring-indigo-100 transition-all duration-500 relative z-10">
                           {ride.driver?.profilePhoto ? (
                              <img 
                                 src={ride.driver.profilePhoto} 
                                 className="object-cover w-full h-full hd-profile" 
                                 loading="eager"
                                 decoding="async"
                              />
                           ) : <User size={36} />}
                        </div>
                       <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                             <h3 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors line-clamp-1 italic tracking-tight leading-none uppercase">
                               {ride.driver?.name}
                             </h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center bg-amber-50 border border-amber-100/50 px-2 py-1 rounded-lg">
                                 <Star size={10} className="text-amber-500 fill-amber-500 mr-1" />
                                 <span className="text-[10px] font-black text-amber-900 italic tracking-tighter">{ride.driver?.averageRating?.toFixed(1) || 'NEW'}</span>
                              </div>
                             
                             <div className="flex items-center gap-1.5">
                                <div className="h-1 w-10 bg-slate-100 rounded-full overflow-hidden">
                                   <div 
                                     className={`h-full rounded-full transition-all duration-1000 ${ride.driver?.trustScore >= 80 ? 'bg-emerald-500' : ride.driver?.trustScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                     style={{ width: `${ride.driver?.trustScore || 100}%` }}
                                   />
                                </div>
                                <span className="text-[8px] font-black text-slate-400 italic">TRUST</span>
                             </div>
                          </div>
                       </div>
                   </div>

                   <div className="space-y-6 mb-12 relative px-1">
                      <div className="flex gap-6 items-start relative pl-8">
                         {/* Visual Route Path */}
                         <div className="absolute left-2.5 top-2.5 bottom-2.5 w-[2px] bg-slate-100"></div>
                         <div className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white border-2 border-rose-500 shadow-sm z-10 flex items-center justify-center">
                            <div className="h-1 w-1 bg-rose-500 rounded-full"></div>
                         </div>
                         <div className="absolute left-0 bottom-1 h-5 w-5 rounded-full bg-white border-2 border-indigo-600 shadow-sm z-10 flex items-center justify-center">
                            <NavIcon size={10} className="text-indigo-600 fill-indigo-600" />
                         </div>
                         
                         <div className="flex-1 space-y-8">
                            <div>
                               <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 italic">Departure</p>
                               <p className="font-black text-slate-900 text-sm leading-tight italic tracking-tight uppercase line-clamp-1">{ride.from}</p>
                            </div>
                            <div>
                               <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 italic">Destination</p>
                               <p className="font-black text-slate-900 text-sm leading-tight italic tracking-tight uppercase line-clamp-1">{to || ride.to}</p>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="pt-8 border-t border-slate-50 flex items-end justify-between relative z-10">
                      <div className="space-y-5 flex-1 pr-4">
                         <div className="flex flex-wrap items-center gap-2">
                            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                               <MapPin size={12} className="text-indigo-600" />
                               <p className="text-[10px] font-black text-slate-600 italic">
                                  {ride.bookingDetails?.distanceToRider || 'Prox...'}
                               </p>
                            </div>
                            
                            {ride.bookingDetails?.isPriorityMatch && (
                               <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-2">
                                  <Sparkles size={12} className="text-emerald-600" />
                                  <span className="text-[9px] font-black text-emerald-700 uppercase italic">VIP</span>
                               </div>
                            )}
                         </div>

                         <div className="flex flex-col gap-2.5">
                            <div className="flex items-center gap-3">
                               <div className="flex -space-x-2">
                                  {[...Array(2)].map((_, i) => (
                                    <div key={i} className={`h-6 w-6 rounded-lg border-2 border-white flex items-center justify-center text-[8px] font-black text-white ${i % 2 === 0 ? 'bg-slate-900' : 'bg-indigo-600'}`}>
                                       ID
                                    </div>
                                  ))}
                               </div>
                               <div className="flex flex-col">
                                  <p className="text-[9px] font-black text-slate-400 italic leading-none mb-0.5 uppercase tracking-tighter">Verified Assets</p>
                                  <p className="text-[10px] font-black text-slate-800 italic">
                                     {ride.passengerBreakdown ? (ride.passengerBreakdown.male + ride.passengerBreakdown.female) : '0'} SECURED
                                  </p>
                               </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                               <div className="h-1.5 w-8 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500" style={{ width: '60%' }} />
                               </div>
                               <p className="text-[10px] font-black text-slate-500 italic uppercase tracking-tighter">{ride.seatsAvailable} Units Open</p>
                            </div>
                         </div>
                      </div>

                      <div className="shrink-0">
                         <div className="flex items-center gap-4 bg-slate-900 hover:bg-indigo-600 px-6 py-4 rounded-[2rem] transition-all duration-300 shadow-xl shadow-slate-200 group/btn">
                            <div className="flex flex-col items-end">
                               {ride.bookingDetails?.justiceDiscountApplied && (
                                 <span className="text-[10px] font-black text-emerald-400 italic flex items-center gap-1 mb-0.5">
                                    <ShieldCheck size={10} /> -₹{(ride.bookingDetails.originalFare - ride.bookingDetails.fareForPassenger).toFixed(0)}
                                 </span>
                               )}
                               <p className="text-2xl font-black text-white leading-none tracking-tighter italic">
                                 ₹{ride.bookingDetails?.fareForPassenger || ride.price}
                               </p>
                               <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mt-1">Book Trip</p>
                            </div>
                            <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center group-hover/btn:scale-110 group-hover/btn:bg-white/20 transition-all text-white">
                               <ArrowRight size={20} />
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Booking Countdown Strip */}
                   <div className="mt-8 pt-4 border-t border-slate-50 flex items-center justify-between opacity-50 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-2">
                         <Clock size={12} className="text-slate-400" />
                         <RideCountdown date={ride.date} time={ride.time} expiresAt={ride.expiresAt} />
                      </div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Expiring</p>
                   </div>
                 </motion.div>
              ))}
           </div>
         )}
      </main>

      {/* Ride Details Modal (Reused and Updated) */}
      <AnimatePresence>
        {selectedRide && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setSelectedRide(null)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-3xl"
             />
             <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 40 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 40 }}
               className="bg-white w-full max-w-5xl rounded-[3.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden relative z-10 flex flex-col md:flex-row h-[90vh]"
             >
                {/* Details Side (Left) */}
                <div className="flex-1 p-10 md:p-16 overflow-y-auto overflow-x-hidden no-scrollbar">
                   <div className="flex items-center justify-between mb-12">
                      <div className="flex items-center gap-6">
                         <div className="h-28 w-28 bg-white rounded-[2.5rem] flex items-center justify-center text-slate-200 border-4 border-white overflow-hidden shadow-2xl ring-8 ring-slate-50 transition-transform duration-500 hover:scale-105">
                            {selectedRide.driver?.profilePhoto ? (
                               <img 
                                  src={selectedRide.driver.profilePhoto} 
                                  className="object-cover w-full h-full hd-profile" 
                                  loading="eager"
                               />
                            ) : <User size={56} />}
                         </div>
                         <div>
                            <div className="flex items-center gap-3">
                               <h2 className="text-3xl font-black text-slate-800 tracking-tighter">{selectedRide.driver?.name}</h2>
                               {selectedRide.driver?.isVerified && (
                                 <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-emerald-100">
                                   <ShieldCheck className="h-4 w-4" />
                                   <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
                                 </div>
                               )}
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                               <div className="flex items-center gap-1.5">
                                 <Star size={18} className="text-amber-500 fill-amber-500" />
                                 <span className="font-extrabold text-slate-800 text-lg">{selectedRide.driver?.averageRating?.toFixed(1) || '0.0'}</span>
                               </div>
                               <div className="h-1 w-1 rounded-full bg-slate-500"></div>
                               <span className="text-sm font-bold text-slate-600 uppercase tracking-[.15em]">{selectedRide.driver?.totalRatings || 0} reviews</span>
                               <div className="h-1 w-1 rounded-full bg-slate-500"></div>
                               <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100/50">
                                 <Calendar size={14} className="text-indigo-600" />
                                 <span className="text-xs font-black text-indigo-700 uppercase tracking-tight italic">
                                   {new Date(selectedRide.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                 </span>
                               </div>
                            </div>
                         </div>
                      </div>
                      <button onClick={() => setSelectedRide(null)} className="h-12 w-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-500 hover:text-red-500 transition-all hover:rotate-90">
                        <X size={24} />
                      </button>
                   </div>

                   {/* GENDER SAFETY BANNERS */}
                   <div className="mb-12 space-y-4">
                      {selectedRide.driverGender === 'female' && (
                        <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-8 rounded-[2.5rem] text-white flex items-center gap-8 shadow-2xl shadow-rose-100 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full translate-x-12 -translate-y-12 blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                           <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/20">
                              <ShieldCheck size={36} />
                           </div>
                           <div className="relative z-10">
                              <p className="text-xl font-black italic mb-1 uppercase tracking-tight">🛡️ Verified Female-Led Voyage</p>
                              <p className="text-rose-100 text-sm font-bold opacity-80 italic tracking-tight font-medium">Guaranteed Safe Space — For female passengers only. RideDosthi Protocol Active.</p>
                           </div>
                        </div>
                      )}

                      {selectedRide.driverGender === 'male' && selectedRide.genderPreference === 'male-only' && (
                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-[2.5rem] text-white flex items-center gap-8 shadow-2xl shadow-indigo-100 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full translate-x-12 -translate-y-12 blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                           <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/20">
                              <Users size={36} />
                           </div>
                           <div className="relative z-10">
                              <p className="text-xl font-black italic mb-1 uppercase tracking-tight">👥 Specialized Transit Protocol</p>
                              <p className="text-indigo-100 text-sm font-bold opacity-80 italic tracking-tight font-medium">This vehicle contains male passengers only based on driver preference.</p>
                           </div>
                        </div>
                      )}

                      {selectedRide.driverGender === 'male' && selectedRide.genderPreference === 'any' && (
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex items-center gap-6">
                           <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 ">
                              <Users size={24} strokeWidth={2.5} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Co-Rider Breakdown</p>
                              <p className="text-sm font-black text-slate-700 italic">
                                 {selectedRide.bookings?.filter(b => b.status === 'confirmed').length || 0} Passengers Booked 
                                 <span className="text-indigo-600 ml-2">(Open to any gender)</span>
                              </p>
                           </div>
                        </div>
                      )}
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="space-y-12">
                         <div>
                             <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[.3em] mb-8 flex items-center gap-3">
                               <div className="h-1.5 w-1.5 rounded-full bg-indigo-600"></div> JOURNEY TIMELINE
                            </h4>
                            <div className="space-y-10 relative pl-8 border-l-2 border-slate-50 ml-2">
                               <div className="relative">
                                  <div className="absolute -left-[41px] top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white border-4 border-indigo-600 z-10 shadow-sm"></div>
                                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[.2em] mb-1 italic">Raider Starting Point (Meeting Point)</p>
                                  <p className="text-xl font-extrabold text-slate-800 tracking-tight italic underline decoration-indigo-200 underline-offset-4">{selectedRide.from}</p>
                               </div>
                               <div className="relative">
                                  <div className="absolute -left-[41px] top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white border-4 border-purple-600 z-10 shadow-sm"></div>
                                  <p className="text-[10px] font-black text-purple-500 uppercase tracking-[.2em] mb-1 italic">Your Midway Destination</p>
                                  <p className="text-xl font-extrabold text-slate-800 tracking-tight italic underline decoration-purple-200 underline-offset-4">{to || selectedRide.to}</p>
                               </div>
                            </div>
                         </div>
                         
                         <div>
                            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[.3em] mb-6 flex items-center gap-3">
                               <div className="h-1.5 w-1.5 rounded-full bg-indigo-600"></div> VEHICLE SPECS
                            </h4>
                            <div className="bg-[#F8FAFC] p-8 rounded-[3rem] border border-slate-100 flex items-center gap-6 shadow-inner">
                               <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-50">
                                  {selectedRide.vehicleType === 'Bike' ? <Bike size={32} /> : <Car size={32} />}
                               </div>
                               <div>
                                  <p className="font-black text-slate-800 text-lg uppercase tracking-tight leading-none mb-2 italic">{selectedRide.carModel}</p>
                                  <div className="inline-flex bg-slate-200/50 px-3 py-1 rounded-lg border border-slate-300/30">
                                     <span className="text-xs font-black text-slate-500 tracking-[.2em]">{selectedRide.carNumber}</span>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-12">
                         <div>
                            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[.3em] mb-6 flex items-center justify-between">
                               <span className="flex items-center gap-3"><div className="h-1.5 w-1.5 rounded-full bg-indigo-600"></div> VERIFIED CO-RIDERS</span>
                               <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full font-black text-[10px] tracking-tight italic">{selectedRide.seatsAvailable} Free Space</span>
                            </h4>
                            
                            {/* If user is the driver, show full Passenger List */}
                            {(user._id === selectedRide.driver?._id || user._id === selectedRide.driver) ? (
                              <PassengerList 
                                passengers={selectedRide.bookings?.filter(b => b.status === 'confirmed')} 
                                totalSeats={selectedRide.seatsAvailable + selectedRide.bookings?.filter(b => b.status === 'confirmed').length}
                                remainingSeats={selectedRide.seatsAvailable}
                              />
                            ) : (
                              <div className="bg-[#F8FAFC] p-8 rounded-[3rem] border border-slate-100 space-y-8 shadow-inner">
                                {/* Gender Breakdown Summary */}
                                {selectedRide.passengerBreakdown && (
                                  <div className="flex items-center justify-center gap-4 mb-4">
                                     {selectedRide.genderPreference !== 'female-only' && (
                                        <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                                           <User size={12} className="text-indigo-600" />
                                           <span className="text-[10px] font-black text-indigo-700 uppercase">{selectedRide.passengerBreakdown.male} Men</span>
                                        </div>
                                     )}
                                     {selectedRide.genderPreference !== 'male-only' && (
                                        <div className="flex items-center gap-2 bg-pink-50 px-3 py-1 rounded-full border border-pink-100">
                                           <User size={12} className="text-pink-600" />
                                           <span className="text-[10px] font-black text-pink-700 uppercase">{selectedRide.passengerBreakdown.female} Women</span>
                                        </div>
                                     )}
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center justify-center gap-2">
                                   {selectedRide.bookings?.filter(b => b.status === 'confirmed').map((b, i) => (
                                     <div key={i} className="group relative">
                                         <div className="w-16 h-16 rounded-2xl border-4 border-white overflow-hidden bg-white shadow-xl group-hover:scale-110 transition-transform cursor-pointer ring-1 ring-slate-100">
                                            {b.passenger?.profilePhoto ? (
                                               <img 
                                                  src={b.passenger.profilePhoto} 
                                                  className="w-full h-full object-cover hd-profile" 
                                                  loading="lazy"
                                               />
                                            ) : (
                                              <div className="h-full w-full bg-indigo-600 flex items-center justify-center text-white font-black italic text-xl uppercase">
                                                 {b.passenger?.name?.charAt(0) || '?'}
                                              </div>
                                           )}
                                        </div>
                                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none font-bold">
                                           {b.passenger?.name} (Verified)
                                        </div>
                                     </div>
                                   ))}
                                   {selectedRide.bookings?.filter(b => b.status === 'confirmed').length === 0 && (
                                      <div className="text-center py-4 text-slate-400 font-bold italic text-sm tracking-tight opacity-90 uppercase tracking-widest">No passengers yet...</div>
                                   )}
                                </div>
                                <div className="h-[1px] bg-slate-200/50 w-full"></div>
                                <p className="text-center text-[10px] font-black text-slate-400 tracking-widest uppercase">Only the driver can view full boarding profiles</p>
                              </div>
                            )}
                         </div>

                         <div>
                            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[.3em] mb-6 flex items-center gap-3">
                               <div className="h-1.5 w-1.5 rounded-full bg-indigo-600"></div> IDENTITY PROOF
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm group hover:border-indigo-100 transition-colors">
                                  <IdCard className="text-indigo-500 mb-4 group-hover:scale-110 transition-transform" size={24} />
                                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pass ID Verified</p>
                                   <p className="text-xs font-black text-slate-700 tracking-[.1em] italic break-all">{selectedRide.driver?.aadhaarNumber}</p>
                                </div>
                                <div className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm group hover:border-indigo-100 transition-colors">
                                  <FileText className="text-indigo-500 mb-4 group-hover:scale-110 transition-transform" size={24} />
                                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">License Plate</p>
                                   <p className="text-xs font-black text-slate-700 tracking-[.1em] italic break-all">{selectedRide.driver?.licenseNumber}</p>
                                </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Reviews Section */}
                   <div className="mt-20">
                      <div className="flex items-center justify-between mb-10">
                          <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[.3em] flex items-center gap-3">
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-600"></div> RECENT FEEDBACK
                         </h4>
                         <span className="text-xs font-bold text-indigo-600 cursor-pointer hover:underline uppercase tracking-[.2em]">Full Driver Log</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {selectedRide.driverReviews?.length > 0 ? selectedRide.driverReviews.map((rev, i) => (
                           <div key={i} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                             <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -translate-y-8 translate-x-8 group-hover:translate-y-0 group-hover:translate-x-0 transition-transform duration-500 opacity-60"></div>
                             <div className="flex items-center gap-4 mb-5 relative z-10">
                                 <div className="h-12 w-12 rounded-xl bg-white border-2 border-white overflow-hidden shrink-0 shadow-lg">
                                   {rev.reviewer?.profilePhoto && (
                                     <img 
                                       src={rev.reviewer.profilePhoto} 
                                       className="w-full h-full object-cover hd-profile" 
                                       loading="lazy"
                                     />
                                   )}
                                </div>
                                <div className="flex-1">
                                   <p className="text-sm font-black text-slate-800 leading-none mb-1 uppercase tracking-tight italic">{rev.reviewer?.name}</p>
                                   <div className="flex gap-0.5">
                                      {[...Array(5)].map((_, star) => (
                                        <Star key={star} size={10} className={star < rev.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'} />
                                      ))}
                                   </div>
                                </div>
                                <span className="text-[9px] font-extrabold text-slate-300 uppercase tracking-widest">{new Date(rev.createdAt).toLocaleDateString()}</span>
                             </div>
                             <p className="text-sm text-slate-500 italic leading-relaxed font-medium relative z-10 px-2 border-l-2 border-indigo-50">"{rev.comment}"</p>
                           </div>
                         )) : (
                            <div className="col-span-2 text-center py-24 bg-slate-50/50 rounded-[3.5rem] border border-dashed border-slate-200">
                               <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                                  <Sparkles className="text-slate-200" size={24} />
                               </div>
                               <p className="text-slate-400 font-extrabold text-[10px] tracking-[.3em] uppercase">No verified co-rider logs yet</p>
                            </div>
                         )}
                      </div>
                   </div>
                </div>

                {/* Sticky Right Side */}
                <div className="w-full md:w-[380px] bg-slate-900 p-8 md:p-10 text-white flex flex-col justify-between relative overflow-y-auto overflow-x-hidden no-scrollbar">
                   <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 to-slate-900 -z-0"></div>
                   <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                   
                   <div className="relative z-10">
                      <div className="mb-8">
                         <p className="text-indigo-300/60 font-black text-[10px] uppercase tracking-[0.4em] mb-4 font-outfit">Smart Calculated Fare</p>
                          <div className="flex flex-col mb-4">
                             {selectedRide.bookingDetails?.justiceDiscountApplied && (
                                <div className="flex items-center gap-2 mb-2">
                                   <span className="text-xl font-black text-slate-400 line-through italic opacity-50">₹{selectedRide.bookingDetails.originalFare || selectedRide.originalFare}</span>
                                   <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest animate-pulse">10% Justice OFF</span>
                                </div>
                             )}
                             <h3 className="text-5xl md:text-6xl font-black tracking-tighter leading-none flex items-start italic">
                                <span className="text-2xl mt-2 mr-1 not-italic">₹</span>
                                {selectedRide.dynamicFare || selectedRide.price}
                             </h3>
                             {selectedRide.bookingDetails?.justiceDiscountApplied && (
                                <p className="text-[9px] font-black text-emerald-400 mt-2 uppercase tracking-[0.2em] italic">🛡️ Protected communities pricing active</p>
                             )}
                          </div>
                         <div className="flex items-center gap-3 mt-4 ml-1">
                            <p className="text-slate-500 font-bold tracking-widest uppercase text-[10px]">Distance to Pickup:</p>
                             <p className="text-indigo-400 font-black text-xs italic">{selectedRide.bookingDetails?.distanceToRider || 'Detecting...'}</p>
                         </div>
                         <div className="flex items-center gap-3 mt-2 ml-1">
                            <p className="text-slate-500 font-bold tracking-widest uppercase text-[10px]">Driver Security:</p>
                            <p className="text-emerald-400 font-black text-xs italic uppercase tracking-tighter">{selectedRide.driverGender} DRIVER</p>
                         </div>
                      </div>

                      <div className="space-y-4 bg-white/5 p-6 rounded-[2rem] border border-white/10 backdrop-blur-md">
                         <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Platform Tax</span>
                            <span className="font-black text-indigo-400 italic">OFF</span>
                         </div>
                         <div className="h-[1px] bg-white/5"></div>
                         <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Road Insurance</span>
                            <span className="text-emerald-400 font-black italic">VERIFIED</span>
                         </div>
                         <div className="h-[1px] bg-white/5"></div>
                         <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Support Log</span>
                            <span className="text-indigo-400 font-black italic">ACTIVE 24/7</span>
                         </div>
                      </div>
                   </div>

                   <div className="relative z-10 space-y-6 pt-8">
                      <div className="flex items-start gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                         <div className="h-10 w-10 bg-indigo-600/20 rounded-xl flex items-center justify-center shrink-0 border border-indigo-500/20">
                            <Info size={18} className="text-indigo-300" />
                         </div>
                         <p className="text-[11px] text-slate-500 leading-relaxed font-bold tracking-tight">
                            Identity verification required at pickup. <span className="text-indigo-300 underline decoration-indigo-400/30">Read Cancellation Terms.</span>
                         </p>
                      </div>

                      {/* BOOKING BUTTON LOGIC */}
                      <div className="space-y-4">
                        {(user._id === selectedRide.driver?._id || user._id === selectedRide.driver) ? (
                          <div className="w-full bg-slate-800 text-slate-400 py-6 rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 border border-white/5">
                             <IdCard size={18} /> YOUR OWN RIDE
                          </div>
                        ) : selectedRide.bookings?.some(b => b.passenger._id === user._id && b.status === 'confirmed') ? (
                          <div className="w-full bg-emerald-500 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-emerald-200">
                             <CheckCircle2 size={18} /> JOURNEY SECURED
                          </div>
                        ) : selectedRide.seatsAvailable === 0 ? (
                          <div className="w-full bg-slate-800 text-slate-500 py-6 rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 border border-white/5">
                             RIDE AT CAPACITY
                          </div>
                        ) : (
                          <button
                            onClick={() => handleBook(selectedRide)}
                            disabled={bookingRide}
                            className="w-full bg-indigo-600 hover:bg-white hover:text-indigo-900 text-white py-6 rounded-3xl font-black text-lg shadow-[0_20px_50px_-10px_rgba(79,70,229,0.5)] transition-all flex items-center justify-center gap-4 active:scale-95 group uppercase tracking-tight italic"
                          >
                            {bookingRide ? <Loader2 className="animate-spin" /> : (
                              <>
                                Join Journey 
                                <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                              </>
                            )}
                          </button>
                        )}
                        
                        <div className="flex items-center justify-center gap-4 opacity-50">
                           <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-300">
                              <ShieldCheck size={12} /> SSL SECURED
                           </div>
                           <div className="h-1 w-1 rounded-full bg-slate-700"></div>
                           <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-300">
                              <Sparkles size={12} /> CASHLESS OPTION
                           </div>
                        </div>
                      </div>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PHASE 3 BOOKING MODAL */}
      <BookingModal 
         isOpen={showBookingModal}
         onClose={() => setShowBookingModal(false)}
         ride={selectedRide}
         fare={selectedRide?.dynamicFare || selectedRide?.price}
         dropoffCoordinates={[parseFloat(dLng), parseFloat(dLat)]}
         isBooking={bookingRide}
         onConfirm={handleConfirmBooking}
      />
    </div>
  );
};

export default RideResults;
