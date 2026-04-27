import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, Calendar, Clock, MapPin, Navigation, 
  Trash2, AlertTriangle, Loader2, Search, Car, Wallet,
  Sparkles, ShieldCheck, Star, Phone, CreditCard, Banknote, XCircle, CheckCircle2
} from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import { Link } from 'react-router-dom';
import ReviewModal from '../components/ReviewModal';
import OTPDisplay from '../components/OTPDisplay';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const MyBookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [reportingId, setReportingId] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedRideId, setSelectedRideId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const { socket, isConnected, joinRideRoom, leaveRideRoom } = useSocket();

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    if (!bookings.length || !isConnected) return;

    // Join rooms for all active/upcoming rides
    bookings.forEach(b => {
      const status = getRideStatus(b.ride.date, b.ride.time, b.ride.status);
      if (status === 'ACTIVE' || status === 'UPCOMING') {
        joinRideRoom(b.ride._id);
      }
    });

    const handleRideEvent = (data) => {
      console.log('[Socket] Ride event on MyBookings:', data);
      
      // OPTIMISTIC UPDATE: If OTP is ready, let's inject it into state immediately
      if (data.otp && data.rideId) {
        setBookings(prev => prev.map(b => {
           if (b.ride._id === data.rideId) {
             return { ...b, booking: { ...b.booking, otp: data.otp, boardingStatus: 'pending' } };
           }
           return b;
        }));
      }

      fetchBookings(); // Still refresh to be safe and sync entire state
      if (data.message) toast.info(data.message);
    };

    socket.on('confirm_arrival', handleRideEvent);
    socket.on('fare_released', handleRideEvent);
    socket.on('ride_status_changed', handleRideEvent);
    socket.on('otp_ready', handleRideEvent);

    return () => {
      bookings.forEach(b => leaveRideRoom(b.ride._id));
      socket.off('confirm_arrival', handleRideEvent);
      socket.off('fare_released', handleRideEvent);
      socket.off('ride_status_changed', handleRideEvent);
      socket.off('otp_ready', handleRideEvent);
    };
  }, [bookings.length, isConnected, socket]);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings/my');
      
      // WEIGHT-BASED SORTING: Active/Upcoming first, History last
      const sorted = res.data.data.sort((a, b) => {
        const getWeight = (ride) => {
           const status = getRideStatus(ride.date, ride.time, ride.status);
           if (status === 'ACTIVE') return 0;
           if (status === 'UPCOMING') return 1;
           if (status === 'COMPLETED') return 2;
           if (status === 'CANCELLED') return 3;
           return 4;
        };
        const weightA = getWeight(a.ride);
        const weightB = getWeight(b.ride);
        if (weightA !== weightB) return weightA - weightB;
        // SECONDARY REFINEMENT: Recently booked journeys always take priority within their status tier
        return new Date(b.booking.bookedAt) - new Date(a.booking.bookedAt);
      });

      setBookings(sorted);
    } catch (err) {
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (rideId) => {
    setConfirmModal({
      show: true,
      title: 'Cancel Booking?',
      message: 'Are you sure you want to cancel this booking? Recovery of seat is not guaranteed.',
      onConfirm: async () => {
        setCancellingId(rideId);
        try {
          await api.delete(`/bookings/${rideId}`);
          toast.success('Booking cancelled successfully');
          setBookings(prev => prev.filter(b => b.ride._id !== rideId));
        } catch (err) {
          toast.error(err.response?.data?.message || 'Cancellation failed');
        } finally {
          setCancellingId(null);
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  const handleReportNoShow = async (rideId) => {
    setConfirmModal({
      show: true,
      title: 'Report No-Show?',
      message: 'Are you sure the rider did not show up? Reported drivers face strikes and trust score drops. False reports may affect your own standing.',
      onConfirm: async () => {
        setReportingId(rideId);
        try {
          await api.post(`/rides/${rideId}/no-show`);
          toast.success('Your wait has been recorded. If others also report, a strike will be applied automatically.');
          fetchBookings();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Report failed');
        } finally {
          setReportingId(null);
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  const getRideStatus = (rideDate, rideTime, rideStatus) => {
    if (rideStatus === 'completed') return 'COMPLETED';
    if (rideStatus === 'cancelled') return 'CANCELLED';

    const departure = new Date(`${new Date(rideDate).toISOString().split('T')[0]}T${rideTime}`);
    const now = new Date();
    
    // Boarding window starts 15 minutes before departure (Synced with OTP generation)
    const boardingStart = new Date(departure.getTime() - 15 * 60 * 1000);
    const sixHoursLater = new Date(departure.getTime() + 6 * 60 * 60 * 1000);

    if (now < boardingStart) return 'UPCOMING';
    if (now < sixHoursLater) return 'ACTIVE';
    
    return 'COMPLETED'; // Treat expired as completed in history
  };

  const handleConfirmArrival = async (rideId, arrived) => {
    const action = arrived ? 'confirm your arrival' : 'raise a dispute';
    setConfirmModal({
      show: true,
      title: arrived ? 'Confirm Arrival?' : 'Raise Dispute?',
      message: `Are you sure you want to ${action}? This action will finalize the transaction.`,
      onConfirm: async () => {
        try {
          await api.post(`/dropoff/passenger/confirm/${rideId}`, { arrived });
          toast.success(arrived ? 'Arrival confirmed! Driver paid.' : 'Dispute raised. Admin will review.');
          fetchBookings();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Action failed');
        } finally {
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  const handleOpenReview = (driver, rideId) => {
    setSelectedDriver(driver);
    setSelectedRideId(rideId);
    setShowReviewModal(true);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-outfit selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />

      <main className="flex-1 pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Background Decorative Circles */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-[100px] -translate-y-1/2 -translate-x-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-50/50 rounded-full blur-[100px] translate-y-1/2 translate-x-1/2"></div>

        <div className="max-w-4xl mx-auto w-full relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center"
          >
             <span className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase mb-4 border border-indigo-100">
               <History size={14} /> My Journey Ledger
             </span>
             <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter italic">
               Current <span className="text-indigo-600 underline decoration-4 underline-offset-8">Bookings.</span>
             </h1>
          </motion.div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3.5rem] shadow-2xl shadow-indigo-100/50 border border-white mt-12">
               <Loader2 className="h-16 w-16 animate-spin text-indigo-500 mb-6" />
               <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Scanning Ledger...</p>
            </div>
          ) : bookings.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-12 md:p-24 rounded-[3.5rem] shadow-2xl shadow-indigo-100/50 border border-white text-center flex flex-col items-center"
            >
               <div className="h-32 w-32 bg-slate-50 rounded-full flex items-center justify-center mb-8 border border-slate-100 shadow-sm">
                  <Navigation size={56} className="text-slate-300 rotate-45" />
               </div>
               <h3 className="text-2xl font-black text-slate-800 tracking-tighter leading-tight mb-4">No Active Bookings found.</h3>
               <p className="text-slate-500 font-medium max-w-sm mb-10 leading-relaxed uppercase tracking-tight text-xs">Your upcoming travel list is empty. Start a search to find your next adventure buddy.</p>
               <Link to="/find-rides" className="bg-indigo-600 hover:bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 active:scale-95 group">
                  EXPLORE RIDES <Sparkles className="inline ml-2 group-hover:rotate-12 transition-transform" />
               </Link>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {bookings.map((b, i) => (
                  <motion.div
                    key={b.ride._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-6 md:p-8 rounded-[3.5rem] shadow-2xl shadow-indigo-100/30 border border-white group relative overflow-hidden hover:scale-[1.01] transition-all"
                  >
                    {/* Status Badge */}
                    <div className="absolute top-8 right-8 flex items-center gap-3">
                       {getRideStatus(b.ride.date, b.ride.time, b.ride.status) === 'COMPLETED' ? (
                          <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm bg-slate-100 text-slate-500 border border-slate-200">
                            ✨ JOURNEY ARCHIVED
                          </span>
                       ) : getRideStatus(b.ride.date, b.ride.time, b.ride.status) === 'ACTIVE' ? (
                          <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm bg-emerald-50 text-emerald-600 border border-emerald-100">
                            ✅ ACTIVE JOURNEY
                          </span>
                       ) : (
                          <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm bg-indigo-50 text-indigo-600 border border-indigo-100">
                            🕒 UPCOMING TRIP
                          </span>
                       )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                      {/* Left Side: Ride Core Info */}
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Navigation size={12} className="text-indigo-600 rotate-45" /> Journey Path
                          </p>
                          <div className="space-y-2">
                             <h4 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter italic group-hover:text-indigo-600 transition-colors">
                                {b.ride.from} <span className="text-indigo-400">→</span> {b.ride.to}
                             </h4>
                             <div className="flex items-center gap-6 mt-4">
                               <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                                  <Calendar size={14} className="text-indigo-500" />
                                  <span className="text-[11px] font-black tracking-tight text-slate-700">{new Date(b.ride.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                               </div>
                               <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                                  <Clock size={14} className="text-indigo-500" />
                                  <span className="text-[11px] font-black tracking-tight text-slate-700">{b.ride.time}</span>
                               </div>
                             </div>
                          </div>
                        </div>

                        <div className="pt-6 border-t border-slate-50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Boarding & Drop-off Points</p>
                          <div className="space-y-6 relative ml-3">
                             <div className="absolute left-[-13px] top-1.5 bottom-1.5 w-0.5 bg-dashed border-l-2 border-slate-100"></div>
                             
                             <div className="flex items-start gap-3 relative">
                                <div className="h-2 w-2 rounded-full bg-indigo-600 mt-1.5 relative z-10 shadow-[0_0_0_4px_rgba(79,70,229,0.1)]"></div>
                                <div>
                                   <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Pickup Address</p>
                                   <p className="text-xs font-bold text-slate-700 line-clamp-1">{b.booking.boardingPoint.address}</p>
                                </div>
                             </div>

                             <div className="flex items-start gap-3 relative">
                                <div className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 relative z-10 shadow-[0_0_0_4px_rgba(244,63,94,0.1)]"></div>
                                <div>
                                   <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Your Drop-off</p>
                                   <p className="text-xs font-bold text-slate-700 line-clamp-1">{b.booking.dropoffPoint.address}</p>
                                </div>
                             </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Driver & Fare Info */}
                      <div className="space-y-6 md:pl-8 md:border-l border-slate-50">
                         {/* Driver Snapshot */}
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Verification Shield — Driver</p>
                            <div className="flex items-center gap-3 bg-slate-50/50 p-4 rounded-3xl border border-slate-100 group/driver hover:bg-white hover:shadow-xl transition-all">
                                {b.ride.driver.profilePhoto ? (
                                  <img 
                                    src={b.ride.driver.profilePhoto} 
                                    className="h-16 w-16 rounded-2xl object-cover border-2 border-white shadow-xl shadow-indigo-100/50 hd-profile transition-transform hover:rotate-2" 
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <div className="h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-black italic border-2 border-white shadow-lg uppercase group-hover/driver:rotate-2 transition-transform">
                                    {b.ride.driver.name[0]}
                                  </div>
                                )}
                                <div>
                                   <h5 className="text-sm font-black text-slate-800 tracking-tight italic group-hover/driver:text-indigo-600 transition-colors uppercase">{b.ride.driver.name}</h5>
                                   <div className="flex items-center gap-3 mt-1">
                                      <div className="flex items-center gap-1 text-amber-500">
                                         <Star size={10} fill="currentColor" />
                                         <span className="text-[10px] font-black">{b.ride.driver.averageRating || 5.0}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-slate-400">
                                         <ShieldCheck size={10} className="text-emerald-500" />
                                         <span className="text-[9px] font-bold uppercase tracking-widest">Verified</span>
                                      </div>
                                   </div>
                                   <div className="mt-2 text-indigo-500 flex items-center gap-1.5">
                                      <Phone size={10} />
                                      <span className="text-[10px] font-black">+91 {b.ride.driver.phone}</span>
                                   </div>
                                </div>
                            </div>
                         </div>

                         {/* Fare & Payment Status */}
                         <div className="grid grid-cols-2 gap-4">
                            <div className={`p-3 rounded-2xl ${
                               b.booking.paymentMethod === 'wallet' ? 'bg-purple-600 shadow-purple-100' : 
                               b.booking.paymentMethod === 'online' ? 'bg-indigo-600 shadow-indigo-100' : 
                               'bg-slate-900 shadow-slate-100'
                            } text-white shadow-xl relative overflow-hidden`}>
                               <div className="absolute top-0 right-0 h-10 w-10 bg-white/10 rounded-full blur-xl"></div>
                               <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">FARE CHARGED</p>
                               <p className="text-2xl font-black italic">₹{b.booking.fareCharged}</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-white border border-slate-100 flex flex-col justify-between">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">METHOD</p>
                               <div className="flex items-center gap-2">
                                  {b.booking.paymentMethod === 'wallet' ? (
                                    <div className="flex items-center gap-1.5 font-black italic text-[11px] text-purple-600 uppercase">
                                       <Wallet size={14} /> Wallet
                                    </div>
                                  ) : b.booking.paymentMethod === 'online' ? (
                                    <div className="flex items-center gap-1.5 font-black italic text-[11px] text-indigo-600 uppercase">
                                       <CreditCard size={14} /> Online
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 font-black italic text-[11px] text-slate-500 uppercase">
                                       <Banknote size={14} /> Cash
                                    </div>
                                  )}
                               </div>
                            </div>
                         </div>

                         {/* Wallet Escrow Status */}
                         {b.booking.paymentMethod === 'wallet' && (
                            <div className="bg-purple-50 border border-purple-100 p-3 rounded-2xl">
                               <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1.5">Escrow Protocol Status</p>
                               <div className="flex items-center gap-2">
                                  {b.booking.moneyReleased ? (
                                     <>
                                        <div className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-pulse"></div>
                                        <p className="text-[10px] font-black text-purple-700 uppercase italic">₹{b.booking.fareCharged} released to driver</p>
                                     </>
                                  ) : b.booking.refundProcessed ? (
                                     <>
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                                        <p className="text-[10px] font-black text-emerald-700 uppercase italic">₹{b.booking.fareCharged} refunded to wallet</p>
                                     </>
                                  ) : (
                                     <>
                                        <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce"></div>
                                        <p className="text-[10px] font-black text-purple-600 uppercase italic">₹{b.booking.fareCharged} held from wallet</p>
                                     </>
                                  )}
                               </div>
                            </div>
                         )}

                         <div className="pt-4 space-y-3">
                            {/* Cancellation Banner */}
                            {(b.ride.status === 'cancelled' || b.booking.status === 'cancelled') && (
                               <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl mb-4">
                                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Trip Cancelled</p>
                                  <p className="text-xs font-bold text-slate-700">Reason: {b.ride.cancellationReason || "Not specified"}</p>
                                  <Link to="/find-rides" className="mt-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline">
                                     Search Alternatives <Sparkles size={10} />
                                  </Link>
                               </div>
                            )}

                             {b.booking.isReviewed ? (
                                <div className="w-full h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                                   <CheckCircle2 size={16} /> Review Submitted - Journey Finalized
                                </div>
                             ) : (getRideStatus(b.ride.date, b.ride.time, b.ride.status) === 'COMPLETED' || 
                               b.booking.dropoffStatus === 'confirmed' || 
                               b.booking.dropoffStatus === 'auto_released') ? (
                                <button 
                                  onClick={() => handleOpenReview(b.ride.driver, b.ride._id)}
                                  className="w-full h-12 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95"
                                >
                                  <Star size={16} fill="currentColor" /> SHARE YOUR FEEDBACK
                                </button>
                              ) : (b.ride.status === 'cancelled' || b.booking.status === 'cancelled') ? (
                                <div className="w-full h-12 bg-slate-50 border border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 opacity-60">
                                   <XCircle size={16} /> Journey Terminated
                                </div>
                              ) : getRideStatus(b.ride.date, b.ride.time, b.ride.status) === 'ACTIVE' ? (
                                 <div className="mt-8 space-y-3">
                                    {/* Safe Dropoff Confirmation */}
                                    {b.booking.dropoffStatus === 'dropped' && (
                                       <div className="bg-emerald-50 border-2 border-emerald-500/20 p-6 rounded-[2.5rem] shadow-xl shadow-emerald-100/50 animate-in fade-in zoom-in duration-500">
                                          <div className="flex items-center gap-3 mb-4">
                                            <div className="h-8 w-8 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                                              <Car size={16} />
                                            </div>
                                            <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest leading-tight">Driver says you've arrived!</p>
                                          </div>
                                          <div className="grid grid-cols-2 gap-3">
                                            <button 
                                              onClick={() => handleConfirmArrival(b.ride._id, true)}
                                              className="bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                            >
                                              <CheckCircle2 size={14} /> YES, ARRIVE
                                            </button>
                                            <button 
                                              onClick={() => handleConfirmArrival(b.ride._id, false)}
                                              className="bg-white border-2 border-rose-100 text-rose-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                              <AlertTriangle size={14} /> NO, DISPUTE
                                            </button>
                                          </div>
                                       </div>
                                    )}

                                    {(b.booking.dropoffStatus === 'confirmed' || b.booking.dropoffStatus === 'auto_released') && (
                                       <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-center gap-2">
                                          <CheckCircle2 size={12} className="text-emerald-500" />
                                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tight italic leading-none">Journal Entry Closed - Arrival Confirmed</span>
                                       </div>
                                    )}

                                    {b.booking.disputeRaised && (
                                       <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl flex items-center justify-center gap-3">
                                          <AlertTriangle size={16} className="text-rose-500" />
                                          <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Dispute Under Review</span>
                                       </div>
                                    )}

                                    <OTPDisplay booking={b.booking} ride={b.ride} />
                                    
                                    {/* Report No-Show Button (Visible after waitingTime expires) */}
                                    {(() => {
                                       // Robust local-safe date construction
                                       const dProp = new Date(b.ride.date);
                                       const y = dProp.getFullYear();
                                       const m = dProp.getMonth();
                                       const d = dProp.getDate();
                                       const [hours, mins] = b.ride.time.split(':').map(Number);
                                       const departure = new Date(y, m, d, hours, mins);
                                       
                                       const now = new Date();
                                       const diffMinutes = (now - departure) / (1000 * 60);
                                       const isBoarded = b.booking.boardingStatus === 'arrived';
                                       const waitTime = b.ride.waitingTime || 10;
                                       
                                       // Console debug for the specific issue
                                       if (diffMinutes > -60 && diffMinutes < 120) {
                                          console.log(`[JusticeLogic] Ride from ${b.ride.from}: now=${now.toLocaleTimeString()}, dep=${departure.toLocaleTimeString()}, diff=${diffMinutes.toFixed(1)}, gate=${waitTime}`);
                                       }
                                       
                                       // Show if time passed, not boarded (even if 'not_arrived'), and within 45m window
                                       if (diffMinutes >= waitTime && diffMinutes <= 45 && !isBoarded) {
                                          return (
                                             <button 
                                               onClick={() => handleReportNoShow(b.ride._id)}
                                               disabled={reportingId === b.ride._id || b.ride.noShowReports?.includes(user._id)}
                                               className={`w-full h-12 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${b.ride.noShowReports?.includes(user._id) ? "bg-rose-600 text-white shadow-lg" : "bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-600 hover:text-white group"}`}
                                             >
                                                {reportingId === b.ride._id ? (
                                                   <Loader2 className="animate-spin" size={16} />
                                                ) : (
                                                   <>
                                                      <AlertTriangle size={16} className="group-hover:animate-bounce" /> 
                                                      {b.ride.noShowReports?.includes(user._id) ? "NO-SHOW REPORTED" : "Driver Not Here? Report No-Show"}
                                                   </>
                                                )}
                                             </button>
                                          );
                                       }
                                       return null;
                                    })()}
                                 </div>
                              ) : (
                                 <button 
                                   onClick={() => handleCancelBooking(b.ride._id)}
                                   disabled={cancellingId === b.ride._id}
                                   className="w-full h-12 bg-white border border-rose-100 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 hover:bg-rose-500 hover:text-white"
                                 >
                                   {cancellingId === b.ride._id ? <Loader2 className="animate-spin" size={16} /> : <><Trash2 size={16} /> Cancel Trip</>}
                                 </button>
                              )}
                         </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      <ReviewModal 
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        rideId={selectedRideId}
        subject={selectedDriver}
        onReviewSuccess={fetchBookings}
      />
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[3rem] p-8 md:p-12 w-full max-w-lg shadow-2xl relative overflow-hidden"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-2">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">{confirmModal.title}</h3>
                  <p className="text-slate-500 font-bold italic mt-4 px-4">{confirmModal.message}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full pt-4">
                  <button 
                    onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                    className="py-4 px-8 rounded-2xl bg-white border-2 border-slate-900 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                  >
                    Back
                  </button>
                  <button 
                    onClick={confirmModal.onConfirm}
                    className="py-4 px-8 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-xl shadow-slate-200"
                  >
                    Confirm Action
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyBookings;
