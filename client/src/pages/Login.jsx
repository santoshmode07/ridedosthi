import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Car, Mail, Lock, Loader2, ArrowRight, ShieldCheck, 
  ChevronRight, Sparkles, LayoutDashboard
} from 'lucide-react';
import { toast } from 'react-toastify';
import loginBg from '../assets/login-bg.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Identity required to proceed.');
      return;
    }
    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  const inputClass = "w-full bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-white text-sm font-medium placeholder:text-slate-500";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-2 block";

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-900 font-outfit relative overflow-hidden">
      {/* Cinematic Background Image */}
      <div className="absolute inset-0 z-0">
        <img src={loginBg} alt="Background" className="w-full h-full object-cover opacity-40 scale-110 blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/60 to-slate-900"></div>
      </div>

      {/* Decorative Blobs */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px] -z-0"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] -z-0"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo/Header Card */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-4 mb-8 group">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-2xl shadow-indigo-500/50 transform group-hover:rotate-12 transition-transform duration-500">
               <LayoutDashboard className="text-white h-6 w-6" />
            </div>
            <span className="font-bold text-2xl tracking-tighter text-white">Ride<span className="text-indigo-400">Dosthi</span></span>
          </Link>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <h1 className="text-3xl font-black text-white tracking-tighter mb-2 italic">Back in Action.</h1>
            <p className="text-slate-400 font-medium">Your next safe journey is just a click away.</p>
          </motion.div>
        </div>

        {/* Glass Login Form */}
        <div className="bg-white/5 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-2xl shadow-black/50 overflow-hidden relative group">
          {/* Animated border effect */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
          
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="space-y-1">
              <label className={labelClass}>Transit Email</label>
              <div className="relative group/input">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Access Key</label>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest cursor-pointer hover:text-white transition-colors mb-2">Recovery</span>
              </div>
              <div className="relative group/input">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white rounded-[1.5rem] py-5 font-black text-sm uppercase tracking-[0.2em] hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/20 active:scale-95 group/btn"
            >
              {isSubmitting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  Establish Connection <ArrowRight className="h-5 w-5 group-hover/btn:translate-x-2 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Social/Security Footer */}
          <div className="mt-10 pt-8 border-t border-white/5 text-center flex flex-col items-center gap-8">
             <div className="flex items-center gap-3 bg-white/5 px-5 py-3 rounded-2xl border border-white/5">
                <ShieldCheck className="text-emerald-400 h-5 w-5" />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Biometric Identity Secure</p>
             </div>
             
             <p className="text-slate-400 font-medium text-sm">
                Need a new passport?{' '}
                <Link to="/register" className="text-indigo-400 font-bold hover:text-white transition-colors">
                  Create Account
                </Link>
             </p>
          </div>
        </div>

        {/* Footer Brand */}
        <p className="text-center mt-12 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">© 2026 RideDosthi Global Security</p>
      </motion.div>
    </div>
  );
};

export default Login;
