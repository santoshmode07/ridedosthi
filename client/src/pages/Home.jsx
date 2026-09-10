import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, ShieldCheck, Star, Users, MapPin, 
  Sparkles, CheckCircle2, TrendingUp, Zap, Award, 
  LayoutDashboard, LogOut, ChevronRight, Globe, Lock,
  Bike, Car, Smartphone, Shield, Clock, Heart, Scale
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import heroImage from '../assets/hero_v2.png';
import mockupImage from '../assets/mockup.png';

const Home = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Vehicle Options', href: '#vehicles' },
    { name: 'Safety First', href: '#safety' },
    { name: 'Community', href: '#community' },
  ];

  const vehicleTypes = [
    {
      id: 'car',
      icon: Car,
      name: 'Prime Car',
      desc: 'Comfortable, climate-controlled rides for your daily commute.',
      tag: 'Most Popular',
      color: 'from-blue-600 to-indigo-600'
    },
    {
      id: 'bike',
      icon: Bike,
      name: 'Swift Bike',
      desc: 'Beat the traffic with quick, agile, and cost-effective bike rides.',
      tag: 'Fastest',
      color: 'from-orange-500 to-red-600'
    }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-outfit selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Modern Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 px-6 md:px-12 py-5 ${
        scrolled ? 'bg-black/40 backdrop-blur-xl border-b border-white/10' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between relative h-full">
          <Link to="/" className="flex items-center gap-3 group shrink-0 relative z-10">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:rotate-12 transition-transform">
              <Zap className="text-white h-6 w-6 fill-current" />
            </div>
            <span className="font-bold text-2xl tracking-tighter text-white">Ride<span className="text-indigo-400">Dosthi</span></span>
          </Link>

          <div className="hidden lg:flex items-center justify-center gap-8 absolute inset-0 mx-auto w-max h-full">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-indigo-400 transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4 shrink-0 relative z-10">
            {token ? (
              <>
                <Link to="/dashboard" className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-white/20 transition-all">
                  Dashboard <ChevronRight size={14} />
                </Link>
                <button onClick={logout} className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-bold text-white/70 hover:text-white transition-colors mr-2">Login</Link>
                <Link to="/register" className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.1em] hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20 active:scale-95">
                  Join Now
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center pt-24 pb-16 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 md:gap-20">
          <div className="flex-1 text-center lg:text-left z-10">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-4 py-2 rounded-full text-[10px] font-black tracking-[0.2em] uppercase mb-8">
                <Sparkles size={14} /> Car & Bike Ridesharing Redefined
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-black text-white tracking-tighter leading-[1.1] mb-6 max-w-4xl mx-auto lg:mx-0">
                Every Journey,<br />
                <span className="inline-block py-2 pr-6 -mr-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 animate-gradient-x italic">A Trusted Dosthi.</span>
              </h1>
              <p className="text-white/60 text-lg md:text-xl font-medium max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                Whether you prefer the comfort of a <span className="text-white">Car</span> or the speed of a <span className="text-white">Bike</span>, RideDosthi connects you with verified professionals for a smarter, safer, and cheaper commute.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link to="/find-rides" className="w-full sm:w-auto bg-white text-black px-10 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-indigo-400 hover:text-white transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/20 group active:scale-95">
                  Book a ride <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                </Link>
                <Link to="/offer-ride" className="w-full sm:w-auto bg-white/5 backdrop-blur-md text-white border border-white/10 px-10 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-95">
                  Offer a Ride
                </Link>
              </div>

              <div className="mt-16 flex flex-wrap items-center justify-center lg:justify-start gap-10 opacity-40">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={20} className="text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Verified Members Only</span>
                </div>
                <div className="flex items-center gap-3">
                  <Heart size={20} className="text-purple-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Zero Carbon Mission</span>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="flex-1 relative w-full lg:w-auto"
          >
            <div className="relative z-10 rounded-[3rem] overflow-hidden border-4 border-white/5 shadow-[0_0_80px_-20px_rgba(79,70,229,0.3)] group max-h-[400px] md:max-h-[480px] flex items-center justify-center">
              <img 
                src={heroImage} 
                alt="Car and Bike Mobility" 
                className="w-full h-full object-cover transform scale-110 group-hover:scale-100 transition-transform duration-[2s]" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            </div>
            
            {/* Stats Card */}
            <motion.div 
              animate={{ y: [0, -15, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className="absolute -bottom-4 -left-6 bg-black/40 backdrop-blur-xl p-5 md:p-6 rounded-[2.5rem] border border-white/10 shadow-2xl z-20 hidden md:block group/stats"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/30 group-hover/stats:scale-110 transition-transform">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="font-black text-xl text-white tracking-tighter leading-none mb-1">98.5%</p>
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] leading-none">Match Accuracy</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Vehicle Type Section */}
      <section id="vehicles" className="py-32 px-6 bg-white/5 border-y border-white/5">
        <div className="max-w-7xl mx-auto text-center mb-20">
          <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4 block">Choose Your Mode</span>
          <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter">Two Ways to <span className="italic">Dosthi</span>.</h2>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          {vehicleTypes.map((type, i) => (
            <motion.div 
              key={type.id}
              whileHover={{ y: -10 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 p-10 rounded-[3.5rem] flex flex-col items-center text-center group hover:bg-white/[0.08] transition-all"
            >
              <div className={`h-24 w-24 rounded-3xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-8 shadow-2xl group-hover:scale-110 transition-transform`}>
                <type.icon size={48} className="text-white" />
              </div>
              <span className="bg-white/10 text-white/60 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-6">
                {type.tag}
              </span>
              <h3 className="text-3xl font-black text-white mb-4 tracking-tighter">{type.name}</h3>
              <p className="text-white/60 font-medium leading-relaxed mb-8 max-w-[250px]">
                {type.desc}
              </p>
              <button className="text-indigo-400 font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 group-hover:gap-4 transition-all">
                Learn More <ChevronRight size={16} />
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Safety Matrix */}
      <section id="safety" className="py-40 px-6 relative overflow-hidden bg-[#0a0a0a]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[150px]"></div>
        
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-24">
          <div className="flex-1 order-2 lg:order-1">
            <div className="grid grid-cols-2 gap-6">
              {[
                { icon: Scale, title: "Justice Protocol", desc: "Automated penalties for late cancellations and no-shows." },
                { icon: TrendingUp, title: "Dynamic Pricing", desc: "AI-driven price optimization based on real-time route demand." },
                { icon: ShieldCheck, title: "Aadhaar Vetted", desc: "Strict manual verification of every driver's credentials." },
                { icon: Lock, title: "Escrow System", desc: "Payments held securely until safe journey completion." }
              ].map((item, i) => (
                <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] hover:border-indigo-500/30 transition-all hover:bg-white/[0.07]">
                  <item.icon className="text-indigo-400 mb-6 h-10 w-10" />
                  <h4 className="text-lg font-bold text-white mb-2 uppercase italic leading-none">{item.title}</h4>
                  <p className="text-white/40 text-xs leading-relaxed font-medium">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex-1 order-1 lg:order-2">
            <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-8 block">The Trust Framework</span>
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8 leading-[0.9]">Built on <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 italic">Integrity.</span></h2>
            <p className="text-white/60 text-lg font-medium leading-relaxed mb-10">
              RideDosthi isn't just a matching platform. We've built an AI-driven justice system that enforces accountability through strict protocols and verified community trust.
            </p>
            <div className="flex items-center gap-8">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-14 w-14 rounded-2xl border-4 border-[#050505] bg-slate-800 overflow-hidden shadow-xl">
                    <img src={`https://i.pravatar.cc/100?img=${i+20}`} alt="user" className="grayscale hover:grayscale-0 transition-all" />
                  </div>
                ))}
              </div>
              <p className="text-white font-bold italic">Join 15,000+ <br/><span className="text-indigo-400">Verified Riders</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section id="community" className="py-40 px-6">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-[5rem] p-16 md:p-32 text-center relative overflow-hidden shadow-[0_40px_100px_-20px_rgba(79,70,229,0.5)]"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          <div className="relative z-10">
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-10 leading-none">Stop Waiting. <br/><span className="text-white/60 italic">Start Dosthi.</span></h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link to="/register" className="w-full sm:w-auto bg-white text-indigo-700 px-14 py-7 rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all active:scale-95 shadow-2xl">
                Create Account
              </Link>
              <Link to="/find-rides" className="w-full sm:w-auto bg-black/20 backdrop-blur-md text-white border border-white/20 px-14 py-7 rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95">
                Quick Search
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-white/5 bg-black/40">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-20">
          <div className="col-span-1 md:col-span-1">
             <Link to="/" className="flex items-center gap-3 mb-10">
                <div className="bg-indigo-600 p-2 rounded-xl shadow-lg">
                  <Zap className="text-white h-6 w-6 fill-current" />
                </div>
                <span className="font-bold text-2xl tracking-tighter text-white">Ride<span className="text-indigo-400">Dosthi</span></span>
             </Link>
             <p className="text-white/40 font-medium leading-relaxed mb-10">Beyond ridesharing. Building community trust one journey at a time. Car or bike, we've got you covered.</p>
             <div className="flex gap-4">
               {[Globe, Lock, Users].map((Icon, i) => (
                 <div key={i} className="h-12 w-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/40 hover:text-indigo-400 hover:border-indigo-400 cursor-pointer transition-all">
                    <Icon size={20} />
                 </div>
               ))}
             </div>
          </div>
          
          {[
            { title: "Vehicles", links: ["Electric Cars", "Eco Bikes", "Carpool", "Bike Pool"] },
            { title: "Network", links: ["Safe Zones", "Top Routes", "Enterprise", "University"] },
            { title: "Support", links: ["Safety Center", "Help Hub", "Justice Protocol", "Audit Logs"] }
          ].map((col, i) => (
            <div key={i}>
              <h4 className="text-white font-black text-xs uppercase tracking-[0.3em] mb-10">{col.title}</h4>
              <ul className="space-y-4">
                {col.links.map((link, j) => (
                  <li key={j} className="text-white/40 font-bold text-sm hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-2 group">
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-7xl mx-auto mt-24 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
           <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">© 2026 RideDosthi. High-Velocity Mobility.</p>
           <div className="flex gap-8">
              <span className="text-[9px] font-black text-white/20 uppercase hover:text-white transition-colors cursor-pointer tracking-widest">Privacy</span>
              <span className="text-[9px] font-black text-white/20 uppercase hover:text-white transition-colors cursor-pointer tracking-widest">Terms</span>
              <span className="text-[9px] font-black text-white/20 uppercase hover:text-white transition-colors cursor-pointer tracking-widest">Cookies</span>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
