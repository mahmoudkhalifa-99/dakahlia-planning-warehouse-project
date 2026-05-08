
import React, { useState, useMemo } from 'react';
import { dbService } from '../services/storage';
import { Sale } from '../types';
import { GlassCard } from './NeumorphicUI';
// Added Truck to lucide-react imports
import { Search, Edit2, Printer, Trash2, X, Hash, User, Calendar, Truck } from 'lucide-react';
import { printService } from '../services/printing';
import { useApp } from '../context/AppContext';

export const InvoiceSearch: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { settings, refreshProducts } = useApp();
    const [search, setSearch] = useState('');
    const sales = dbService.getSales();

    const filtered = useMemo(() => {
        if (!search) return sales.slice(-20).reverse();
        return sales.filter(s => 
            s.id.includes(search) || 
            (s.customer || '').includes(search) || 
            (s.carNumber || '').includes(search)
        ).reverse();
    }, [sales, search]);

    const handleDelete = (id: string) => {
        if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إعادة الكميات للمخزن.')) return;
        dbService.deleteMovement(id); // في نظامنا، حذف الفاتورة يتطلب معالجة خاصة للحركات
        refreshProducts();
        alert('تم الحذف بنجاح');
    };

    return (
        <div className="space-y-6 animate-fade-in font-cairo">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 relative w-full">
                    <label className="text-[11px] font-black text-slate-400 mb-1 block uppercase mr-4">بحث برقم الفاتورة أو اسم العميل</label>
                    <input className="w-full p-4 pr-12 rounded-2xl border-2 border-slate-50 bg-slate-50 outline-none focus:border-blue-500 transition-all font-bold text-lg" value={search} onChange={e => setSearch(e.target.value)} placeholder="000123..."/>
                    <Search className="absolute right-4 top-10 text-slate-300" size={24}/>
                </div>
                <button onClick={onBack} className="bg-slate-800 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-black transition-all">إغلاق</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.map(sale => (
                    <GlassCard key={sale.id} className="p-6 border-t-4 border-blue-500 group">
                        <div className="flex justify-between items-start mb-4 border-b pb-4">
                            <div>
                                <h4 className="font-black text-slate-800 text-lg flex items-center gap-2"><Hash size={16} className="text-blue-500"/> {sale.id.slice(-6)}</h4>
                                <p className="text-xs text-slate-400 font-bold flex items-center gap-1"><Calendar size={12}/> {new Date(sale.date).toLocaleDateString('en-GB')}</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => printService.printInvoice(sale, settings)} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all shadow-sm border border-slate-100"><Printer size={18}/></button>
                                <button onClick={() => handleDelete(sale.id)} className="p-2 bg-rose-50 text-rose-300 hover:text-rose-600 rounded-xl transition-all shadow-sm border border-rose-100"><Trash2 size={18}/></button>
                            </div>
                        </div>
                        <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-3"><User size={16} className="text-slate-400"/><span className="font-black text-sm text-slate-700">{sale.customer || 'نقدي'}</span></div>
                            <div className="flex items-center gap-3"><Truck size={16} className="text-slate-400"/><span className="font-mono text-sm text-slate-500">{sale.carNumber} ({sale.carType})</span></div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-2xl flex justify-between items-center group-hover:bg-blue-600 transition-all duration-500">
                            <span className="text-xs font-black text-blue-600 group-hover:text-blue-100">إجمالي الكمية</span>
                            <span className="text-xl font-black text-blue-900 group-hover:text-white" style={{fontFamily: 'Inter'}}>{sale.total.toFixed(3)} طن</span>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </div>
    );
};
