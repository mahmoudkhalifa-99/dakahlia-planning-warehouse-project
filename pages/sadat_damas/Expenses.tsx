
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/storage';
import { GlassCard, GlassInput, GlassButton, ConfirmModal } from '../../components/NeumorphicUI';
import { 
    CreditCard, Plus, Trash2, Search, Calendar, 
    ChevronLeft, DollarSign, Wallet, Activity,
    Save, X, FileText, User, Tag, History as HistoryIcon, Lock, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Expense } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const
};

export const Expenses: React.FC = () => {
    const { settings, t, user, addNotification, selectWarehouse } = useApp();
    const navigate = useNavigate();
    const isMinia = user?.selectedWarehouse === 'minia';
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const [form, setForm] = useState<Partial<Expense>>({
        date: new Date().toISOString().split('T')[0],
        category: settings.expenseCategories?.[0] || 'أخرى',
        amount: 0,
        payee: '',
        description: ''
    });

    const expenses = dbService.getExpenses();

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => 
            e.payee.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.category.toLowerCase().includes(searchTerm.toLowerCase())
        ).reverse();
    }, [expenses, searchTerm]);

    const totalAmount = useMemo(() => 
        filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]);

    const canAdd = user?.role === 'admin' || user?.permissions?.features?.exp_add === 'edit' || user?.permissions?.features?.exp_add === 'available';
    const canDelete = user?.role === 'admin' || user?.permissions?.features?.exp_delete === 'edit';

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.amount || form.amount <= 0 || !form.payee) {
            return alert('يرجى إكمال البيانات الأساسية');
        }

        const newExpense: Expense = {
            id: Date.now().toString(),
            date: form.date || new Date().toISOString().split('T')[0],
            category: form.category || 'أخرى',
            amount: Number(form.amount),
            payee: form.payee,
            description: form.description,
            user: user?.name || 'Admin'
        };

        dbService.saveExpense(newExpense);
        addNotification('تم تسجيل المصروف بنجاح', 'success');
        setShowAddForm(false);
        setForm({
            date: new Date().toISOString().split('T')[0],
            category: settings.expenseCategories?.[0] || 'أخرى',
            amount: 0,
            payee: '',
            description: ''
        });
    };

    const handleDelete = () => {
        if (deleteId) {
            dbService.deleteExpense(deleteId);
            addNotification('تم حذف المصروف', 'warning');
            setDeleteId(null);
        }
    };

    return (
        <div className="p-6 space-y-6 font-cairo" dir="rtl">
            <ConfirmModal 
                isOpen={!!deleteId} 
                onClose={() => setDeleteId(null)} 
                onConfirm={handleDelete} 
                title="حذف مصروف" 
                message="هل أنت متأكد من حذف هذا السجل المالي؟" 
                confirmText="حذف" 
                cancelText="إلغاء" 
            />

            {/* Header */}
            <div className={`bg-gradient-to-l from-rose-50 via-white to-rose-50 border-y-4 ${isMinia ? 'border-emerald-600' : 'border-rose-600'} shadow-premium px-10 py-6 flex items-center justify-between h-32 animate-fade-in mb-8 rounded-[2rem]`}>
                 <div className="flex items-center gap-3 relative z-10 font-cairo">
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 bg-[#1e293b] hover:bg-black text-white px-6 py-2.5 rounded-xl font-black shadow-xl transition-all active:scale-95 group border border-slate-700/50 text-sm">
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> 
                        <span>رجوع للرئيسية</span>
                    </button>
                 </div>
                 <div className="text-center">
                    <h1 className="text-5xl font-black text-rose-900 leading-tight drop-shadow-sm">{settings.language === 'ar' ? 'المصروفات' : 'Expenses'}</h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">إدارة المصروفات التشغيلية والنثريات</p>
                 </div>
                 <div className="p-4 bg-white border border-rose-100 text-rose-600 rounded-[1.5rem] shadow-xl shrink-0"><CreditCard size={38}/></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left: Summary & Stats */}
                <div className="lg:col-span-4 space-y-6">
                    <GlassCard className="bg-rose-600 text-white p-8 rounded-[2.5rem] border-none shadow-xl flex flex-col items-center justify-center gap-4 text-center">
                        <div className="p-4 bg-white/20 rounded-full shadow-inner"><Wallet size={48}/></div>
                        <div>
                            <p className="text-sm font-bold opacity-80 mb-1">إجمالي المصروفات المعروضة</p>
                            <h2 className="text-4xl font-black" style={forceEnNumsStyle}>{totalAmount.toLocaleString()} <span className="text-xl">{settings.currency}</span></h2>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-6 rounded-[2rem] border-none shadow-lg">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-slate-800">أدوات التحكم</h3>
                            <Activity className="text-rose-500" size={20}/>
                        </div>
                        {canAdd ? (
                            <button 
                                onClick={() => setShowAddForm(true)}
                                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 active:scale-95 mb-4"
                            >
                                <Plus size={24}/> {settings.language === 'ar' ? 'إضافة مصروف' : 'Add Expense'}
                            </button>
                        ) : (
                            <div className="w-full bg-slate-100 text-slate-400 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 mb-4 cursor-not-allowed border-2 border-dashed border-slate-200">
                                <Lock size={20}/> عرض فقط
                            </div>
                        )}
                        <div className="relative">
                            <input 
                                className="w-full pr-10 pl-4 py-3 rounded-2xl border-2 border-slate-100 outline-none focus:border-rose-400 font-bold text-sm bg-slate-50 shadow-inner"
                                placeholder="بحث في السجلات..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute right-3 top-3.5 text-slate-300" size={18}/>
                        </div>
                    </GlassCard>
                </div>

                {/* Right: Table */}
                <div className="lg:col-span-8">
                    <GlassCard className="p-0 rounded-[2.5rem] border-none shadow-xl overflow-hidden min-h-[500px] flex flex-col bg-white">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <h3 className="font-black flex items-center gap-3"><HistoryIcon className="text-rose-400"/> سجل الحركات المالية</h3>
                            <span className="bg-rose-600 px-4 py-1 rounded-full text-xs font-black">{filteredExpenses.length} سجل مالي</span>
                        </div>
                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-center border-collapse">
                                <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b h-12">
                                    <tr>
                                        <th className="p-4">التاريخ</th>
                                        <th className="p-4">الفئة</th>
                                        <th className="p-4 text-right">المستلم/الجهة</th>
                                        <th className="p-4">البيان</th>
                                        <th className="p-4">المبلغ</th>
                                        <th className="p-4">المستخدم</th>
                                        <th className="p-4">حذف</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-bold text-slate-700">
                                    {filteredExpenses.map((exp) => (
                                        <tr key={exp.id} className="border-b border-slate-50 hover:bg-rose-50/30 h-16 transition-colors">
                                            <td className="p-4 font-mono text-slate-400" style={forceEnNumsStyle}>{exp.date}</td>
                                            <td className="p-4">
                                                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black border border-slate-200">{exp.category}</span>
                                            </td>
                                            <td className="p-4 text-right font-black text-slate-900">{exp.payee}</td>
                                            <td className="p-4 text-xs text-slate-400 italic max-w-xs truncate">{exp.description}</td>
                                            <td className="p-4 text-rose-600 font-black text-lg" style={forceEnNumsStyle}>{exp.amount.toLocaleString()}</td>
                                            <td className="p-4 text-[10px] text-slate-300 font-bold">{exp.user}</td>
                                            <td className="p-4">
                                                {canDelete && (
                                                    <button onClick={() => setDeleteId(exp.id)} className="text-slate-300 hover:text-rose-600 transition-colors p-2"><Trash2 size={18}/></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredExpenses.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-20 text-slate-200 font-black italic text-2xl">لا توجد سجلات مصروفات مسجلة</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>
                </div>
            </div>

            {/* Add Expense Modal */}
            <AnimatePresence>
                {showAddForm && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border-t-8 border-rose-600">
                            <form onSubmit={handleSave} className="p-10 space-y-6">
                                <div className="text-center mb-8">
                                    <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-inner">
                                        <Plus size={40} />
                                    </div>
                                    <h3 className="font-black text-2xl text-slate-800">تسجيل مصروف جديد</h3>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 mb-1 block mr-2 uppercase">المبلغ المستحق</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                step="any" 
                                                required
                                                className="w-full p-5 rounded-2xl border-none bg-slate-50 shadow-inner font-black text-3xl text-center text-rose-600 outline-none focus:ring-4 focus:ring-rose-100"
                                                value={form.amount || ''}
                                                onChange={e => setForm({...form, amount: Number(e.target.value)})}
                                                autoFocus
                                                style={forceEnNumsStyle}
                                            />
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-200" size={24}/>
                                        </div>
                                    </div>
                                    
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-black text-slate-400 mb-1 block mr-2 uppercase">التاريخ</label>
                                        <input type="date" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none" value={form.date} onChange={e => setForm({...form, date: e.target.value})} style={forceEnNumsStyle}/>
                                    </div>
                                    
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-black text-slate-400 mb-1 block mr-2 uppercase">البند / الفئة</label>
                                        <select className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                                            {settings.expenseCategories?.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 mb-1 block mr-2 uppercase">المستلم / الجهة</label>
                                        <input className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none shadow-inner" value={form.payee} onChange={e => setForm({...form, payee: e.target.value})} placeholder="من الذي استلم المبلغ؟"/>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 mb-1 block mr-2 uppercase">البيان / الوصف</label>
                                        <textarea className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none shadow-inner h-24 resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="تفاصيل إضافية للمصروف..."/>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-4 bg-slate-100 rounded-3xl text-slate-500 font-black hover:bg-slate-200 transition-all">إلغاء</button>
                                    <button type="submit" className="flex-[2] py-4 bg-rose-600 rounded-3xl text-white font-black shadow-xl hover:bg-rose-700 transition-all border-b-4 border-rose-900 active:scale-95">حفظ الترحيل</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
