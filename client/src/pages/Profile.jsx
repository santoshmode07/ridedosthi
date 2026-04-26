import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { 
  LogOut, LayoutDashboard, User, ShieldCheck, 
  MapPin, IdCard, Mail, Phone, Fingerprint,
  Award, Star, Shield, Settings, ChevronRight,
  AlertTriangle, History, Zap, Ban, Wallet, CreditCard, ArrowUpRight,
  DollarSign, IndianRupee, Eye, EyeOff, RefreshCw, AlertCircle, X,
  Save, Key, UserCircle, Camera, Upload, Clock, Trash2, 
  MessageSquare, Navigation, Sparkles
} from 'lucide-react';

import Navbar from '../components/Navbar';
import AddMoneyModal from '../components/AddMoneyModal';
import WithdrawMoneyModal from '../components/WithdrawMoneyModal';

const EditProfileModal = ({ show, onClose, user, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    gender: user?.gender?.toLowerCase() || '',
    password: '',
    profilePhoto: user?.profilePhoto || ''
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // PLACE YOUR IMGBB API KEY HERE OR IN .env AS VITE_IMGBB_API_KEY
  const IMGBB_API_KEY = "65a6fa2791e0f75b77489cf91b85cdd6"; 

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        phone: user.phone || '',
        gender: user.gender?.toLowerCase() || '',
        password: '',
        profilePhoto: user.profilePhoto || ''
      });
    }
  }, [user]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return toast.error('File size must be less than 2MB');
    }

    setUploading(true);
    const uploadData = new FormData();
    uploadData.append('image', file);

    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: uploadData
      });
      const data = await response.json();
      
      if (data.success) {
        setFormData(prev => ({ ...prev, profilePhoto: data.data.url }));
        toast.success('Identity Optic Captured');
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Image Upload Error:', error);
      toast.error('Identity Optic Upload Failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Ensure gender is sent as lowercase to match model enum
      const submitData = {
        ...formData,
        gender: formData.gender.toLowerCase()
      };
      
      const { data } = await api.put('/auth/profile', submitData);
      if (data.success) {
        toast.success('Core Profile Synchronized');
        onUpdate();
        onClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Platform Synchronization Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-10 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">HQ <span className="text-indigo-600">Dossier</span></h2>
              <button 
                onClick={onClose}
                className="h-10 w-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Profile Photo Section */}
            <div className="flex flex-col items-center mb-10">
               <div className="relative group">
                  <div className="h-40 w-40 rounded-[2.5rem] overflow-hidden bg-white border-4 border-white shadow-2xl flex items-center justify-center ring-8 ring-slate-50 transition-all duration-700 hover:rotate-3" style={{ isolation: 'isolate' }}>
                     {formData.profilePhoto ? (
                        <img 
                          src={formData.profilePhoto} 
                          alt="Profile" 
                          className="h-full w-full object-cover hd-profile rounded-[2.2rem]" 
                          loading="lazy"
                          onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=' + formData.name + '&background=random'; }}
                        />
                     ) : (
                        <UserCircle size={80} className="text-slate-200" />
                     )}
                     {uploading && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-md flex items-center justify-center z-20">
                           <RefreshCw size={32} className="animate-spin text-indigo-600" />
                        </div>
                     )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 flex flex-col gap-2">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-10 w-10 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                    >
                       <Camera size={18} />
                    </button>
                    {formData.profilePhoto && (
                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, profilePhoto: '' }))}
                        className="h-10 w-10 bg-rose-500 text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                      >
                         <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*"
                  />
               </div>
               <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Identity Optic Scan</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Full Name</label>
                <div className="relative group">
                  <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter full name"
                    className="w-full bg-slate-50 border border-slate-100 py-4 pl-12 pr-4 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all cursor-text"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Gender Authority</label>
                  <select 
                    value={formData.gender}
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 py-4 px-6 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all cursor-pointer"
                    required
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Comm ID</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={16} />
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      placeholder="Phone"
                      className="w-full bg-slate-50 border border-slate-100 py-4 pl-10 pr-4 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Security Key (Optional)</label>
                <div className="relative group">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                  <input 
                    type="password" 
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="Reset security key"
                    className="w-full bg-slate-50 border border-slate-100 py-4 pl-12 pr-4 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <p className="text-[9px] font-medium text-slate-400 italic pl-2">Leave blank to retain current protocols</p>
              </div>

              <button 
                type="submit" 
                disabled={loading || uploading}
                className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50 mt-4 group"
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} className="group-hover:scale-125 transition-transform" />}
                {loading ? 'Synchronizing...' : 'Authorize Updates'}
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const Profile = () => {
  const { user, refreshUser } = useAuth();
  const [showTopUp, setShowTopUp] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(user?.walletBalance || 0);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchWalletData = async () => {
     try {
        const { data } = await api.get('/payments/wallet/statement');
        if (data.success) {
           setTransactions(data.transactions);
           setBalance(data.balance);
        }
     } catch (error) {
        console.error('Failed to fetch wallet status');
     }
  };

  const fetchReviews = async (page = 1, append = false) => {
     try {
        if (!append) setReviewsLoading(true);
        else setLoadingMore(true);

        const { data } = await api.get(`/reviews/${user._id}?page=${page}&limit=10`);
        if (data.success) {
           setReviews(prev => append ? [...prev, ...data.reviews] : data.reviews);
           setHasMoreReviews(data.hasMore);
           setReviewsPage(data.currentPage);
        }
     } catch (error) {
        console.error('Failed to fetch reviews');
     } finally {
        setReviewsLoading(false);
        setLoadingMore(false);
     }
  };

  useEffect(() => {
     fetchWalletData();
     fetchReviews();
  }, [user._id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchWalletData(), fetchReviews()]);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const getTrustScoreInfo = (score) => {
    if (score >= 90) return { color: 'text-emerald-600 bg-emerald-50 border-emerald-100', label: 'Highly Reliable' };
    if (score >= 70) return { color: 'text-amber-600 bg-amber-50 border-amber-100', label: 'Generally Reliable' };
    if (score >= 50) return { color: 'text-orange-600 bg-orange-50 border-orange-100', label: 'Rides with Caution' };
    return { color: 'text-rose-600 bg-rose-50 border-rose-100', label: 'Unreliable' };
  };

  const stats = user?.role === 'admin' ? [
    { label: 'Security Clearance', value: 'Level 5', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Incidents Settled', value: user?.settledDisputes || 0, icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Platform Trust', value: 'Optimal', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Auth Level', value: 'Admin', icon: Fingerprint, color: 'text-purple-600', bg: 'bg-purple-50' }
  ] : [
    { label: 'Trust Score', value: user?.trustScore || 100, icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Trips Completed', value: user?.totalCompletedRides || 0, icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Average Rating', value: user?.averageRating?.toFixed(1) || 5.0, icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Verified Feedback', value: user?.totalRatings || 0, icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50' }
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex flex-col font-outfit selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />

      {/* Profile Content */}
      <main className="flex-1 pt-32 pb-24 px-6 max-w-5xl mx-auto w-full">
         <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="bg-white rounded-[4rem] shadow-2xl shadow-indigo-100/30 border border-slate-100 overflow-hidden"
         >
            {/* Header Banner */}
            <div className="h-48 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 relative">
               <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]"></div>
               <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent"></div>
            </div>

            {/* Profile Info Overlay */}
            <div className="px-10 md:px-16 pb-16 relative -mt-24">
               <div className="flex flex-col md:flex-row items-end gap-8 mb-12">
                  <div className="relative group">
                     <div className="h-44 w-44 rounded-[3.5rem] bg-white flex items-center justify-center text-white text-6xl font-black shadow-2xl shadow-indigo-100 ring-[12px] ring-white overflow-hidden transition-transform duration-700 hover:scale-105">
                        {user?.profilePhoto ? (
                           <img 
                            src={user.profilePhoto} 
                            alt="Profile" 
                            className="h-full w-full object-cover hd-profile rounded-[3rem]" 
                            loading="lazy"
                            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=' + user.name + '&background=random'; }}
                           />
                        ) : (
                           <div className="h-full w-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center">
                              {user?.name?.charAt(0)}
                           </div>
                        )}
                     </div>
                     <div className="absolute bottom-2 right-2 h-14 w-14 bg-white rounded-2xl flex items-center justify-center ring-[6px] ring-white shadow-lg">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black ${getTrustScoreInfo(user?.trustScore).color}`}>
                           {user?.trustScore}
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex-1 pb-2">
                     <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 italic">@{user?.name.replace(/\s/g, '').toLowerCase()}</h1>
                     <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200/50">
                           <User size={14} className="text-slate-500" />
                           <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest leading-none capitalize">{user?.gender} Member</span>
                        </div>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-black text-[11px] uppercase tracking-widest leading-none ${getTrustScoreInfo(user?.trustScore).color}`}>
                           <Shield size={14} />
                           {getTrustScoreInfo(user?.trustScore).label}
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-4">
                     <button 
                        onClick={() => setShowEditProfile(true)}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-xl shadow-indigo-100 flex items-center gap-3 group"
                     >
                        <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
                        Edit Profile
                     </button>
                     {user?.role === 'admin' && (
                          <Link 
                            to="/admin"
                            className="px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-xl flex items-center gap-3 group"
                          >
                             <LayoutDashboard size={18} />
                             Admin Console
                          </Link>
                       )}
                  </div>
               </div>

                {/* Wallet & Stats — JUSTICE ECONOMY */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                   {/* Main Wallet Card */}
                   <motion.div 
                     whileHover={{ y: -8, scale: 1.01 }}
                     whileTap={{ scale: 0.98 }}
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="lg:col-span-1 bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200 group cursor-default"
                   >
                      <div className={`absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-400/30 transition-all duration-700 ${isRefreshing ? 'animate-pulse scale-150' : ''}`}></div>
                      
                      <div className="relative z-10 flex flex-col h-full justify-between">
                         <div>
                            <div className="flex items-center justify-between mb-8">
                               <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                                  <Wallet size={24} className="text-indigo-400" />
                               </div>
                               <div className="flex gap-2">
                                  <button 
                                    onClick={() => setShowBalance(!showBalance)}
                                    className="h-10 w-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-colors text-white/40 hover:text-white"
                                  >
                                     {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
                                  </button>
                                  <button 
                                    onClick={handleRefresh}
                                    className={`h-10 w-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-colors text-white/40 hover:text-white ${isRefreshing ? 'animate-spin' : ''}`}
                                  >
                                     <RefreshCw size={18} />
                                  </button>
                               </div>
                            </div>
                            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Available Funds</p>
                            <h2 className={`text-5xl font-black tracking-tighter italic flex items-start ${balance < 0 ? 'text-rose-500' : ''}`}>
                               <span className={`text-2xl mt-1.5 mr-1 not-italic opacity-50 ${balance < 0 ? 'text-rose-400' : ''}`}>₹</span>
                               {showBalance ? balance : '••••••'}
                            </h2>
                            {balance < 0 && (
                               <div className="flex items-center gap-2 mt-2 text-rose-400">
                                  <AlertTriangle size={12} />
                                  <span className="text-[9px] font-black uppercase tracking-widest">Clear Negative Balance</span>
                               </div>
                            )}
                         </div>

                         {/* Mini Ledger Peek — Interactive bit */}
                         <div className="flex-1 my-6 space-y-3 opacity-80 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center justify-between">
                               <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400/60">Recent Activity</p>
                               <Link to="/wallet-history" className="text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-colors">View All</Link>
                            </div>
                            {transactions.length > 0 ? (
                               transactions.slice(0, 2).map((t, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-[11px] font-bold">
                                     <span className="text-white/60 truncate mr-4 italic">"{t.description}"</span>
                                     <span className={t.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                        {t.amount > 0 ? '+' : ''}{t.amount}
                                     </span>
                                  </div>
                               ))
                            ) : (
                               <p className="text-[10px] italic text-white/30">No recent transactions</p>
                            )}
                         </div>
                         
                         <div className="mt-4 flex flex-col gap-3">
                            <div className="flex gap-3">
                               <button 
                                 onClick={() => setShowTopUp(true)}
                                 className={`flex-1 ${balance < 0 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-white hover:text-indigo-600'} text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2`}
                               >
                                  <CreditCard size={14} /> Add Money
                               </button>
                               <Link 
                                  to="/wallet-history"
                                  className="h-12 w-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-colors text-indigo-300 group/arrow shrink-0"
                               >
                                  <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                               </Link>
                            </div>
                            <button 
                              onClick={() => setShowWithdraw(true)}
                              className="w-full bg-slate-900/50 hover:bg-rose-600 border border-white/10 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                               <ArrowUpRight size={14} className="rotate-180" /> Request Withdrawal
                            </button>
                         </div>
                      </div>
                   </motion.div>

                   {stats.length > 0 && (
                      <div className="lg:col-span-2 grid grid-cols-2 gap-6">
                         {stats.map((stat, i) => (
                            <motion.div 
                              key={i}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between hover:shadow-xl hover:shadow-indigo-50 transition-all group"
                            >
                               <div className={`${stat.bg} ${stat.color} h-12 w-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                  <stat.icon size={22} />
                               </div>
                               <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                  <p className="text-2xl font-black text-slate-800 tracking-tighter italic">{stat.value}</p>
                               </div>
                            </motion.div>
                         ))}
                      </div>
                   )}

                   {/* Load More Reviews Button */}
                   {hasMoreReviews && !reviewsLoading && (
                      <div className="mt-12 text-center">
                         <button 
                           onClick={() => fetchReviews(reviewsPage + 1, true)}
                           disabled={loadingMore}
                           className="bg-slate-50 border border-slate-200 text-slate-600 px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm flex items-center gap-3 mx-auto disabled:opacity-50"
                         >
                            {loadingMore ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                            {loadingMore ? 'SYNCING DATA...' : 'LOAD MORE EXPERIENCES'}
                         </button>
                      </div>
                   )}
                </div>

                {/* Priority Status — Justice Reward */}
                {user?.priorityBadgeExpires && new Date(user.priorityBadgeExpires) > new Date() && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-12 bg-gradient-to-r from-indigo-600 to-indigo-900 p-8 rounded-[3rem] text-white flex items-center justify-between shadow-2xl shadow-indigo-200 border border-indigo-400 relative overflow-hidden group"
                  >
                     <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-x-12 -translate-y-12"></div>
                     <div className="flex items-center gap-6 relative z-10">
                        <div className="h-16 w-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 animate-pulse text-indigo-200">
                           <Award size={32} />
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300 mb-1">Active Reward Protocol</p>
                           <h3 className="text-2xl font-black italic tracking-tighter">Priority Search <span className="text-indigo-200 uppercase">Unlocked</span></h3>
                           <p className="text-indigo-100/60 text-xs font-medium italic mt-1">Valid until {new Date(user.priorityBadgeExpires).toLocaleDateString()} — <Link to="/priority-benefits" className="text-white underline font-black ml-1">See Benefits</Link></p>
                        </div>
                     </div>
                     <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/10 text-center relative z-10">
                        <Star className="text-amber-400 fill-amber-400 mx-auto mb-1" size={16} />
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/80 leading-none">VIP Access</p>
                     </div>
                  </motion.div>
                )}

               {/* Penalty & History Dashboard (New) */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                  <div className="bg-rose-50/50 p-8 rounded-[3rem] border border-rose-100/50 flex items-center gap-6">
                     <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center text-rose-600 shadow-sm border border-rose-100">
                        <AlertTriangle size={24} />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Warning Count</p>
                        <p className="text-2xl font-black text-rose-600">{user?.warnings || 0} / 3</p>
                     </div>
                  </div>
                  <div className="bg-slate-900 p-8 rounded-[3rem] text-white flex items-center gap-6 shadow-2xl shadow-slate-200">
                     <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center text-rose-400 backdrop-blur-md border border-white/10">
                        <Zap size={24} />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Strikes</p>
                        <p className="text-2xl font-black text-rose-500">{user?.strikes || 0} STRIKES</p>
                     </div>
                  </div>
                  <div className={`p-8 rounded-[3rem] flex items-center gap-6 border-2 transition-all ${user?.restrictedUntil && new Date(user.restrictedUntil) > new Date() ? 'bg-rose-600 text-white border-rose-600 shadow-xl shadow-rose-200' : 'bg-slate-50 border-slate-100 opacity-40'}`}>
                     <div className={`h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center ${user?.restrictedUntil && new Date(user.restrictedUntil) > new Date() ? 'text-white' : 'text-slate-300'}`}>
                        <Ban size={24} />
                     </div>
                     <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${user?.restrictedUntil && new Date(user.restrictedUntil) > new Date() ? 'text-rose-100' : 'text-slate-400'}`}>Restricted Status</p>
                        <p className="text-sm font-black italic">{user?.restrictedUntil && new Date(user.restrictedUntil) > new Date() ? 'ACCOUNT BLOCKED' : 'NO RESTRICTIONS'}</p>
                     </div>
                  </div>
               </div>

               {/* Appeal System — Justice Dashboard */}
               {user?.strikes > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-12 bg-indigo-50/50 p-8 md:p-12 rounded-[3.5rem] border border-indigo-100 relative overflow-hidden group"
                  >
                     <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000"></div>
                     
                     <div className="flex flex-col md:flex-row gap-10 relative z-10">
                        <div className="flex-1">
                           <div className="flex items-center gap-4 mb-6">
                              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                                 <Shield size={24} />
                              </div>
                              <h3 className="text-2xl font-black text-slate-800 tracking-tight italic">Justice Appeal Portal</h3>
                           </div>
                           
                           {user.appealCount >= 2 ? (
                              <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 flex items-center gap-4">
                                 <Ban className="text-rose-500" size={20} />
                                 <p className="text-sm font-black text-rose-600 uppercase tracking-widest">Appeal limit reached for this year (Max 2)</p>
                              </div>
                           ) : (user.lastStrikeAt && (new Date() - new Date(user.lastStrikeAt)) > 48 * 60 * 60 * 1000) ? (
                              <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200 flex items-center gap-4">
                                 <Clock className="text-slate-400" size={20} />
                                 <p className="text-sm font-black text-slate-500 uppercase tracking-widest italic">Appeal window has closed (48h expired)</p>
                              </div>
                           ) : (
                              <div className="space-y-6">
                                 <p className="text-slate-600 font-medium leading-relaxed italic">
                                    Believe your strike was unfair? Our safety team manually reviews appeals within 24 hours.
                                 </p>
                                 <div className="bg-white p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[.2em] mb-4">How to Appeal</p>
                                    <div className="space-y-4 font-bold text-slate-800 italic">
                                       <div className="flex items-center gap-4 group/mail cursor-pointer">
                                          <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover/mail:scale-110 transition-transform">
                                             <Mail size={18} />
                                          </div>
                                          <p className="text-lg tracking-tight">support.raiddhosthi@gmail.com</p>
                                       </div>
                                       <div className="pl-14 space-y-2">
                                          <p className="flex items-center gap-3 text-xs text-slate-500 uppercase tracking-widest"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span> Include Registered Email: {user.email}</p>
                                          <p className="flex items-center gap-3 text-xs text-slate-500 uppercase tracking-widest"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span> Attach Ride ID & Clear Explanation</p>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>
                        
                        <div className="md:w-64 bg-white/40 backdrop-blur-md rounded-[2.5rem] p-8 border border-white flex flex-col justify-center items-center text-center">
                           <Award className="text-indigo-400 mb-4" size={40} />
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fairness Guarantee</p>
                           <p className="text-xs font-bold text-slate-600 italic">Every appeal is reviewed by a human team member.</p>
                        </div>
                     </div>
                  </motion.div>
               )}

               {/* Details Sections */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="bg-white p-8 rounded-[3rem] border border-slate-100">
                     <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-4">
                        <Fingerprint className="text-indigo-600" /> Digital Credentials
                     </h3>
                     <div className="space-y-6">
                        <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors group">
                           <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shadow-inner">
                              <Mail size={18} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                              <p className="text-slate-700 font-bold italic">{user?.email}</p>
                           </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors group">
                           <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shadow-inner">
                              <Phone size={18} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Comm ID</p>
                              <p className="text-slate-700 font-bold italic">{user?.phone || 'Not Connected'}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="bg-white p-8 rounded-[3rem] border border-slate-100">
                     <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-4 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                        <IdCard className="text-indigo-600" /> Government Verification
                     </h3>
                     <div className="space-y-6">
                        <div className="bg-indigo-50/30 p-6 rounded-[2rem] border border-indigo-100/50">
                           <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[.2em]">License Plate Vault</p>
                              <ShieldCheck size={14} className="text-indigo-600" />
                           </div>
                           <p className="text-xl font-black text-slate-800 tracking-wider break-all italic">{user?.licenseNumber || 'VERIFIED_USER'}</p>
                        </div>
                        <div className="flex items-center justify-between px-4">
                           <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aadhaar Key</span>
                           <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">ENCRYPTED</span>
                        </div>
                     </div>
                  </div>
               </div>

               {/* ⭐ Verified Human Reviews — Phase 5 Discovery */}
               <div className="mt-20">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                     <div className="space-y-2">
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">
                           What people say about <span className="text-indigo-600 underline decoration-indigo-200 decoration-4 underline-offset-8">{user?.name.split(' ')[0]}</span>
                        </h2>
                        <div className="flex items-center gap-3 ml-1">
                           <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[.3em]">
                              {reviews.length} Verified Experience Logs
                           </p>
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-6 py-3 rounded-2xl">
                        <Star className="text-amber-500 fill-amber-500" size={16} />
                        <span className="text-xl font-black text-slate-800 italic">{user?.averageRating?.toFixed(1) || '5.0'}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 border-l border-slate-200">Global Rating</span>
                     </div>
                  </div>

                  {reviewsLoading ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[1, 2].map(i => (
                           <div key={i} className="h-48 bg-slate-50/50 rounded-[3rem] animate-pulse border border-slate-100"></div>
                        ))}
                     </div>
                  ) : reviews.length === 0 ? (
                     <div className="bg-slate-50/30 rounded-[3.5rem] border-2 border-dashed border-slate-100 p-20 text-center flex flex-col items-center">
                        <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                           <MessageSquare className="animate-bounce" size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-400 tracking-tighter uppercase italic">No reviews yet</h3>
                        <p className="text-xs font-medium text-slate-300 italic mt-1 uppercase tracking-widest">Completed journeys will appear here as feedback</p>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {reviews.map((rev) => (
                           <motion.div
                             key={rev._id}
                             whileHover={{ y: -8 }}
                             className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-indigo-100/10 hover:shadow-indigo-100/30 transition-all group relative overflow-hidden"
                           >
                              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-bl-full -translate-y-8 translate-x-8 group-hover:translate-y-0 group-hover:translate-x-0 transition-transform duration-700 pointer-events-none"></div>
                              
                              <div className="flex items-start justify-between mb-6">
                                 <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-indigo-50 border-2 border-white overflow-hidden shadow-lg group-hover:scale-110 transition-transform">
                                       {rev.reviewer?.profilePhoto ? (
                                          <img 
                                            src={rev.reviewer.profilePhoto} 
                                            alt={rev.reviewer.name} 
                                            className="w-full h-full object-cover hd-profile rounded-xl" 
                                            loading="lazy"
                                            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=' + rev.reviewer.name + '&background=6366f1&color=fff'; }}
                                          />
                                       ) : (
                                          <div className="w-full h-full flex items-center justify-center text-indigo-200 bg-indigo-600 font-black italic text-xl uppercase">
                                             {rev.reviewer?.name?.charAt(0)}
                                          </div>
                                       )}
                                    </div>
                                    <div>
                                       <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight italic group-hover:text-indigo-600 transition-colors">
                                          {rev.reviewer?.name}
                                       </h4>
                                       <div className="flex gap-0.5 mt-1">
                                          {[...Array(5)].map((_, i) => (
                                             <Star 
                                               key={i} 
                                               size={10} 
                                               className={i < (rev.rating || 0) ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}
                                             />
                                          ))}
                                       </div>
                                       {rev.conflictDetected && (
                                          <div className="mt-1 flex items-center gap-1.5 animate-pulse">
                                             <div className="h-1 w-1 rounded-full bg-rose-500"></div>
                                             <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest italic">AI Conflict Adjusted</span>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                                 <div className="text-right flex flex-col items-end">
                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">
                                       {new Date(rev.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                    <div className="bg-indigo-50 px-2 py-0.5 rounded text-[8px] font-black text-indigo-600 tracking-tighter italic">
                                       AI: {rev.finalRating?.toFixed(1) || rev.rating}
                                    </div>
                                 </div>
                              </div>

                              <div className="relative z-10">
                                 <p className="text-sm font-medium text-slate-600 italic leading-relaxed pl-4 border-l-2 border-indigo-100 mb-6 group-hover:border-indigo-500 transition-colors">
                                    "{rev.comment}"
                                 </p>

                                 {/* Ride Context */}
                                 {rev.rideId && (
                                    <div className="inline-flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group-hover:bg-indigo-50 transition-colors">
                                       <div className="flex items-center gap-1.5 opacity-60">
                                          <MapPin size={10} className="text-indigo-600" />
                                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter truncate max-w-[80px]">
                                             {rev.rideId.from?.split(',')[0] || 'Origin'}
                                          </span>
                                       </div>
                                       <ChevronRight size={10} className="text-slate-300" />
                                       <div className="flex items-center gap-1.5 opacity-60">
                                          <Navigation size={10} className="text-indigo-600 rotate-45" />
                                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter truncate max-w-[80px]">
                                             {rev.rideId.to?.split(',')[0] || 'Dest'}
                                          </span>
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </motion.div>
                        ))}
                     </div>
                  )}
               </div>

               {/* Quick Links */}
               <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {user?.role === 'admin' ? (
                     <>
                        <Link to="/admin" className="flex items-center justify-between bg-white border border-slate-100 p-6 rounded-3xl hover:border-indigo-200 transition-all group shadow-sm">
                           <span className="font-bold text-slate-700">HQ Dashboard</span>
                           <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </Link>
                        <Link to="/admin/users" className="flex items-center justify-between bg-white border border-slate-100 p-6 rounded-3xl hover:border-indigo-200 transition-all group shadow-sm">
                           <span className="font-bold text-slate-700">Member Registry</span>
                           <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </Link>
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-6 rounded-3xl opacity-50 cursor-not-allowed shadow-sm">
                           <span className="font-bold text-slate-400">System Logs</span>
                           <Shield size={18} className="text-slate-200" />
                        </div>
                     </>
                  ) : (
                     <>
                        <Link to="/bookings" className="flex items-center justify-between bg-white border border-slate-100 p-6 rounded-3xl hover:border-indigo-200 transition-all group shadow-sm">
                           <span className="font-bold text-slate-700">Trip History</span>
                           <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </Link>
                        <Link to="/offer-ride" className="flex items-center justify-between bg-white border border-slate-100 p-6 rounded-3xl hover:border-indigo-200 transition-all group shadow-sm">
                           <span className="font-bold text-slate-700">Earnings Log</span>
                           <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </Link>
                        <div className="flex items-center justify-between bg-white border border-slate-100 p-6 rounded-3xl hover:border-red-200 transition-all group shadow-sm cursor-pointer opacity-50 grayscale hover:grayscale-0">
                           <span className="font-bold text-slate-700">Emergency Protocol</span>
                           <ChevronRight size={18} className="text-slate-300 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
                        </div>
                     </>
                  )}
               </div>
            </div>
         </motion.div>
      </main>

      {/* Add Money Modal — STRIPE INTEGRATION */}
      <AddMoneyModal 
        show={showTopUp} 
        onClose={() => setShowTopUp(false)} 
        onSuccess={async () => {
           setShowTopUp(false);
           await refreshUser(); 
           await fetchWalletData();
        }}
      />
      
      <WithdrawMoneyModal 
        show={showWithdraw} 
        onClose={() => setShowWithdraw(false)} 
        balance={balance}
        onSuccess={async () => {
           await refreshUser();
           await fetchWalletData();
        }}
      />

      <EditProfileModal 
        show={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        user={user}
        onUpdate={async () => {
          await refreshUser();
        }}
      />
    </div>
  );
};

export default Profile;
