
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/NeumorphicUI';
import { useNavigate } from 'react-router-dom';
import { getIcon, getRoleLabel } from '../utils/icons';
import { UserCircle2, Sparkles, Clock as ClockIcon, ArrowRight, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

interface DigitalClockProps { 
    format: '12h' | '24h' | 'date-only'; 
    language: 'ar' | 'en'; 
    size?: 'sm' | 'md' | 'lg' | 'xl';
    textColor?: string;
    showTime?: boolean;
    showDate?: boolean;
    showSeconds?: boolean;
    scale?: number;
}

const DigitalClock: React.FC<DigitalClockProps> = ({ 
    format, 
    language, 
    size = 'sm', 
    textColor = 'white', 
    showTime = true, 
    showDate = true,
    showSeconds = true,
    scale = 1
}) => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const hours24 = time.getHours();
    const isPM = hours24 >= 12;
    let displayHours = hours24;
    if (format === '12h') displayHours = hours24 % 12 || 12;

    const hours = displayHours.toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    
    const locale = language === 'ar' ? 'ar-EG' : 'en-GB';
    const dateStr = time.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);

    const sizeMap = {
        sm: { main: 'text-[28px]', sub: 'text-[11px]' },
        md: { main: 'text-[32px]', sub: 'text-[13px]' },
        lg: { main: 'text-[38px]', sub: 'text-[15px]' },
        xl: { main: 'text-[44px]', sub: 'text-[18px]' }
    };
    const currentSize = sizeMap[size];

    return (
        <div className="flex flex-col items-start leading-none" style={{ transform: `scale(${scale})` }}>
             {showTime && (
                 <div className={`flex items-baseline gap-0.5 font-bold tracking-tighter drop-shadow-lg ${currentSize.main}`} dir="ltr" style={{ color: textColor, fontFamily: 'Inter, sans-serif' }}>
                     <span>{hours}</span><span className="animate-pulse opacity-50">:</span><span>{minutes}</span>
                     <div className="flex flex-col text-[8px] ml-1 opacity-80 font-black uppercase">
                         {showSeconds && <span className="mb-[-2px]">{seconds}</span>}
                         {format === '12h' && <span>{isPM ? (language === 'ar' ? 'م' : 'PM') : (language === 'ar' ? 'ص' : 'AM')}</span>}
                     </div>
                 </div>
             )}
             {showDate && (
                 <div className={`font-cairo font-black bg-white/10 px-3 py-0.5 rounded-full backdrop-blur-md border border-white/10 mt-1 shadow-sm ${currentSize.sub}`} style={{ color: textColor }}>
                     {dateStr}
                 </div>
             )}
        </div>
    );
};

export const MainPage: React.FC = () => {
  const { t, user, uiConfig, settings, selectWarehouse, logout } = useApp();
  const navigate = useNavigate();
  const mainConfig = settings.mainScreenSettings;

  const allowedButtons = useMemo(() => {
      if (!user) return [];
      return uiConfig.main.buttons.filter(btn => {
          if (!btn.isVisible) return false;
          
          // If user is in Minia, ONLY show Minia buttons + Settings
          if (user.selectedWarehouse === 'minia') {
              return btn.warehouseId === 'minia' || btn.id === 'm_settings';
          }

          // Filter by warehouseId if specified for other warehouses
          if (btn.warehouseId && btn.warehouseId !== user.selectedWarehouse) {
              return false;
          }

          if (user.role === 'admin') return true;
          
          // If it's a warehouse-specific button and the user is in that warehouse, allow it by default
          if (btn.warehouseId && btn.warehouseId === user.selectedWarehouse) {
              return true;
          }

          const permissionKey = btn.id.startsWith('m_') ? btn.id.replace('m_', 'sb_') : btn.id;
          const level = user.permissions?.screens?.[permissionKey];
          return level === 'available' || level === 'edit';
      });
  }, [uiConfig.main.buttons, user, user?.selectedWarehouse]);

  const isMinia = user?.selectedWarehouse === 'minia';

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Premium Header - Styled after references */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 rounded-[45px] shadow-2xl relative overflow-hidden h-44 md:h-48"
        style={{ 
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full -ml-32 -mb-32 blur-2xl"></div>

        <div className="absolute inset-0 flex items-center justify-between px-12 z-10" dir="rtl">
            <div className="w-1/3 flex justify-start items-center gap-6">
                <div className="hidden lg:block">
                  <DigitalClock 
                      format="24h" 
                      language={settings.language} 
                      size="lg" 
                      textColor="white" 
                      showSeconds={false}
                  />
                </div>
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center flex flex-col items-center pointer-events-none w-full">
                <h1 className="font-cairo font-black text-white text-4xl md:text-5xl drop-shadow-2xl leading-tight mb-2 uppercase tracking-tight">
                    الشاشة الرئيسية
                </h1>
                <div className="h-1.5 w-64 bg-gradient-to-r from-transparent via-yellow-400 to-transparent rounded-full shadow-[0_0_15px_rgba(250,204,21,0.5)]"></div>
            </div>

            <div className="w-1/3 flex justify-end items-center gap-6">
                {user && (
                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white shadow-inner transform rotate-3 shrink-0">
                            <UserCircle2 size={24} />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1">مستخدم النظام</span>
                            <span className="text-sm font-black text-white">{user.name}</span>
                            <span className="text-[10px] font-bold text-yellow-300 mt-0.5">{getRoleLabel(user.role)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </motion.div>
      
      {/* Navigation Matrix - Styled like the reference image */}
      <motion.div 
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto pt-8"
        dir="rtl"
      >
        {allowedButtons.map((btn) => {
          const Icon = getIcon(btn.icon);
          return (
            <motion.div 
              key={btn.id}
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -8, scale: 1.02 }}
              onClick={() => {
                if (btn.action.startsWith('navigate:')) {
                  let path = btn.action.split(':')[1];
                  if (isMinia && btn.id === 'm_settings') {
                    path = '/settings';
                  }
                  navigate(path);
                }
              }}
              className="cursor-pointer group h-full"
            >
              <div className="bg-white px-6 py-4 rounded-xl transition-all flex flex-row items-center justify-start shadow-[0_10px_30px_rgba(0,0,0,0.05)] border-2 border-slate-100 hover:border-blue-100 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] h-full min-h-[90px] group gap-4">
                <div className={`w-14 h-14 shrink-0 ${btn.color} rounded-lg flex items-center justify-center text-white group-hover:scale-105 transition-transform shadow-md transform`}>
                    <Icon size={26} strokeWidth={2.5} />
                </div>
                
                <h2 className="text-lg font-black text-slate-800 text-right leading-tight">
                  {btn.labelAr || t(btn.labelKey)}
                </h2>
                
                <div className="hidden"></div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {user && (
          <div className="fixed bottom-6 right-6 flex flex-col items-center gap-3 z-50 no-print" dir="rtl">
              <button 
                  onClick={() => selectWarehouse('')}
                  className="flex items-center justify-between w-full gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white px-5 py-3 rounded-2xl font-black shadow-lg transition-all active:scale-95 border border-indigo-100 group"
              >
                  <span>تغيير المخزن</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                  onClick={() => logout()}
                  className="flex items-center justify-between w-full gap-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-5 py-3 rounded-2xl font-black shadow-lg transition-all active:scale-95 border border-rose-100 group"
              >
                  <span>تسجيل خروج</span>
                  <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
              </button>
          </div>
      )}
    </div>
  );
};
