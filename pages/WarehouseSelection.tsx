import React from 'react';
import { useApp } from '../context/AppContext';
import { Warehouse, MapPin, ArrowRight, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { WAREHOUSES } from '../src/constants/warehouses';
import { useNavigate } from 'react-router-dom';

export const WarehouseSelection: React.FC = () => {
  const { user, selectWarehouse, logout } = useApp();
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  if (!user) return null;

  // Filter warehouses based on user permissions
  const allowedWarehouses = WAREHOUSES.filter(w => 
    user.role === 'admin' || (user.allowedWarehouses && user.allowedWarehouses.includes(w.id))
  );

  const handleSelect = async (id: string) => {
    setLoadingId(id);
    await selectWarehouse(id);
    // Navigate to home after selection
    navigate('/', { replace: true });
  };

  const getIcon = (id: string) => {
    if (id === 'damas') return <Warehouse className="text-blue-600" size={32} />;
    if (id === 'sadat') return <MapPin className="text-emerald-600" size={32} />;
    if (id === 'minia') return <MapPin className="text-orange-600" size={32} />;
    return <MapPin className="text-slate-600" size={32} />;
  };

  return (
    <div 
      className="min-h-screen bg-[#f4f7fa] flex items-center justify-center p-6 font-cairo relative overflow-hidden" 
      dir="rtl"
    >
      {/* Background Ornaments */}
      <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-3xl"></div>
          <div className="absolute top-[40%] left-[20%] w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl"></div>
      </div>

      {/* Logout Button in Selection Screen */}
      <div className="absolute top-8 left-8 z-20">
        <button 
          onClick={() => logout()}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all font-black text-sm border border-slate-100 shadow-[0_5px_15px_rgba(0,0,0,0.05)] active:scale-95 group"
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>تسجيل الخروج</span>
        </button>
      </div>

      <div className="max-w-6xl w-full z-10">
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black text-slate-800 mb-4 tracking-tight drop-shadow-sm"
          >
            مرحباً بك، <span className="text-blue-600">{user.name}</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 font-bold text-lg"
          >
            يرجى اختيار المستودع المطلوب للبدء في العمل
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-12">
          {allowedWarehouses.map((w, index) => {
            
            // Generate vibrant accent colors based on warehouse
            let gradientStr = "";
            let accentColorClass = "";
            let textColorClass = "";
            let hoverBgClass = "";

            if (w.id === 'damas') {
                gradientStr = "from-blue-50 to-blue-100";
                accentColorClass = "bg-blue-500";
                textColorClass = "text-blue-600";
                hoverBgClass = "group-hover:border-blue-300 group-hover:shadow-[0_20px_40px_rgba(37,99,235,0.15)]";
            } else if (w.id === 'sadat') {
                gradientStr = "from-emerald-50 to-emerald-100";
                accentColorClass = "bg-emerald-500";
                textColorClass = "text-emerald-600";
                hoverBgClass = "group-hover:border-emerald-300 group-hover:shadow-[0_20px_40px_rgba(16,185,129,0.15)]";
            } else if (w.id === 'minia') {
                gradientStr = "from-orange-50 to-orange-100";
                accentColorClass = "bg-orange-500";
                textColorClass = "text-orange-600";
                hoverBgClass = "group-hover:border-orange-300 group-hover:shadow-[0_20px_40px_rgba(249,115,22,0.15)]";
            } else {
                gradientStr = "from-slate-50 to-slate-100";
                accentColorClass = "bg-slate-500";
                textColorClass = "text-slate-600";
                hoverBgClass = "group-hover:border-slate-300 group-hover:shadow-[0_20px_40px_rgba(100,116,139,0.15)]";
            }

            return (
            <motion.button
              key={w.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 + 0.2, type: 'spring', stiffness: 100 }}
              onClick={() => handleSelect(w.id)}
              disabled={loadingId !== null}
              className={`
                group relative bg-white p-8 rounded-[2.5rem] shadow-[0_15px_35px_rgba(0,0,0,0.04)] 
                border-2 border-transparent transition-all duration-300 overflow-hidden text-right flex flex-col items-start min-h-[280px]
                ${hoverBgClass}
                ${loadingId === w.id ? `ring-4 ring-offset-2 ring-opacity-50 ${textColorClass.replace('text-', 'ring-')}` : ''} 
                ${loadingId !== null && loadingId !== w.id ? 'opacity-40 cursor-not-allowed scale-95 grayscale-[50%]' : 'hover:-translate-y-2'}
              `}
            >
              {/* Top gradient accent line */}
              <div className={`absolute top-0 left-0 w-full h-2 ${accentColorClass}`} />
              
              <div className={`w-16 h-16 rounded-2xl mb-8 flex items-center justify-center bg-gradient-to-br ${gradientStr} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-inner`}>
                {getIcon(w.id)}
              </div>
              
              <h2 className="text-3xl font-black text-slate-800 mb-3 group-hover:text-black transition-colors">{w.name}</h2>
              <p className="text-slate-400 font-bold mb-8 text-sm flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                <MapPin size={16} className={textColorClass} />
                الموقع الجغرافي: {w.location}
              </p>
              
              <div className={`mt-auto w-full flex items-center justify-between font-black transition-all ${textColorClass}`}>
                {loadingId === w.id ? (
                  <div className="flex items-center justify-center w-full gap-3 bg-slate-50 py-3 rounded-xl border border-slate-100">
                    <div className={`w-5 h-5 border-3 border-t-transparent rounded-full animate-spin ${textColorClass.replace('text-', 'border-')}`} />
                    <span>جاري تسجيل الدخول...</span>
                  </div>
                ) : (
                  <>
                    <span className="group-hover:tracking-wide transition-all duration-300">بدء العمل بالمستودع</span>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-transparent group-hover:bg-gradient-to-tr group-hover:${gradientStr} transition-colors`}>
                        <ArrowRight size={22} className="rotate-180 group-hover:-translate-x-1.5 transition-transform" />
                    </div>
                  </>
                )}
              </div>

              {/* Decorative Background Element */}
              <div className={`absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-0 group-hover:opacity-20 transition-all duration-700 blur-2xl ${accentColorClass}`} />
            </motion.button>
          )})}

          {user.role === 'admin' && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              onClick={() => navigate('/feed-analytical-report')}
              className="group relative bg-gradient-to-br from-blue-900 to-blue-800 p-8 rounded-[2.5rem] shadow-xl border-4 border-white/10 overflow-hidden text-right flex flex-col items-start min-h-[280px] hover:-translate-y-2 transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-2xl mb-8 flex items-center justify-center bg-white/10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-inner">
                <i className="fas fa-file-contract text-white text-3xl"></i>
              </div>
              
              <h2 className="text-3xl font-black text-white mb-3 text-center w-full">التقرير التحليلي</h2>
              <p className="text-white/60 font-bold mb-8 text-sm text-center w-full">إحصائيات قطاع الأعلاف اليومي والشهرية</p>
              
              <div className="mt-auto w-full flex items-center justify-between font-black text-white px-2">
                <span className="group-hover:tracking-wide transition-all duration-300">عرض التقرير العام</span>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 group-hover:bg-white/20 transition-colors">
                    <ArrowRight size={22} className="rotate-180 group-hover:-translate-x-1.5 transition-transform" />
                </div>
              </div>
              
              <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-10 blur-2xl bg-white" />
            </motion.button>
          )}

          {allowedWarehouses.length === 0 && user.role !== 'admin' && (
            <div className="col-span-full bg-rose-50 border-2 border-rose-100 p-12 rounded-[3rem] text-center shadow-xl">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <LogOut className="text-rose-500" size={32} />
              </div>
              <p className="text-rose-600 font-black text-xl mb-8 max-w-lg mx-auto leading-relaxed">عذراً، ليس لديك صلاحية للوصول إلى أي مستودع حالياً. يرجى التواصل مع مسؤول النظام لمنحك الصلاحيات اللازمة.</p>
              <button 
                onClick={() => logout()}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-rose-600 text-white hover:bg-rose-700 transition-all font-black text-base shadow-xl shadow-rose-200 active:scale-95"
              >
                <span>العودة لشاشة تسجيل الدخول</span>
                <ArrowRight size={22} className="rotate-180" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
