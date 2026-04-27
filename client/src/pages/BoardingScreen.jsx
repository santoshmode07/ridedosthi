import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Clock, CheckCircle2, AlertTriangle, 
  ChevronLeft, Loader2, ShieldCheck, Lock, 
  User, CheckCircle, Navigation, Wallet, Banknote, CreditCard
} from 'lucide-react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import { toast } from 'react-toastify';
import PassengerOTPCard from '../components/PassengerOTPCard';
import MarkArrivedButton from '../components/MarkArrivedButton';

const BoardingScreen = () => {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [boardingData, setBoardingData] = useState(null);

  const fetchBoardingData = async () => {
    try {
      const { data } = await api.get(`/otp/boarding/${rideId}`);
      if (data.success) {
        setBoardingData(data.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch boarding data');
      navigate('/my-rides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoardingData();
    const interval = setInterval(fetchBoardingData, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, [rideId]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <Loader2 className="h-16 w-16 animate-spin text-indigo-600 mb-6" />
      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Opening Boarding Gate...</p>
    </div>
  );

  if (!boardingData) return null;

  const { rideFrom, rideTo, departureTime, rideDate, waitingTime, passengers, timeRemaining, verifiedCount, totalCount } = boardingData;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-24">
        {/* Header Section */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <button 
              onClick={() => navigate(`/my-rides`)}
              className="group flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-[10px] uppercase tracking-widest mb-3 transition-colors"
            >
              <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back
            </button>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1 italic">Boarding <span className="text-indigo-600">Gate.</span></h1>
            <p className="text-[11px] text-slate-500 font-bold flex items-center gap-2 uppercase tracking-tight">
              {rideFrom.split(',')[0]} <Navigation size={12} className="text-indigo-400" /> {rideTo.split(',')[0]}
              <span className="text-slate-300 mx-1">|</span>
              <span className="text-slate-700 italic">{departureTime}</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded-3xl shadow-xl shadow-indigo-100/50 border border-slate-100 flex items-center px-8">
            <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Boarding verified</p>
              <div className="text-xl font-black text-emerald-500 tabular-nums italic">
                {verifiedCount} <span className="text-slate-300">/</span> {totalCount}
              </div>
            </div>
          </div>
        </header>

        {/* Boarding Status Banner */}
        {timeRemaining === 0 ? (
          <div className="bg-rose-600 rounded-[2rem] p-6 text-white shadow-xl shadow-rose-200 mb-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <Lock size={24} />
               <div>
                  <h3 className="text-lg font-black uppercase tracking-tight italic">Boarding Window Closed</h3>
                  <p className="text-xs font-bold text-rose-100">Unverified passengers will be automatically marked as not arrived.</p>
               </div>
            </div>
          </div>
        ) : (
          <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-200 mb-10 flex items-center gap-4">
             <ShieldCheck size={24} className="animate-bounce" />
             <div>
                <h3 className="text-lg font-black uppercase tracking-tight italic">Boarding Active</h3>
                <p className="text-xs font-bold text-indigo-100 italic">Enter the 6-digit OTP shown on the passenger's screen to verify boarding.</p>
             </div>
          </div>
        )}

        {/* Passenger List */}
        <div className="space-y-6 mb-12">
          {passengers.map((p, idx) => (
            <PassengerOTPCard 
              key={idx} 
              passenger={p} 
              rideId={rideId} 
              onVerified={fetchBoardingData} 
              windowClosed={timeRemaining === 0}
            />
          ))}
        </div>

        {/* Action Button */}
        <div className="sticky bottom-10 z-[200]">
           <MarkArrivedButton 
             rideId={rideId} 
             departureTime={departureTime}
             rideDate={rideDate}
             waitingTime={waitingTime}
             verifiedCount={verifiedCount}
             totalCount={totalCount}
             onComplete={() => navigate('/my-rides')}
           />
        </div>

        <div className="mt-12 text-center max-w-sm mx-auto">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
             Security Protocol: OTP verification ensures you get paid for every passenger you safely pick up. 
             Unverified passengers are refunded automatically when the journey starts.
           </p>
        </div>
      </main>
    </div>
  );
};

export default BoardingScreen;
