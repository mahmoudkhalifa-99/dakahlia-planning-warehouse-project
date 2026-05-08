
import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { GlassCard } from './NeumorphicUI';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, AreaChart, Area, Legend 
} from 'recharts';
import { TrendingUp, Package, AlertTriangle, Activity, Utensils, Layout } from 'lucide-react';

export const CateringReports: React.FC = () => {
    const { settings } = useApp();
    const products = dbService.getProducts().filter(p => p.warehouse === 'catering');
    const movements = dbService.getMovements().filter(m => m.warehouse === 'catering');

    const stats = useMemo(() => {
        const totalItems = products.length;
        const totalValue = products.reduce((sum, p) => sum + (p.stock * p.cost), 0);
        const lowStock = products.filter(p => p.stock <= (p.minStock || 5)).length;
        return { totalItems, totalValue, lowStock };
    }, [products]);

    const topItemsData = useMemo(() => {
        return products
            .map(p => ({ name: p.name.substring(0, 12) + '..', value: p.stock }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [products]);

    const COLORS = ['#10b981', '#f59e0b', '#ef4444'];
    const healthData = [
        { name: 'متوفر', value: products.filter(p => p.stock > (p.minStock || 5)).length },
        { name: 'منخفض', value: stats.lowStock },
        { name: 'منتهي', value: products.filter(p => p.stock <= 0).length }
    ];

    return (
        <div className="space-y-6 animate-fade-in font-cairo" dir="rtl">
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200">
                    <Utensils size={30} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800">تحليلات مخزن الإعاشة</h2>
                    <p className="text-xs text-slate-400 font-bold">مؤشرات توفر الوجبات والمواد التموينية</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="إجمالي القيمة التقديرية" value={`${stats.totalValue.toLocaleString()} ${settings.currency}`} icon={<Package/>} color="bg-emerald-500" />
                <StatCard title="الأصناف النشطة" value={stats.totalItems} icon={<Layout/>} color="bg-blue-500" />
                <StatCard title="أصناف تحتاج شراء" value={stats.lowStock} icon={<AlertTriangle/>} color="bg-rose-500" isAlert />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <GlassCard className="lg:col-span-8 h-[400px] flex flex-col p-6">
                    <h3 className="font-black text-slate-700 mb-8 flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-600"/> الأصناف الأكثر توفراً (الكمية)
                    </h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topItemsData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                                <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} />
                                <YAxis tick={{fontSize: 10}} />
                                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius:'15px', border:'none'}} />
                                <Bar dataKey="value" fill="#10b981" radius={[10, 10, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                <GlassCard className="lg:col-span-4 h-[400px] flex flex-col p-6 items-center">
                    <h3 className="font-black text-slate-700 mb-4 self-start">جاهزية المخزون</h3>
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
