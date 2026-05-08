
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/NeumorphicUI';
import { useNavigate } from 'react-router-dom';
import { getIcon, getRoleLabel } from '../utils/icons';
import { UserCircle2, Sparkles, Clock as ClockIcon, ArrowRight } from 'lucide-react';
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
  const { t, user, uiConfig, settings, selectWarehouse } = useApp();
  const navigate = useNavigate();
  const mainConfig = settings.mainScreenSettings;

  const allowedButtons = useMemo(() => {
      if (!user) return [];
      return uiConfig.main.buttons.filter(btn => {
          if (!btn.isVisible) return false;
          
          // If user is in Minia, check if button belongs to Minia (or is settings)
          if (user.selectedWarehouse === 'minia') {
              if (btn.warehouseId !== 'minia' && btn.id !== 'm_settings') return false;
          } else {
              // Filter by warehouseId if specified for other warehouses
              if (btn.warehouseId && btn.warehouseId !== user.selectedWarehouse) {
                  return false;
              }
          }

          if (user.role === 'admin') return true;
          
          // Special handling for settings button
          if (btn.id === 'm_settings' || btn.id === 'sb_settings') {
              return user.permissions?.actions?.canEditSettings || false;
          }

          const permissionKey = btn.id.startsWith('m_') ? btn.id.replace('m_', 'sb_') : btn.id;
          const level = user.permissions?.screens?.[permissionKey] || user.permissions?.features?.[btn.id];
          return level === 'available' || level === 'edit';
      });
  }, [uiConfig.main.buttons, user, user?.selectedWarehouse, user?.permissions]);

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

        <div className="absolute inset-0 flex items-center px-12 z-10">
            <div className="w-1/3 flex justify-start items-center gap-6">
                <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => selectWarehouse('')}
                    className="p-4 bg-white/10 hover:bg-white/20 rounded-[22px] border border-white/20 backdrop-blur-md text-white flex items-center gap-2 font-black text-xs group transition-all"
                >
                    <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                    <span className="hidden xl:inline">تغيير المخزن</span>
                </motion.button>
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
                  const path = btn.action.split(':')[1];
                  navigate(path);
                }
              }}
              className="cursor-pointer group h-full"
            >
              <div className="bg-white p-12 rounded-[50px] transition-all flex flex-col items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.05)] border-4 border-white hover:border-blue-100 hover:shadow-[0_40px_100px_rgba(0,0,0,0.1)] h-full min-h-[280px] group">
                <div className={`w-24 h-24 ${btn.color} rounded-[35px] flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-xl transform group-hover:rotate-3`}>
                    <Icon size={48} strokeWidth={2.5} />
                </div>
                
                <h2 className="text-2xl font-black text-slate-800 text-center leading-tight">
                  {btn.labelAr || t(btn.labelKey)}
                </h2>
                
                <div className="mt-6 w-12 h-1.5 bg-slate-100 rounded-full group-hover:w-24 group-hover:bg-blue-500 transition-all duration-500"></div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {user && (
          <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-white/90 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white shadow-xl no-print z-50">
              <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center text-white shadow-md transform -rotate-2"><UserCircle2 size={20} /></div>
              <div className="flex flex-col leading-none">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">مستخدم النظام</span>
                <span className="text-sm font-black text-slate-800">{user.name}</span>
                <span className="text-[9px] font-bold text-blue-500">{getRoleLabel(user.role)}</span>
              </div>
          </div>
      )}
    </div>
  );
};
