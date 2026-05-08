
import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { GlassCard } from './NeumorphicUI';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, AreaChart, Area, Legend 
} from 'recharts';
import { TrendingUp, Package, AlertTriangle, Activity, DollarSign } from 'lucide-react';

export const PartsAnalytics: React.FC = () => {
    const { settings } = useApp();
    const products = dbService.getProducts().filter(p => p.warehouse === 'parts');
    const movements = dbService.getMovements().filter(m => m.warehouse === 'parts');

    // 1. حسابات البطاقات الإحصائية
    const stats = useMemo(() => {
        const totalItems = products.length;
        const totalValue = products.reduce((sum, p) => sum + (p.stock * p.cost), 0);
        const lowStockItems = products.filter(p => p.stock <= (p.minStock || 5)).length;
        return { totalItems, totalValue, lowStockItems };
    }, [products]);

    // 2. بيانات أعلى 10 أصناف قيمة (Bar Chart)
    const topValueItems = useMemo(() => {
        return products
            .map(p => ({ name: p.name, value: p.stock * p.cost }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [products]);

    // 3. بيانات حركة المخزن (Pie Chart)
    const movementDistribution = useMemo(() => {
        const types = { 'In/وارد': 0, 'Out/صرف': 0, 'Adj/تسوية': 0 };
        movements.forEach(m => {
            if (m.type === 'in') types['In/وارد']++;
            else if (m.type === 'out') types['Out/صرف']++;
            else types['Adj/تسوية']++;
        });
        return Object.entries(types).map(([name, value]) => ({ name, value }));
    }, [movements]);

    // 4. وتيرة العمليات (Area Chart) - آخر 7 أيام
    const activityTrend = useMemo(() => {
        const days: Record<string, number> = {};
        for(let i=6; i>=0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days[d.toISOString().split('T')[0]] = 0;
        }
        
        movements.forEach(m => {
            const date = m.date.split('T')[0];
            if (days[date] !== undefined) days[date]++;
        });

        return Object.entries(days).map(([date, count]) => ({
            date: date.split('-').slice(1).join('/'),
            count
        }));
    }, [movements]);

    const PIE_COLORS = ['#10b981', '#f59e0b', '#8b5cf6'];

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {/* بطاقات الإحصائيات */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="إجمالي قيمة المخزون" 
                    value={`${stats.totalValue.toLocaleString()} ${settings.currency}`}
                    icon={<DollarSign className="text-emerald-500"/>}
                    sub="إجمالي تكلفة قطع الغيار الحالية"
                />
                <StatCard 
                    title="عدد الأصناف المسجلة" 
                    value={stats.totalItems}
                    icon={<Package className="text-blue-500"/>}
                    sub="صنف مسجل في قاعدة البيانات"
                />
                <StatCard 
                    title="أصناف قاربت على النفاذ" 
                    value={stats.lowStockItems}
                    icon={<AlertTriangle className="text-orange-500"/>}
                    sub="تنبيه: أصناف رصيدها أقل من الحد الأدنى"
                    isAlert={stats.lowStockItems > 0}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* أعلى 10 أصناف قيمة */}
                <GlassCard className="h-[400px] flex flex-col p-6">
                    <h3 className="font-black text-gray-700 mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-indigo-600"/> أعلى 10 أصناف من حيث القيمة المالية
                    </h3>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topValueItems} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3}/>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(val: number) => [`${val.toLocaleString()} ${settings.currency}`, 'القيمة']}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                {/* توزيع العمليات وتوجه النشاط */}
                <div className="space-y-6">
                    <GlassCard className="h-[250px] p-6">
                        <h3 className="font-black text-gray-700 mb-4 flex items-center gap-2">
                            <Activity size={20} className="text-emerald-600"/> وتيرة العمليات (آخر 7 أيام)
                        </h3>
                        <div className="h-[150px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activityTrend}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" tick={{fontSize: 10}} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={1} fill="url(#colorCount)" name="عدد العمليات" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </GlassCard>

                    <GlassCard className="h-[200px] p-6 flex items-center">
                        <div className="flex-1">
                            <h3 className="font-black text-gray-700 mb-2">توزيع أنواع الحركات</h3>
                            <p className="text-xs text-gray-400">نسبة الوارد والصرف والتسويات</p>
                        </div>
                        <div className="w-[150px] h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={movementDistribution}
                                        innerRadius={40}
                                        outerRadius={60}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {movementDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactNode, sub: string, isAlert?: boolean }> = ({ title, value, icon, sub, isAlert }) => (
    <GlassCard className={`p-6 border-r-4 ${isAlert ? 'border-orange-500' : 'border-indigo-500'}`}>
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/50 rounded-2xl shadow-inner">{icon}</div>
            {isAlert && <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded text-[10px] font-black animate-pulse">تنبيه</span>}
        </div>
        <h4 className="text-gray-400 text-xs font-black mb-1">{title}</h4>
        <h2 className="text-2xl font-black text-slate-800 mb-2">{value}</h2>
        <p className="text-[10px] text-gray-400 font-bold">{sub}</p>
    </GlassCard>
);
