import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, User, Bell, Car, Users, Clock, Star, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, driverStats, markAsRead } = useNotifications();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  const navLinks = user?.role === 'admin' ? [
    { name: 'HQ Dashboard', path: '/admin' },
    { name: 'Member Registry', path: '/admin/users' },
    { name: 'Admin Account', path: '/profile' }
  ] : [
    { name: 'Find Rides', path: '/find-rides' },
    { name: 'Offer Ride', path: '/offer-ride' },
    { name: 'My Rides', path: '/my-rides', badge: driverStats?.newBookingsCount > 0 },
    { name: 'My Bookings', path: '/bookings' },
    { name: 'Wallet', path: '/wallet-history' },
    { name: 'Profile', path: '/profile' }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] px-6 md:px-12 py-3 bg-white/70 backdrop-blur-2xl border-b border-slate-200/50 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="flex items-center gap-4 group">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200 transform group-hover:rotate-12 transition-transform duration-300">
            <LayoutDashboard className="text-white h-5 w-5" />
          </div>
          <span className="font-bold text-xl tracking-tighter text-slate-800">Ride<span className="text-indigo-600">Dosthi</span></span>
        </Link>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link 
              key={link.path}
              to={link.path} 
              className={`text-sm font-bold transition-colors relative flex items-center gap-2 ${
                isActive(link.path) 
                ? 'text-indigo-600 after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-0.5 after:bg-indigo-600' 
                : 'text-slate-500 hover:text-indigo-600'
              }`}
            >
              {link.name}
              {link.name === 'My Rides' && driverStats?.newBookingsCount > 0 && (
                <span className="flex items-center justify-center bg-rose-500 text-white text-[9px] font-black h-4 w-4 rounded-full animate-bounce">
                  {driverStats.newBookingsCount}
                </span>
              )}
              {link.name !== 'My Rides' && link.badge && (
                <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
              )}
            </Link>
          ))}
        </div>
        <div className="h-8 w-[1px] bg-slate-200 hidden lg:block"></div>
        
        <div className="flex items-center gap-4 relative">
          {/* Notification Bell */}
          <div className="relative">
             <button 
               onClick={() => {
                 setShowNotifications(!showNotifications);
                 if (!showNotifications && unreadCount > 0) markAsRead();
               }}
               className={`p-2.5 rounded-xl transition-all relative ${showNotifications ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
             >
               <Bell size={20} />
               {unreadCount > 0 && (
                 <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black h-5 w-5 flex items-center justify-center rounded-full border-2 border-white shadow-lg">
                   {unreadCount}
                 </span>
               )}
             </button>

             {/* Dropdown */}
             {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-100 py-4 z-50 overflow-hidden">
                   <div className="px-6 mb-4 flex justify-between items-center">
                      <h4 className="font-black text-slate-800 text-sm tracking-tight">Recent Updates</h4>
                      {unreadCount > 0 && <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{unreadCount} New</span>}
                   </div>
                   <div className="max-h-[400px] overflow-y-auto">
                      {notifications.length === 0 ? (
                         <div className="px-6 py-8 text-center">
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No notifications yet</p>
                         </div>
                      ) : (
                         notifications.map(n => (
                            <Link 
                              key={n._id}
                              to={['RIDE_CANCELLED', 'FEEDBACK_REQUEST'].includes(n.type) ? '/bookings' : `/my-rides/${n.rideId}/passengers`}
                              onClick={() => setShowNotifications(false)}
                              className={`px-6 py-4 flex gap-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${!n.isRead ? 'bg-indigo-50/30' : ''}`}
                            >
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                 n.type === 'NEW_BOOKING' ? 'bg-emerald-100 text-emerald-600' : 
                                 n.type === 'BOOKING_CANCELLED' ? 'bg-amber-100 text-amber-600' : 
                                 n.type === 'COMMISSION_DEDUCTED' ? 'bg-rose-100 text-rose-600' :
                                 n.type === 'FEEDBACK_REQUEST' ? 'bg-indigo-100 text-indigo-600' :
                                 'bg-slate-100 text-slate-500'
                               }`}>
                                  {n.type === 'NEW_BOOKING' ? <Users size={18} /> : 
                                   n.type === 'BOOKING_CANCELLED' ? <Clock size={18} /> : 
                                   n.type === 'COMMISSION_DEDUCTED' ? <CreditCard size={18} /> :
                                   n.type === 'FEEDBACK_REQUEST' ? <Star size={18} /> : 
                                   <Car size={18} />}
                               </div>
                               <div>
                                  <p className="text-xs font-black text-slate-800 mb-0.5">{n.title}</p>
                                  <p className="text-[11px] text-slate-500 font-medium leading-tight">{n.message}</p>
                                  <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                               </div>
                            </Link>
                         ))
                      )}
                   </div>
                   <div className="px-6 pt-4 mt-2 border-t border-slate-50 text-center">
                      <button onClick={() => setShowNotifications(false)} className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest">Close Panel</button>
                   </div>
                </div>
             )}
          </div>

          {user?.priorityBadgeExpires && new Date(user.priorityBadgeExpires) > new Date() && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-white shadow-lg shadow-indigo-100 group cursor-help relative hover:bg-slate-800 transition-colors" title={`Priority active until ${new Date(user.priorityBadgeExpires).toLocaleDateString()}`}>
               <Star fill="#6366f1" size={12} className="text-indigo-400 animate-pulse" />
               <span className="text-[9px] font-black uppercase tracking-widest italic leading-none">Priority</span>
            </div>
          )}

          <Link to="/profile" className="hidden sm:flex items-center gap-3 bg-white py-1.5 px-4 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 transition-colors group">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold ring-2 ring-indigo-50 group-hover:scale-110 transition-transform">
              {user?.name?.charAt(0)}
            </div>
            <span className="text-sm font-bold text-slate-800 leading-none">{user?.name?.split(' ')[0]}</span>
          </Link>
          <button 
            onClick={logout} 
            className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
