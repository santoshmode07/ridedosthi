import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Clock, Key, AlertCircle, CheckCircle2, Lock, Sparkles, Fingerprint } from 'lucide-react';

const OTPDisplay = ({ booking, ride }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const dateStr = new Date(ride.date).toISOString().split('T')[0];
      const departureTime = new Date(`${dateStr}T${ride.time}`);
      const otpTime = new Date(departureTime.getTime() - 5 * 60 * 1000);
      
      const diff = Math.max(0, Math.floor((otpTime - now) / 1000));
      setTimeLeft(diff);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [ride.date, ride.time]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ARRIVED STATE (SUCCESS)
  if (booking.boardingStatus === 'arrived') return (
     <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl flex items-center gap-4 w-full"
     >
        <div className="h-8 w-8 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-200">
           <CheckCircle2 size={16} />
        </div>
        <div className="flex-1 min-w-0">
           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Boarding Pass Used</p>
           <p className="text-sm font-black text-slate-800 uppercase italic truncate">Welcome Aboard</p>
        </div>
     </motion.div>
  );

  // MISSED STATE
  if (booking.boardingStatus === 'not_arrived') return (
    <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-rose-50 border border-rose-100 p-3 rounded-2xl flex items-center justify-between w-full"
    >
       <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-rose-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-200">
             <AlertCircle size={16} />
          </div>
          <div>
             <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1">Time Expired</p>
             <p className="text-sm font-black text-slate-800 uppercase italic">Journey Missed</p>
          </div>
       </div>
       {booking.paymentMethod === 'online' && (
          <span className="bg-emerald-100 px-3 py-1 rounded-lg text-[10px] font-black text-emerald-700 uppercase italic border border-emerald-200 shadow-sm shrink-0">Refunded</span>
       )}
    </motion.div>
 );

  // WAITING STATE
  if (timeLeft > 0 && !booking.otp) return (
     <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center gap-4 w-full overflow-hidden">
        <div className="h-10 w-10 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/30 shrink-0 shadow-lg shadow-indigo-500/10">
           <Clock size={20} className="animate-pulse" />
        </div>
        <div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Secure Protocol</p>
           <p className="text-sm font-black text-white uppercase italic tracking-widest whitespace-nowrap">Code in {formatTime(timeLeft)}</p>
        </div>
     </div>
  );

  // ACTIVE OTP STATE - Compact & Professional
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-indigo-600 rounded-2xl p-4 shadow-xl shadow-indigo-100 flex flex-col gap-4 w-full"
    >
       {/* Instruction Header */}
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="h-6 w-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                <ShieldCheck size={14} />
             </div>
             <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest italic">Boarding Authorization</h4>
          </div>
          <p className="hidden md:block text-[9px] font-bold text-slate-400 uppercase italic tracking-widest">Entry Verification Needed</p>
       </div>

       {/* Digits row */}
       <div className="flex items-center justify-between gap-1.5 w-full">
          {booking.otp && booking.otp.split('').map((char, index) => (
             <motion.div 
               key={index} 
               initial={{ opacity: 0, y: 5 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: index * 0.05 }}
               className="flex-1 h-12 md:h-14 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shadow-inner group hover:bg-slate-100 transition-colors"
             >
                <span className="text-2xl md:text-3xl font-black text-indigo-600 tabular-nums italic drop-shadow-sm">{char}</span>
             </motion.div>
          ))}
       </div>

       {/* Dynamic help text */}
       <div className="pt-1 mt-1 border-t border-slate-50 flex items-center justify-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex items-center gap-2 italic">
             <Fingerprint size={12} className="text-indigo-400 opacity-50" /> 
             Reveal to driver upon vehicle entry only
          </p>
       </div>
    </motion.div>
  );
};

export default OTPDisplay;
