import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Calendar, Clock, Users, Car, CreditCard, ShieldCheck, 
  ArrowRight, Loader2, Info, LayoutDashboard, LogOut, Sparkles,
  ChevronRight, Briefcase, Navigation, AlertCircle, CheckCircle2,
  Ban, Mail, Scale, History, ShieldAlert, Globe, Zap, X, Bike
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import LocationSelector from '../components/LocationSelector';
import { Navigation as NavIcon } from 'lucide-react';
import Navbar from '../components/Navbar';

const OfferRide = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [formData, setFormData] = useState({
    from: '',
    to: '',
    fromCoordinates: [],
    toCoordinates: [],
    date: '',
    time: '',
    seatsAvailable: 1,
    carModel: '',
    carNumber: '',
    price: '',
    genderPreference: user?.gender === 'female' ? 'female-only' : 'any',
    waitingTime: 10,
    agreedToPolicy: false,
    vehicleType: 'Car' // Default
  });

  const [prediction, setPrediction] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);

  const handleAiPredict = async () => {
    if (!formData.from || !formData.to) {
      toast.info('Please enter pickup and destination first');
      return;
    }

    setIsPredicting(true);
    setPrediction(null);
    try {
      const res = await api.post('/rides/predict-price', { 
        from: formData.from, 
        to: formData.to,
        fromCoords: formData.fromCoordinates,
        toCoords: formData.toCoordinates,
        vehicleType: formData.vehicleType
      });
      if (res.data.success) {
        setPrediction(res.data.prediction);
      }
    } catch (err) {
      console.error('Prediction failed:', err);
      toast.error('AI Prediction failed. Please try again.');
    } finally {
      setIsPredicting(false);
    }
  };

  // NEW: Get Price Assessment
  const priceAssessment = useMemo(() => {
    if (!prediction || !formData.price || isNaN(formData.price)) return null;
    const price = Number(formData.price);
    if (price > prediction.max) return { status: 'Overpriced', color: 'text-rose-400', bg: 'bg-rose-500/10' };
    if (price < prediction.min) return { status: 'Underpriced', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    return { status: 'Good Price', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  }, [prediction, formData.price]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // If user manually types, clear the pre-filled coordinates to force re-geocoding
    // This logic is now handled by LocationSelector's internal state and onCoordinatesChange
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.from || !formData.to || !formData.date || !formData.time || !formData.carModel || !formData.carNumber || !formData.price) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // REQUIREMENT 5: If all else fails, just send the text
      const rideData = { ...formData };
      const response = await api.post('/rides/offer', rideData);
      toast.success('Ride offer created successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Create ride error:', error);
      toast.error(error.response?.data?.message || 'Failed to create ride offer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputContainerClass = "relative w-full group";
  const iconClass = "absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none";
  const labelClass = "text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1 block";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-outfit selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />

      <main className="flex-1 pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Account Restriction Overlay */}
        {user?.restrictedUntil && new Date(user.restrictedUntil) > new Date() && (
          <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 text-center">
             <div className="max-w-xl w-full bg-white rounded-[4rem] p-12 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="flex flex-col items-center gap-6 mb-8">
                   <div className="h-20 w-20 bg-rose-100 rounded-[2rem] flex items-center justify-center text-rose-600 shadow-xl shadow-rose-200">
                      <Ban size={40} />
                   </div>
                   <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Posting Restricted</h2>
                   <p className="text-slate-500 font-medium tracking-tight">
                      Your account has been temporarily restricted from offering rides due to a strike or excessive cancellations.
                   </p>
                </div>

                <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 mb-10">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Restriction Ends At</p>
                   <p className="text-2xl font-black text-slate-900 italic uppercase">
                      {new Date(user.restrictedUntil).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
                   </p>
                </div>

                {/* Appeal Option inside restriction message */}
                {user.appealCount < 2 && user.lastStrikeAt && (new Date() - new Date(user.lastStrikeAt)) < 48 * 60 * 60 * 1000 ? (
                   <div className="bg-indigo-600 p-8 rounded-[3rem] text-white text-left space-y-4">
                      <div className="flex items-center gap-3">
                         <Mail size={18} />
                         <p className="text-xs font-black uppercase tracking-widest">Believe this is unfair?</p>
                      </div>
                      <p className="text-[10px] font-bold opacity-80 leading-relaxed uppercase tracking-wider">
                         Appeal within 48 hours by emailing support.raiddhosthi@gmail.com with your Email ID, Ride ID, and reason.
                      </p>
                   </div>
                ) : (
                   <div className="bg-slate-100 p-8 rounded-[3rem] text-slate-400 flex items-center justify-center gap-3">
                      <Clock size={16} />
                      <p className="text-[10px] font-black uppercase tracking-widest italic">Appeal window closed or limit reached</p>
                   </div>
                )}

                <button 
                  onClick={() => navigate('/dashboard')}
                  className="mt-8 w-full py-5 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-indigo-600 transition-colors"
                >
                   Return to Dashboard
                </button>
             </div>
          </div>
        )}
        {/* Background Decorative Circles */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-50/50 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-50/50 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>

        <div className="max-w-5xl mx-auto w-full relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center lg:text-left"
          >
             <span className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase mb-4 border border-indigo-100">
               <Sparkles size={14} /> Global Driver Community
             </span>
             <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">
               Post Your <span className="text-indigo-600 italic">Journey.</span>
             </h1>
             <p className="text-slate-600 text-lg font-medium max-w-xl">Share your route, pick verified co-travelers, and split costs safely.</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Form Area */}
            <div className="lg:col-span-2 space-y-8">
               
               {/* Route Section */}
                <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl shadow-indigo-100/50 border border-white relative overflow-visible group z-[30]">
                   <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none rounded-bl-[100px] z-0">
                      <div className="w-full h-full bg-slate-50 group-hover:bg-indigo-50 transition-colors duration-700"></div>
                   </div>
                  <h3 className="text-xl font-black text-slate-800 mb-10 flex items-center gap-4">
                     <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                        <Navigation size={20} />
                     </div>
                     Route Path Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                     <div className="absolute left-1/2 top-11 bottom-11 w-0.5 bg-slate-50 hidden md:block"></div>
                      <LocationSelector
                        label="Pickup Location"
                        placeholder="Vadapalani, Chennai"
                        name="from"
                        autoTrigger={true}
                        value={formData.from}
                        coordinates={formData.fromCoordinates}
                        onChange={(v) => setFormData(p => ({ ...p, from: v }))}
                        onCoordinatesChange={(c) => setFormData(p => ({ ...p, fromCoordinates: c }))}
                      />
                      <LocationSelector
                        label="Destination City"
                        placeholder="Gachibowli, Hyderabad"
                        name="to"
                        icon={NavIcon}
                        value={formData.to}
                        coordinates={formData.toCoordinates}
                        onChange={(v) => setFormData(p => ({ ...p, to: v }))}
                        onCoordinatesChange={(c) => setFormData(p => ({ ...p, toCoordinates: c }))}
                      />
                   </div>
               </div>

               {/* Schedule & Price */}
               <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl shadow-indigo-100/50 border border-white relative z-[20]">
                  <h3 className="text-xl font-black text-slate-800 mb-10 flex items-center gap-4">
                     <div className="h-10 w-10 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-100">
                        <Calendar size={20} />
                     </div>
                     Timing & Pricing
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                     <div className="space-y-4">
                        <label className={labelClass}>Travel Date</label>
                        <div className={inputContainerClass}>
                           <Calendar className={iconClass} />
                            <input 
                              name="date" 
                              type="date" 
                              className="input-field !py-4 pl-12 pr-2 font-bold [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" 
                              value={formData.date} 
                              onChange={handleChange} 
                              onClick={(e) => e.target.showPicker?.()}
                              required 
                            />
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className={labelClass}>Departure Time</label>
                        <div className={inputContainerClass}>
                           <Clock className={iconClass} />
                            <input 
                              name="time" 
                              type="time" 
                              className="input-field !py-4 pl-12 pr-2 font-bold [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" 
                              value={formData.time} 
                              onChange={handleChange} 
                              onClick={(e) => e.target.showPicker?.()}
                              required 
                            />
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className={labelClass}>Available Seats</label>
                        <div className={inputContainerClass}>
                           <Users className={iconClass} />
                            <input name="seatsAvailable" type="number" min="1" max="6" className="input-field !py-4 pl-12 font-bold" value={formData.seatsAvailable} onChange={handleChange} required />
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <label className={labelClass + " mb-0"}>Price Per Co-Rider</label>
                           <button 
                             type="button"
                             onClick={handleAiPredict}
                             disabled={isPredicting || !formData.from || !formData.to}
                             className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[9px] font-black uppercase tracking-widest group ${isPredicting ? 'bg-indigo-50 text-indigo-400 border-indigo-100' : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border-indigo-100 shadow-sm shadow-indigo-100 hover:shadow-indigo-200'}`}
                           >
                              <Sparkles size={12} className={isPredicting ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'} />
                              {isPredicting ? 'Predicting...' : 'Smart Predict'}
                           </button>
                        </div>
                        <div className={inputContainerClass}>
                           <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-600 text-lg pointer-events-none">₹</span>
                            <input name="price" type="number" placeholder="500" className="input-field !py-4 pl-12 font-black text-lg text-indigo-600" value={formData.price} onChange={handleChange} required />
                        </div>
                        <AnimatePresence>
                          {isPredicting ? (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-50/50 rounded-2xl border border-indigo-100"
                            >
                              <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">AI Calculating Fair Fare...</span>
                            </motion.div>
                          ) : prediction && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="px-4 py-3 bg-indigo-600 rounded-2xl border border-indigo-500 shadow-lg shadow-indigo-100"
                            >
                               <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5">
                                     <Sparkles size={10} className="text-indigo-200" />
                                     <span className="text-[9px] font-black text-indigo-100 uppercase tracking-widest">Dynamic Price Engine</span>
                                  </div>
                                  <span className="text-[10px] font-black text-white italic">RECOMMENDED</span>
                               </div>
                               <div className="flex items-baseline gap-2">
                                  <span className="text-lg font-black text-white italic tracking-tight">₹{prediction.min} - ₹{prediction.max}</span>
                                  <span className="text-[9px] font-bold text-indigo-200 uppercase">Per Seat</span>
                               </div>
                                {prediction.reason && (
                                   <p className="text-[8px] font-medium text-indigo-100 mt-1 opacity-80 uppercase leading-none tracking-tight">
                                      {prediction.reason}
                                   </p>
                                )}
                                
                                {/* Price Assessment Section */}
                                {priceAssessment && (
                                   <div className={`mt-3 py-2 px-3 rounded-xl border border-white/20 flex items-center justify-between ${priceAssessment.bg}`}>
                                      <div className="flex items-center gap-1.5 font-black text-[8px] text-white/50 uppercase tracking-tighter">
                                         <Info size={10} />
                                         Market Fit
                                      </div>
                                      <span className={`text-[10px] font-black uppercase italic ${priceAssessment.color}`}>
                                         {priceAssessment.status}
                                      </span>
                                   </div>
                                )}

                                <button 
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, price: Math.round((prediction.min + prediction.max) / 2) }))}
                                  className="w-full mt-3 py-2.5 bg-white text-indigo-900 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl shadow-indigo-900/20 hover:bg-slate-900 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                   <CheckCircle2 size={12} /> Use Recommended Price
                                </button>
                             </motion.div>
                          )}
                        </AnimatePresence>
                     </div>
                     <div className="space-y-4">
                        <label className={labelClass}>Waiting Duration (Mins)</label>
                        <div className={inputContainerClass}>
                           <Clock className={iconClass} />
                           <input name="waitingTime" type="number" min="5" max="60" className="input-field !py-4 pl-14 font-bold" value={formData.waitingTime} onChange={handleChange} required />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 italic ml-1">Time to wait for passengers before starting.</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Side-box: Vehicle & Safety */}
            <div className="space-y-8">
               <div className="bg-slate-900 p-8 md:p-10 rounded-[3.5rem] text-white shadow-2xl shadow-slate-900/40 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-x-12 -translate-y-12"></div>
                  <h3 className="text-xl font-black mb-8 flex items-center gap-4 relative z-10">
                     <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center text-white border border-white/10 backdrop-blur-md">
                        <Car size={20} />
                     </div>
                     Vehicle Specs
                  </h3>
                  <div className="space-y-8 relative z-10">
                     {/* Vehicle Type Toggle */}
                     <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10 mb-2">
                        {['Car', 'Bike'].map((type) => (
                           <button 
                             key={type}
                             type="button"
                             onClick={() => setFormData({...formData, vehicleType: type, seatsAvailable: type === 'Bike' ? 1 : 4})}
                             className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${formData.vehicleType === type ? 'bg-white text-slate-900 shadow-xl' : 'text-white/40 hover:text-white/60'}`}
                           >
                             {type === 'Car' ? <Car size={14} /> : <Bike size={14} />} {type}
                           </button>
                        ))}
                     </div>
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vehicle Model</label>
                        <input name="carModel" type="text" placeholder="e.g. Swift Dzire / Royal Enfield" className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-indigo-500 transition-all font-bold placeholder:text-white/20" value={formData.carModel} onChange={handleChange} required />
                     </div>
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vehicle Plate No.</label>
                        <input name="carNumber" type="text" placeholder="TS 09 AB 1234" className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-indigo-500 transition-all font-bold uppercase tracking-[0.2em] placeholder:text-white/40" value={formData.carNumber} onChange={handleChange} required />
                     </div>
                  </div>
               </div>

               <div className="bg-indigo-600 p-8 md:p-10 rounded-[3.5rem] text-white shadow-2xl shadow-indigo-200 relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-x-12 -translate-y-12 group-hover:scale-125 transition-transform duration-1000"></div>
                  <h3 className="text-xl font-black mb-8 flex items-center gap-4 relative z-10">
                     <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center text-white border border-white/20 backdrop-blur-md">
                        <ShieldCheck size={20} />
                     </div>
                     Safety Mode
                  </h3>
                                    <div className="space-y-6 relative z-10">
                      {user?.gender === 'female' ? (
                         <div className="space-y-4">
                            <div className="bg-white/20 p-4 rounded-2xl border border-white/20 font-black italic text-sm tracking-tight text-center">
                               🛡️ FEATURE LOCKED: FEMALE ONLY
                            </div>
                            <p className="text-[11px] font-bold text-indigo-100/70 leading-relaxed text-center">
                               Your ride is automatically set to female passengers only for maximum safety.
                            </p>
                         </div>
                      ) : (
                         <div className="space-y-4">
                            <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Who can join your ride?</label>
                            <div className="grid grid-cols-1 gap-3">
                               <button
                                 type="button"
                                 onClick={() => setFormData({ ...formData, genderPreference: 'any' })}
                                 className={`p-4 rounded-2xl border-2 text-left transition-all ${formData.genderPreference === 'any' ? 'bg-white border-white shadow-xl shadow-white/10' : 'bg-white/5 border-white/20 hover:border-white/40'}`}
                               >
                                  <p className={`text-sm font-black italic tracking-tight ${formData.genderPreference === 'any' ? 'text-indigo-900' : 'text-white'}`}>Any Gender</p>
                                  <p className={`text-[10px] font-bold mt-1 opacity-70 ${formData.genderPreference === 'any' ? 'text-indigo-700' : 'text-white'}`}>Open to all verified co-riders</p>
                               </button>
                               <button
                                 type="button"
                                 onClick={() => setFormData({ ...formData, genderPreference: 'male-only' })}
                                 className={`p-4 rounded-2xl border-2 text-left transition-all ${formData.genderPreference === 'male-only' ? 'bg-white border-white shadow-xl shadow-white/10' : 'bg-white/5 border-white/20 hover:border-white/40'}`}
                               >
                                  <p className={`text-sm font-black italic tracking-tight ${formData.genderPreference === 'male-only' ? 'text-indigo-900' : 'text-white'}`}>Males Only</p>
                                  <p className={`text-[10px] font-bold mt-1 opacity-70 ${formData.genderPreference === 'male-only' ? 'text-indigo-700' : 'text-white'}`}>Strictly male-only transit pool</p>
                               </button>
                            </div>
                         </div>
                      )}
                   </div>
               </div>

                {/* Professional T&C Section */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-indigo-100/20">
                   <label className="flex items-center gap-4 cursor-pointer group">
                      <input 
                         type="checkbox" 
                         className="hidden" 
                         checked={formData.agreedToPolicy}
                         onChange={(e) => setFormData({...formData, agreedToPolicy: e.target.checked})}
                      />
                      <div className={`h-8 w-8 rounded-xl border-2 transition-all flex items-center justify-center shrink-0 ${formData.agreedToPolicy ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200 group-hover:border-indigo-400'}`}>
                         {formData.agreedToPolicy && <CheckCircle2 className="text-white" size={16} />}
                      </div>
                      <div className="flex-1 text-xs font-black text-slate-700 uppercase tracking-tight italic">
                         I agree to the <button type="button" onClick={() => setShowTerms(true)} className="text-indigo-600 underline hover:text-slate-900 transition-colors">Terms & Conditions</button> and safety protocols.
                      </div>
                   </label>
                </div>

               <button
                  type="submit"
                  disabled={isSubmitting || !formData.agreedToPolicy}
                  className={`w-full p-7 rounded-[2.5rem] font-black text-xl shadow-xl transition-all flex items-center justify-center gap-4 active:scale-95 group ${isSubmitting || !formData.agreedToPolicy ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-slate-900 text-white shadow-indigo-100'}`}
               >
                  {isSubmitting ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      POST JOURNEY
                      <ArrowRight className="h-6 w-6 group-hover:translate-x-2 transition-transform" />
                    </>
                  )}
               </button>
            </div>
          </form>
        </div>
      </main>

      {/* Terms & Conditions Modal */}
      <AnimatePresence>
        {showTerms && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3.5rem] overflow-hidden shadow-2xl relative"
            >
              <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <ShieldAlert className="text-indigo-400" size={24} />
                  <h2 className="text-2xl font-black italic tracking-tight uppercase font-outfit">Safety & Legal Protocol</h2>
                </div>
                <button onClick={() => setShowTerms(false)} className="h-10 w-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-10 max-h-[60vh] overflow-y-auto font-outfit custom-scrollbar">
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="flex gap-4">
                        <Scale className="text-indigo-600 shrink-0" size={20} />
                        <div>
                          <p className="font-black text-slate-900 text-sm uppercase italic">Fair-Play Guarantee</p>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed italic">Cancellations within 30 mins result in an immediate strike and trust score penalty.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <Zap className="text-amber-500 shrink-0" size={20} />
                        <div>
                          <p className="font-black text-slate-900 text-sm uppercase italic">Trust Incentives</p>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed italic">Completion awards +5 Trust points. 10 consecutive trips unlock a +10 streak bonus.</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex gap-4">
                        <History className="text-purple-600 shrink-0" size={20} />
                        <div>
                          <p className="font-black text-slate-900 text-sm uppercase italic">No-Show Liability</p>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed italic">If majority passengers report a no-show, account restriction is applied instantly.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <Globe className="text-emerald-600 shrink-0" size={20} />
                        <div>
                          <p className="font-black text-slate-900 text-sm uppercase italic">Conduct Standards</p>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed italic">ID matching is mandatory. Harassment lead to a permanent community ban.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 italic leading-relaxed text-center uppercase tracking-wider">
                      Official Rider Terms v4.2 • Raid Dosti Ethics Committee
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setShowTerms(false)}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all active:scale-95"
                >
                  Close & Acknowledgement
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Trust Footer */}
      <footer className="py-12 px-6 border-t border-slate-200/60 bg-white">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
               <ShieldCheck className="text-indigo-600" size={24} />
               <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.3em]">Encrypted Driver Data Protection</p>
            </div>
            <div className="flex gap-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">
               <span className="hover:text-indigo-600 cursor-pointer">Insurance Policy</span>
               <span className="hover:text-indigo-600 cursor-pointer">Identity Guidelines</span>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default OfferRide;
