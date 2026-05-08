
import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from './NeumorphicUI';
import { 
    Activity, Truck, Timer, CheckCircle2, Clock, 
    ArrowUpRight, TrendingUp, AlertCircle, ShoppingBag, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';

export const LogisticsPulse: React.FC = () => {
    const { sales } = useApp();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const stats = useMemo(() => {
        const todaySales = sales.filter(s => s.date && s.date.startsWith(todayStr));
        const activeLoading = todaySales.filter(s => !s.exitTime && s.entranceTime);
        const completedToday = todaySales.filter(s => s.exitTime);
        
        const totalQty = todaySales.reduce((sum, s) => sum + s.total, 0);
        
        return {
            totalToday: todaySales.length,
            activeCount: activeLoading.length,
            completedCount: completedToday.length,
            totalQty: totalQty.toFixed(3),
            recentSales: todaySales.slice(-5).reverse()
        };
    }, [sales, todayStr]);

    return (
        <div className="space-y-6 animate-fade-in font-cairo" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <PulseCard title="إجمالي سيارات اليوم" value={stats.totalToday} icon={<Truck/>} color="bg-blue-600" />
                <PulseCard title="سيارات قيد التحميل" value={stats.activeCount} icon={<Timer/>} color="bg-orange-500" isPulse />
                <PulseCard title="شحنات مكتملة" value={stats.completedCount} icon={<CheckCircle2/>} color="bg-emerald-600" />
                <PulseCard title="إجمالي الكميات (طن)" value={stats.totalQty} icon={<Zap/>} color="bg-indigo-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard className="p-6">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2 border-b pb-4 text-slate-800">
                        <Activity className="text-blue-600"/> آخر الحركات اللوجستية
                    </h3>
                    <div className="space-y-4">
                        {stats.recentSales.map(sale => (
                            <div key={sale.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-lg transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-blue-50 text-blue-600 transition-colors">
                                        <Truck size={24}/>
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-800 text-sm">{sale.customer || 'نقدي'}</h4>
                                        <p className="text-[10px] text-slate-400 font-bold">{sale.carNumber} | {sale.carType}</p>
                                    </div>
                                </div>
                                <div className="text-left">
                                    <span className="text-lg font-black text-blue-700" style={{fontFamily: 'Inter'}}>{sale.total.toFixed(3)}</span>
                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{sale.shift} - {new Date(sale.date).toLocaleTimeString('en-US', {hour12:true, hour:'2-digit', minute:'2-digit'})}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>

                <GlassCard className="p-6 bg-[#0f172a] text-white">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2 border-b border-slate-700 pb-4">
                        <TrendingUp className="text-yellow-400"/> مؤشرات الأداء اليومي
                    </h3>
                    <div className="space-y-8">
                        <PerformanceMetric label="كفاءة التحميل" percent={85} color="bg-emerald-500" />
                        <PerformanceMetric label="جاهزية السيارات" percent={92} color="bg-blue-500" />
                        <PerformanceMetric label="سرعة الدوران" percent={78} color="bg-amber-500" />
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};

const PulseCard = ({ title, value, icon, color, isPulse }: any) => (
    <GlassCard className={`p-6 border-r-8 ${color.replace('bg-', 'border-')} relative overflow-hidden`}>
        {isPulse && <div className="absolute top-2 left-2 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>}
        <div className="flex justify-between items-start">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">{title}</p>
                <h2 className="text-3xl font-black text-slate-800" style={{fontFamily: 'Inter'}}>{value}</h2>
            </div>
            <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}>{icon}</div>
        </div>
    </GlassCard>
);

const PerformanceMetric = ({ label, percent, color }: any) => (
    <div className="space-y-2">
        <div className="flex justify-between text-xs font-black uppercase tracking-widest">
            <span>{label}</span>
            <span className="text-yellow-400">{percent}%</span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${percent}%` }} 
                className={`h-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
            />
        </div>
    </div>
);
