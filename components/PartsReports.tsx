
import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { GlassCard } from './NeumorphicUI';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, AreaChart, Area, Legend 
} from 'recharts';
import { TrendingUp, Package, AlertTriangle, Activity, DollarSign, Layout } from 'lucide-react';

export const PartsReports: React.FC = () => {
    const { settings } = useApp();
    const products = dbService.getProducts().filter(p => p.warehouse === 'parts');
    const movements = dbService.getMovements().filter(m => m.warehouse === 'parts');

    // 1. الإحصائيات العامة
    const stats = useMemo(() => {
        const totalItems = products.length;
        const totalValue = products.reduce((sum, p) => sum + (p.stock * p.cost), 0);
        const lowStock = products.filter(p => p.stock <= (p.minStock || 5)).length;
        const totalIn = movements.filter(m => m.type === 'in').length;
        const totalOut = movements.filter(m => m.type === 'out').length;
        return { totalItems, totalValue, lowStock, totalIn, totalOut };
    }, [products, movements]);

    // 2. تحليل أعلى 8 أصناف قيمة مالية
    const topValueData = useMemo(() => {
        return products
            .map(p => ({ name: p.name.substring(0, 15) + '..', value: p.stock * p.cost }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [products]);

    // 3. تحليل حركة المخزن (وارد vs منصرف) آخر 10 أيام
    const trendData = useMemo(() => {
        const days: Record<string, any> = {};
        for(let i=9; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            days[key] = { date: key.split('-').slice(1).join('/'), وارد: 0, منصرف: 0 };
        }
        movements.forEach(m => {
            const k = m.date.split('T')[0];
            if (days[k]) {
                if (m.type === 'in') days[k].وارد++;
                else if (m.type === 'out') days[k].منصرف++;
            }
        });
        return Object.values(days);
    }, [movements]);

    // 4. توزيع الأصناف حسب حالة المخزون
    const healthData = [
        { name: 'متوفر', value: products.filter(p => p.stock > (p.minStock || 5)).length },
        { name: 'منخفض', value: stats.lowStock },
        { name: 'منتهي', value: products.filter(p => p.stock <= 0).length }
    ];

    const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

    return (
        <div className="space-y-6 animate-fade-in font-cairo" dir="rtl">
            
            {/* Header */}
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                    <Layout size={30} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800">لوحة تحليلات مخزن قطع الغيار</h2>
                    <p className="text-xs text-slate-400 font-bold">مؤشرات الأداء والقيمة المالية الإجمالية</p>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="إجمالي القيمة المالية" value={`${stats.totalValue.toLocaleString()} ${settings.currency}`} icon={<DollarSign/>} color="bg-emerald-500" />
                <StatCard title="إجمالي عدد الأصناف" value={stats.totalItems} icon={<Package/>} color="bg-blue-500" />
                <StatCard title="أصناف تحت حد الطلب" value={stats.lowStock} icon={<AlertTriangle/>} color="bg-rose-500" isAlert />
                <StatCard title="وتيرة العمليات المسجلة" value={movements.length} icon={<Activity/>} color="bg-indigo-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Chart 1: Value Analysis */}
                <GlassCard className="lg:col-span-8 h-[400px] flex flex-col p-6">
                    <h3 className="font-black text-slate-700 mb-8 flex items-center gap-2">
                        <TrendingUp size={20} className="text-indigo-600"/> الأصناف الأعلى استثماراً في المخزن (القيمة المالية)
                    </h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topValueData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} />
                                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius:'15px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                                <Bar dataKey="value" fill="#4f46e5" radius={[0, 10, 10, 0]} barSize={25} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                {/* Chart 2: Health Pie */}
                <GlassCard className="lg:col-span-4 h-[400px] flex flex-col p-6 items-center">
                    <h3 className="font-black text-slate-700 mb-4 self-start">سلامة الأرصدة</h3>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={healthData} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">
                                    {healthData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                {/* Chart 3: Activity Trend */}
                <GlassCard className="lg:col-span-12 h-[350px] flex flex-col p-6">
                    <h3 className="font-black text-slate-700 mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-emerald-600"/> وتيرة التوريد والصرف اليومية (آخر 10 أيام)
                    </h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="date" tick={{fontSize: 11, fontWeight:'bold'}} />
                                <YAxis tick={{fontSize: 11}} />
                                <Tooltip />
                                <Area type="monotone" dataKey="وارد" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                                <Area type="monotone" dataKey="منصرف" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactNode, color: string, isAlert?: boolean }> = ({ title, value, icon, color, isAlert }) => (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-5 group hover:scale-[1.03] transition-all">
        <div className={`p-4 rounded-3xl ${color} text-white shadow-lg group-hover:rotate-6 transition-transform`}>
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">{title}</p>
            <h4 className={`text-2xl font-black ${isAlert && Number(value) > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>{value}</h4>
        </div>
    </div>
);
