import React from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, ArrowRight, Sparkles, TrendingUp, Ban, AlertTriangle, Star, Clock } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useNotifications } from '../context/NotificationContext';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { driverStats } = useNotifications();

  React.useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin');
    }
  }, [user, navigate]);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.1 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-outfit">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 max-w-6xl mx-auto w-full">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center mb-10 space-y-3"
        >
          <motion.div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 italic mb-4">
            <Sparkles size={12} fill="currentColor" /> Welcome Back
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none italic">
            Hello, <span className="text-indigo-600">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto italic mb-6">
            Where would you like to go today? Choose an option below to get started.
          </p>

          {/* Priority Status Badge */}
          {user?.priorityBadgeExpires && new Date(user.priorityBadgeExpires) > new Date() && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               className="inline-flex items-center gap-6 bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-6 rounded-[2.5rem] shadow-2xl shadow-indigo-200 border border-white/10 group overflow-hidden relative"
            >
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
               <div className="h-16 w-16 bg-indigo-600/30 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/10 group-hover:rotate-12 transition-transform duration-500">
                  <Star fill="#818cf8" size={28} className="text-indigo-400" />
               </div>
               <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 leading-none">Status: Priority Elite</p>
                    <div className="h-1.5 w-10 bg-indigo-500 rounded-full animate-pulse"></div>
                  </div>
                  <h3 className="text-2xl font-black tracking-tight italic uppercase leading-none mb-2">Priority Passenger</h3>
                  <p className="text-indigo-200/60 font-medium text-[10px] uppercase tracking-widest italic">
                    Expiring: {new Date(user.priorityBadgeExpires).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
               </div>
               <div className="hidden md:flex flex-col items-start gap-3 border-l border-white/10 pl-6 ml-4">
                  <div className="space-y-1">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest block italic">Active Advantage</span>
                    <span className="text-[10px] font-black text-emerald-400 italic flex items-center gap-1">
                      <TrendingUp size={10} /> AUTOMATIC JUSTICE SUBSIDY
                    </span>
                  </div>
                  <Link 
                    to="/priority-benefits" 
                    className="flex items-center gap-2 text-[10px] font-black text-indigo-400 hover:text-white transition-colors uppercase tracking-[0.2em] group/link"
                  >
                    See Benefits <ArrowRight size={12} className="group-hover/link:translate-x-1 transition-transform" />
                  </Link>
               </div>
            </motion.div>
          )}
        </motion.div>
        
        {/* Account Restricted Status — JUSTICE SYTEM FEEDBACK */}
        {user?.restrictedUntil && new Date(user.restrictedUntil) > new Date() && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-12 px-4"
          >
             <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-rose-100 shadow-2xl shadow-rose-50/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12 text-center md:text-left">
                   <div className="shrink-0 relative">
                      <div className="h-20 w-20 md:h-24 md:w-24 bg-rose-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-rose-200 border-4 border-white rotate-3 group-hover:rotate-6 transition-transform mx-auto">
                         <Ban size={40} />
                      </div>
                      <div className="absolute -bottom-2 -center-x md:-right-2 h-8 w-8 bg-white rounded-xl shadow-lg flex items-center justify-center border border-rose-100">
                         <Clock size={16} className="text-rose-600 animate-pulse" />
                      </div>
                   </div>

                   <div className="flex-1">
                      <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-rose-100">
                         <AlertTriangle size={12} /> RESTRICTION PROTOCOL ACTIVE
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter italic mb-4 uppercase">Transit <span className="text-rose-600">Locked</span></h2>
                      <p className="text-slate-500 font-medium text-sm md:text-base max-w-2xl leading-relaxed italic mb-8">
                         {user.restrictionReason || "Your account has been restricted following a policy violation. We uphold a strict promptness policy to ensure communal safety and trust."}
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-slate-50">
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Restore Date</p>
                            <p className="text-base font-black text-slate-900">{new Date(user.restrictedUntil).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto Unlock</p>
                            <p className="text-base font-black text-slate-900">{new Date(user.restrictedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                         </div>
                         <div className="col-span-2 md:col-span-1 space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Remaining</p>
                            <p className="text-base font-black text-rose-600 italic">
                               {Math.ceil((new Date(user.restrictedUntil) - new Date()) / (1000 * 60 * 60))} Hours Left
                            </p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </motion.div>
        )}

        {/* Driver awareness stats summary */}
        {driverStats?.activeRidesCount > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-12 px-2"
          >
             <Link to="/my-rides" className="block group">
                <div className="bg-indigo-600 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-200 group-hover:bg-slate-900 transition-colors duration-500">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                   <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8 text-center lg:text-left">
                      <div className="space-y-2">
                         <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-60 mb-2 justify-center lg:justify-start">
                            <TrendingUp size={14} /> Active Transit Status
                         </div>
                         <h2 className="text-2xl md:text-3xl font-black italic">Manage Your <span className="text-indigo-200">Active Rides</span></h2>
                         <p className="text-indigo-100 font-medium max-w-md">You have {driverStats.activeRidesCount} active rides with {driverStats.totalBookingsCount} confirmed passengers.</p>
                      </div>
                      <div className="flex gap-4">
                         <div className="bg-white/10 backdrop-blur-sm px-6 py-4 rounded-3xl border border-white/10 text-center min-w-[120px]">
                            <p className="text-2xl font-black">{driverStats.activeRidesCount}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Rides</p>
                         </div>
                         <div className="bg-white/10 backdrop-blur-sm px-6 py-4 rounded-3xl border border-white/10 text-center min-w-[120px]">
                            <p className="text-2xl font-black">{driverStats.totalBookingsCount}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Passengers</p>
                         </div>
                      </div>
                      <div className="bg-white text-indigo-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-900/20 flex items-center gap-2 group-hover:gap-4 transition-all whitespace-nowrap">
                         View Roster <ArrowRight size={16} />
                      </div>
                   </div>
                </div>
             </Link>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          <Link to="/find-rides" className="group">
            <motion.div
              variants={cardVariants}
              whileHover={{ y: -10, transition: { duration: 0.2 } }}
              className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col h-full relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[4rem] -translate-y-4 translate-x-4 group-hover:bg-indigo-600 transition-colors duration-500"></div>
              <div className="h-20 w-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-10 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                <Search size={36} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tighter italic">Find a Ride</h3>
              <p className="text-slate-500 font-medium italic opacity-80 mb-10">Search and join verified rides in your city.</p>
              <div className="mt-auto flex items-center gap-3 text-indigo-600 font-black text-xs uppercase tracking-widest italic group-hover:gap-5 transition-all">
                Search Now <ArrowRight size={16} />
              </div>
            </motion.div>
          </Link>

          <Link to="/offer-ride" className="group text-white">
            <motion.div
              variants={cardVariants}
              whileHover={{ y: -10, transition: { duration: 0.2 } }}
              className="bg-slate-900 p-10 rounded-[3rem] shadow-xl shadow-slate-900/20 border border-slate-800 flex flex-col h-full relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-[4rem] -translate-y-4 translate-x-4 group-hover:bg-indigo-600 transition-colors duration-500"></div>
              <div className="h-20 w-20 bg-white/10 text-white rounded-2xl flex items-center justify-center mb-10 group-hover:bg-indigo-600 transition-all duration-500">
                <MapPin size={36} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black mb-4 tracking-tighter italic">Offer a Ride</h3>
              <p className="text-slate-400 font-medium italic opacity-80 mb-10">Register your route and earn while you commute.</p>
              <div className="mt-auto flex items-center gap-3 text-indigo-400 font-black text-xs uppercase tracking-widest italic group-hover:gap-5 transition-all">
                Start Offering <ArrowRight size={16} />
              </div>
            </motion.div>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
