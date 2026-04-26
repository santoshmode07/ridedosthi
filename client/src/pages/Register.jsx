import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Phone, Lock, FileText, IdCard, Loader2, 
  ArrowRight, ShieldCheck, Car, CheckCircle2, Circle,
  ChevronLeft, LayoutDashboard, Sparkles, Navigation
} from 'lucide-react';
import { toast } from 'react-toastify';
import loginBg from '../assets/login-bg.png';

const Register = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gender: 'female',
    password: '',
    licenseNumber: '',
    aadhaarNumber: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.phone || !formData.password) {
        toast.error('Identity details required to proceed.');
        return;
      }
      setStep(2);
    }
  };

  const prevStep = () => setStep(1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 2 && !formData.aadhaarNumber) {
       toast.error('Aadhaar verification is mandatory.');
       return;
    }
    setIsSubmitting(true);
    const result = await register(formData);
    setIsSubmitting(false);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  const inputClass = "w-full bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-white text-sm font-medium placeholder:text-slate-500 shadow-inner";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-2 block";
  const iconClass = "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors pointer-events-none";

  const steps = [
    { id: 1, name: 'Personal', icon: <User size={16} /> },
    { id: 2, name: 'Identity', icon: <IdCard size={16} /> }
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 bg-slate-900 font-outfit relative overflow-hidden">
      {/* Cinematic Background */}
      <div className="absolute inset-0 z-0">
        <img src={loginBg} alt="Background" className="w-full h-full object-cover opacity-30 scale-125 blur-[4px]" />
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-900/80 to-slate-900/20"></div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/10 rounded-full blur-[150px] -z-0"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-600/10 rounded-full blur-[150px] -z-0"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] overflow-hidden relative z-10"
      >
        {/* Left Side - Themed Branding */}
        <div className="lg:col-span-5 bg-indigo-600/10 p-12 md:p-16 flex flex-col justify-between relative overflow-hidden border-r border-white/5">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
           
           <div className="relative z-10">
              <Link to="/" className="flex items-center gap-4 mb-16 group">
                <div className="bg-indigo-600 p-2.5 rounded-xl shadow-2xl shadow-indigo-500/50 transform group-hover:rotate-12 transition-transform duration-500">
                   <LayoutDashboard className="text-white h-5 w-5" />
                </div>
                <span className="font-bold text-2xl tracking-tighter text-white">Ride<span className="text-indigo-400">Dosthi</span></span>
              </Link>
              
              <h2 className="text-4xl font-black text-white leading-[0.9] mb-6 tracking-tighter italic">Join the <br/><span className="text-indigo-400">Transit</span> Revolution.</h2>
              <p className="text-slate-400 text-lg font-medium leading-relaxed mb-12">Become a verified member of the most trusted professional ride-sharing network.</p>
              
              <div className="space-y-6">
                {[
                  { icon: ShieldCheck, title: 'Identity Verified', desc: 'Secure Aadhaar & DL verification protocol.' },
                  { icon: Navigation, title: 'Smart Routes', desc: 'Efficiency optimized co-rider matching.' },
                  { icon: Sparkles, title: 'Safe Circle', desc: 'Verified professionals from top companies.' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                     <div className="h-10 w-10 bg-indigo-600/20 text-indigo-400 rounded-xl flex items-center justify-center shrink-0 border border-indigo-400/20">
                        <item.icon size={20} />
                     </div>
                     <div>
                        <h4 className="text-white font-bold text-sm tracking-tight italic uppercase">{item.title}</h4>
                        <p className="text-slate-400 text-xs font-medium">{item.desc}</p>
                     </div>
                  </div>
                ))}
              </div>
           </div>

           <div className="mt-16 pt-10 border-t border-white/5">
              <div className="flex -space-x-3 mb-4">
                 {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-indigo-600 bg-slate-800 overflow-hidden ring-4 ring-slate-900/20">
                       <img src={`https://i.pravatar.cc/100?img=${i+20}`} alt="Active User" />
                    </div>
                 ))}
                 <div className="w-10 h-10 rounded-full border-2 border-indigo-600 bg-indigo-500 flex items-center justify-center text-[10px] font-black italic">
                   +10k
                 </div>
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-loose">Trusted by 10,000+ Verified Professionals <br/> and Students across India.</p>
           </div>
        </div>

        {/* Right Side - Registration Flow */}
        <div className="lg:col-span-7 p-8 md:p-12 lg:p-14 flex flex-col relative">
           {/* Step Indicator */}
           <div className="max-w-xs mx-auto w-full mb-16 relative">
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/10 -translate-y-1/2 z-0"></div>
              <motion.div 
                className="absolute top-1/2 left-0 h-[2px] bg-indigo-500 -translate-y-1/2 z-0 shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
                animate={{ width: step === 1 ? '50%' : '100%' }}
                transition={{ duration: 0.5 }}
              ></motion.div>
              
              <div className="flex justify-between items-center relative z-10 w-full">
                {steps.map((s) => (
                  <div key={s.id} className="flex flex-col items-center gap-3">
                     <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center border-2 transition-all duration-500 ${step >= s.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl shadow-indigo-500/50 scale-110' : 'bg-slate-900 border-white/10 text-slate-500'}`}>
                        {step > s.id ? <CheckCircle2 size={22} className="text-white" /> : s.icon}
                     </div>
                     <span className={`text-[10px] font-black uppercase tracking-widest ${step >= s.id ? 'text-indigo-400' : 'text-slate-600'}`}>{s.name} Data</span>
                  </div>
                ))}
              </div>
           </div>

           <div className="flex-1">
              <AnimatePresence mode="wait">
                 {step === 1 ? (
                    <motion.div
                       key="step1"
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       exit={{ opacity: 0, x: -20 }}
                       className="space-y-10"
                    >
                       <div className="text-center lg:text-left">
                          <h3 className="text-4xl font-black text-white tracking-tighter italic">Personal Identity.</h3>
                          <p className="text-slate-400 font-medium">Create your secure transit profile today.</p>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-1">
                             <label className={labelClass}>Callsign / name</label>
                             <div className="relative group/input">
                                <User className={iconClass} />
                                <input name="name" type="text" placeholder="Full Name" className={inputClass} value={formData.name} onChange={handleChange} required />
                             </div>
                          </div>
                          <div className="space-y-1">
                             <label className={labelClass}>Network Email</label>
                             <div className="relative group/input">
                                <Mail className={iconClass} />
                                <input name="email" type="email" placeholder="name@company.com" className={inputClass} value={formData.email} onChange={handleChange} required />
                             </div>
                          </div>
                          <div className="space-y-1">
                             <label className={labelClass}>Comm-Link number</label>
                             <div className="relative group/input">
                                <Phone className={iconClass} />
                                <input name="phone" type="tel" placeholder="+91 XXXX XXXX" className={inputClass} value={formData.phone} onChange={handleChange} required />
                             </div>
                          </div>
                          <div className="space-y-1">
                             <label className={labelClass}>Access Key</label>
                             <div className="relative group/input">
                                <Lock className={iconClass} />
                                <input name="password" type="password" placeholder="••••••••" className={inputClass} value={formData.password} onChange={handleChange} required />
                             </div>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <label className={labelClass}>Transit Gender (Security Mapping)</label>
                          <div className="grid grid-cols-2 gap-4">
                             {['female', 'male'].map((g) => (
                                <button
                                   key={g}
                                   type="button"
                                   onClick={() => setFormData({ ...formData, gender: g })}
                                   className={`flex items-center justify-center gap-3 py-5 rounded-2xl border transition-all font-black text-xs uppercase tracking-widest ${formData.gender === g ? 'bg-indigo-600 border-indigo-400 text-white shadow-2xl shadow-indigo-500/20' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/20'}`}
                                >
                                   <Circle size={10} className={formData.gender === g ? 'fill-white' : ''} />
                                   {g}
                                </button>
                             ))}
                          </div>
                          {formData.gender === 'female' && (
                             <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-black text-indigo-400 flex items-center gap-2 bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 leading-relaxed italic">
                                <ShieldCheck size={16} />
                                SafeMatch protocol active: Prioritizing female-only connections.
                             </motion.p>
                          )}
                       </div>

                       <button
                          onClick={nextStep}
                          className="w-full bg-indigo-600 text-white rounded-[1.5rem] py-5 font-black text-sm uppercase tracking-[0.2em] hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/20 group/btn"
                       >
                          Verify Identity <ArrowRight className="group-hover/btn:translate-x-2 transition-transform" />
                       </button>
                    </motion.div>
                 ) : (
                    <motion.div
                       key="step2"
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       exit={{ opacity: 0, x: -20 }}
                       className="space-y-10"
                    >
                       <div className="text-center lg:text-left">
                          <h3 className="text-4xl font-black text-white tracking-tighter italic mr-2">Passport <span className="text-indigo-400">Activation.</span></h3>
                          <p className="text-slate-400 font-medium">Complete verification to join the verified fleet.</p>
                       </div>

                       <div className="space-y-8">
                          <div className="space-y-1">
                             <label className={labelClass}>Aadhaar Number (Primary ID)</label>
                             <div className="relative group/input">
                                <IdCard className={iconClass} />
                                <input name="aadhaarNumber" type="text" placeholder="1234 5678 9012" className={inputClass} value={formData.aadhaarNumber} onChange={handleChange} required />
                             </div>
                          </div>
                          <div className="space-y-1">
                             <label className={labelClass}>Driving License (Optional Pilot ID)</label>
                             <div className="relative group/input">
                                <FileText className={iconClass} />
                                <input name="licenseNumber" type="text" placeholder="DL-XXXX-XXXX" className={inputClass} value={formData.licenseNumber} onChange={handleChange} />
                             </div>
                          </div>
                       </div>

                       <div className="pt-8 space-y-4">
                          <button
                             onClick={handleSubmit}
                             disabled={isSubmitting}
                             className="w-full bg-indigo-600 text-white rounded-[1.5rem] py-5 font-black text-sm uppercase tracking-[0.2em] hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/20"
                          >
                             {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <>Activate Community Pass <CheckCircle2 size={20}/></>}
                          </button>
                          <button
                             onClick={prevStep}
                             className="w-full text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors flex items-center justify-center gap-4 py-2"
                          >
                             <ChevronLeft size={16} /> Edit Information
                          </button>
                       </div>
                    </motion.div>
                 )}
              </AnimatePresence>
           </div>

           <p className="mt-16 text-center text-slate-500 font-medium text-sm">
              Already a member?{' '}
              <Link to="/login" className="text-indigo-400 font-black hover:text-white transition-colors underline underline-offset-8 decoration-indigo-500/30">
                Establish Connection
              </Link>
           </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
