
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard, GlassInput, GlassButton, ConfirmModal } from '../components/NeumorphicUI';
import { 
    Users, Truck, Warehouse, UserCog, Scale, UserCheck, 
    Layers, LayoutList, Ruler, Tags, History, CreditCard, 
    Car, Undo2, Building2, HardHat, ClipboardCheck, 
    Plus, Trash2, Search, FileDown, FileUp, ChevronLeft, 
    X, Save, CheckCircle2, Phone, MapPin, Hash, Settings, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppSettings, Client, Vendor } from '../types';
import * as XLSX from 'xlsx';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const
};

interface ListCategory {
    id: keyof AppSettings;
    label: string;
    icon: React.ReactNode;
    isComplex?: boolean; 
}

const Clock = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;

const LIST_CATEGORIES: ListCategory[] = [
    { id: 'clients', label: 'العملاء', icon: <UserCheck size={18}/>, isComplex: true },
    { id: 'vendors', label: 'الموردين', icon: <Truck size={18}/>, isComplex: true },
    { id: 'storekeepers', label: 'المخزن التابع له', icon: <Warehouse size={18}/> },
    { id: 'storekeepersRaw', label: 'أمناء مخازن الخامات', icon: <UserCog size={18}/> },
    { id: 'storekeepersParts', label: 'أمناء مخازن قطع الغيار', icon: <UserCog size={18}/> },
    { id: 'storekeepersFinished', label: 'أمناء مخازن المنتج التام', icon: <UserCog size={18}/> },
    { id: 'rawTransportCompanies', label: 'شركات النقل للخامات', icon: <Truck size={18}/> },
    { id: 'executionEntities', label: 'جهة التنفيذ', icon: <ShieldCheck size={18}/> },
    { id: 'weighmasters', label: 'الوزان', icon: <Scale size={18}/> },
    { id: 'inspectors', label: 'القائم بالفحص خامات', icon: <UserCheck size={18}/> },
    { id: 'departments', label: 'الأقسام', icon: <Layers size={18}/> },
    { id: 'loadingOfficers', label: 'مسؤولي التحميل', icon: <Users size={18}/> },
    { id: 'confirmationOfficers', label: 'مسؤولي تأكيد الخروج', icon: <CheckCircle2 size={18}/> },
    { id: 'transportMethods', label: 'طرق النقل', icon: <Truck size={18}/> },
    { id: 'carTypes', label: 'أنواع السيارات', icon: <Car size={18}/> },
    { id: 'miniaItems', label: 'الأصناف بالاكواد', icon: <Layers size={18}/>, isComplex: true },
    { id: 'shifts', label: 'الورديات', icon: <Clock size={18}/> },
    { id: 'returnReasons', label: 'أسباب الارتجاع', icon: <Undo2 size={18}/> },
    { id: 'units', label: 'وحدات القياس', icon: <Ruler size={18}/> },
    { id: 'categories', label: 'تصنيفات الأصناف', icon: <Tags size={18}/> },
    { id: 'salesTypes', label: 'أنواع المبيعات', icon: <LayoutList size={18}/> },
    { id: 'paymentMethods', label: 'طرق الدفع', icon: <CreditCard size={18}/> },
];

export const ListManagement: React.FC = () => {
    const { settings, updateSettings, addNotification, user } = useApp();
    const navigate = useNavigate();

    const filteredCategories = useMemo(() => {
        if (user?.selectedWarehouse === 'minia') {
            const miniaAllowed = ['clients', 'miniaItems', 'transportMethods', 'shifts', 'carTypes', 'vendors'];
            return LIST_CATEGORIES.filter(cat => miniaAllowed.includes(cat.id)).map(cat => {
                if (cat.id === 'clients') return { ...cat, label: 'اسماء العملاء بالاكواد' };
                if (cat.id === 'vendors') return { ...cat, label: 'اسم المورد' };
                if (cat.id === 'transportMethods') return { ...cat, label: 'طريقة النقل' };
                if (cat.id === 'shifts') return { ...cat, label: 'الورديه' };
                if (cat.id === 'carTypes') return { ...cat, label: 'نوع السياره' };
                return cat;
            });
        }
        return LIST_CATEGORIES;
    }, [user?.selectedWarehouse]);

    const [selectedCategoryId, setSelectedCategoryId] = useState<keyof AppSettings>(() => {
        if (user?.selectedWarehouse === 'minia') return 'clients';
        return 'clients';
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, index: number | string }>({ isOpen: false, index: -1 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [simpleInput, setSimpleInput] = useState('');
    const [complexInput, setComplexInput] = useState<Partial<Client>>({ code: '', name: '', phone: '', address: '' });

    const selectedCategory = useMemo(() => 
        filteredCategories.find(c => c.id === selectedCategoryId) || filteredCategories[0], 
    [selectedCategoryId, filteredCategories]);

    const listData = useMemo(() => {
        const rawData = settings[selectedCategoryId];
        const data = Array.isArray(rawData) ? rawData : [];
        if (!searchTerm) return data;
        return data.filter(item => {
            if (!item) return false;
            const str = typeof item === 'string' ? item : `${item.name || ''} ${item.code || ''} ${item.phone || ''}`;
            return str.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [settings, selectedCategoryId, searchTerm]);

    const handleAddItem = () => {
        const currentRaw = settings[selectedCategoryId];
        const currentList = Array.isArray(currentRaw) ? [...currentRaw] : [];
        
        if (selectedCategory.isComplex) {
            if (!complexInput.name || !complexInput.code) return alert('الاسم والكود مطلوبان');
            const newItem = { ...complexInput, id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` };
            updateSettings({ ...settings, [selectedCategoryId]: [...currentList, newItem] });
            setComplexInput({ code: '', name: '', phone: '', address: '' });
        } else {
            const val = simpleInput.trim();
            if (!val) return;
            if (currentList.includes(val)) return alert('العنصر موجود بالفعل');
            updateSettings({ ...settings, [selectedCategoryId]: [...currentList, val] });
            setSimpleInput('');
        }
        addNotification('تمت الإضافة بنجاح', 'success');
    };

    const handleDelete = () => {
        const currentRaw = settings[selectedCategoryId];
        const currentList = Array.isArray(currentRaw) ? [...currentRaw] : [];
        let newList;
        if (selectedCategory.isComplex) {
            newList = currentList.filter((item: any) => item && item.id !== deleteConfirm.index);
        } else {
            newList = currentList.filter((_, idx) => idx !== deleteConfirm.index);
        }
        updateSettings({ ...settings, [selectedCategoryId]: newList });
        setDeleteConfirm({ isOpen: false, index: -1 });
        addNotification('تم الحذف بنجاح', 'warning');
    };

    const handleExport = () => {
        const dataToExport = selectedCategory.isComplex 
            ? listData.map(item => ({ 'الكود': item.code, 'الاسم': item.name, 'الهاتف': item.phone, 'العنوان': item.address }))
            : listData.map(v => ({ [selectedCategory.label]: v }));
            
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, `List_${selectedCategoryId}_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                
                if (!rows || rows.length < 1) return alert('الملف فارغ أو غير متوافق');

                const headers = Array.from(rows[0] || []).map(h => String(h || '').toLowerCase().trim());
                const dataRows = rows.slice(1);

                const currentRaw = settings[selectedCategoryId];
                const currentList = Array.isArray(currentRaw) ? [...currentRaw] : [];
                let importedCount = 0;
                const importTimestamp = Date.now();

                if (selectedCategory.isComplex) {
                    let nameIdx = headers.findIndex(h => (h.includes('اسم') || h.includes('name')) && !h.includes('كود') && !h.includes('code'));
                    let codeIdx = headers.findIndex(h => h.includes('كود') || h.includes('code') || h.includes('id') || h.includes('رقم'));
                    let phoneIdx = headers.findIndex(h => h.includes('هاتف') || h.includes('تليفون') || h.includes('phone') || h.includes('mobile'));
                    let addrIdx = headers.findIndex(h => h.includes('عنوان') || h.includes('address'));

                    if (nameIdx === -1 && codeIdx === -1) {
                        codeIdx = 0;
                        nameIdx = 1;
                        phoneIdx = 2;
                        addrIdx = 3;
                    } else {
                        if (nameIdx === -1) nameIdx = codeIdx === 0 ? 1 : 0;
                        if (codeIdx === -1) codeIdx = nameIdx === 0 ? 1 : 0;
                    }

                    const newItems = dataRows.map((row, idx) => {
                        if (!row || row.length === 0) return null;
                        const name = String(row[nameIdx] || '').trim();
                        const code = String(row[codeIdx] || '').trim();
                        if (!name && !code) return null;
                        if (currentList.some((item: any) => item && String(item.code) === code && String(item.name) === name)) return null;
                        importedCount++;
                        return {
                            id: `IMP-${importTimestamp}-${idx}`,
                            code: code || `C-${importTimestamp}-${idx}`,
                            name: name || `عنصر مستورد ${idx + 1}`,
                            phone: phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '',
                            address: addrIdx !== -1 ? String(row[addrIdx] || '').trim() : ''
                        };
                    }).filter(Boolean);

                    updateSettings({ ...settings, [selectedCategoryId]: [...currentList, ...newItems] });
                } else {
                    const newStrings = dataRows.map((row) => {
                        if (!row || !Array.isArray(row)) return null;
                        const val = String(row[0] || '').trim();
                        if (val && !currentList.includes(val)) {
                            importedCount++;
                            return val;
                        }
                        return null;
                    }).filter(Boolean);

                    updateSettings({ ...settings, [selectedCategoryId]: [...currentList, ...newStrings] });
                }
                
                addNotification(`تم استيراد ${importedCount} عنصر بنجاح لـ ${selectedCategory.label}`, 'success');
            } catch (err) { 
                console.error("Import Error:", err);
                alert('فشل استيراد الملف، تأكد من ترتيب الأعمدة (الكود ثم الاسم)'); 
            }
            if (e.target) e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const inputClasses = "w-full p-2.5 border-2 border-slate-100 rounded-xl text-sm font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-inner";

    return (
        <div className="p-4 space-y-4 font-cairo" dir="rtl">
            <ConfirmModal 
                isOpen={deleteConfirm.isOpen} 
                onClose={() => setDeleteConfirm({ isOpen: false, index: -1 })} 
                onConfirm={handleDelete} 
                title="تأكيد الحذف" 
                message="هل أنت متأكد من حذف هذا العنصر من القائمة؟" 
                confirmText="حذف" 
                cancelText="إلغاء" 
            />

            <div className="bg-white border-b-4 border-slate-800 rounded-[2rem] shadow-premium px-10 py-6 flex items-center justify-between h-28 animate-fade-in">
                <div className="w-12 h-12 bg-slate-50 text-slate-800 rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm hover:bg-slate-100 transition-all cursor-pointer group" onClick={() => navigate('/settings')}>
                    <ChevronLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
                </div>
                <div className="text-center flex-1">
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight">إدارة القوائم</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">SYSTEM LISTS & CUSTOM FIELDS</p>
                </div>
                <div className="p-3 bg-white border-2 border-slate-100 text-slate-800 rounded-2xl shadow-xl">
                    <Settings size={32}/>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)]">
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-white p-4 rounded-[1.5rem] shadow-sm flex flex-wrap items-center justify-between gap-4 no-print border border-slate-50">
                        <div className="flex items-center gap-3">
                            <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-50 text-emerald-700 px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 border border-emerald-100 shadow-sm hover:bg-emerald-100 transition-all">
                                <FileDown size={18}/> استيراد من Excel
                            </button>
                            <button onClick={handleExport} className="bg-blue-50 text-blue-700 px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 border border-blue-100 shadow-sm hover:bg-blue-100 transition-all">
                                <FileUp size={18}/> تصدير القائمة
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImport} />
                        </div>

                        <div className="flex items-center gap-4 flex-1 max-w-xl">
                            <div className="relative flex-1">
                                <input className="w-full pr-10 pl-4 py-2.5 border-2 border-slate-100 rounded-xl text-sm font-bold bg-slate-50 outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-inner" placeholder="بحث سريع..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                <Search className="absolute right-3 top-3 text-slate-300" size={18} />
                            </div>
                            <div className="flex items-center gap-2 text-blue-600 font-black">
                                <span className="text-xl">{selectedCategory.label}</span>
                                {selectedCategory.icon}
                            </div>
                        </div>
                    </div>

                    <GlassCard className="rounded-[1.5rem] border-none shadow-sm p-6 shrink-0 bg-white/80">
                        {selectedCategory.isComplex ? (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <Field label="الكود"><input className={inputClasses} value={complexInput.code || ''} onChange={e => setComplexInput({...complexInput, code: e.target.value})} style={forceEnNumsStyle}/></Field>
                                <Field label="الاسم"><input className={inputClasses} value={complexInput.name || ''} onChange={e => setComplexInput({...complexInput, name: e.target.value})}/></Field>
                                <Field label="الهاتف"><input className={inputClasses} value={complexInput.phone || ''} onChange={e => setComplexInput({...complexInput, phone: e.target.value})} style={forceEnNumsStyle}/></Field>
                                <Field label="العنوان"><input className={inputClasses} value={complexInput.address || ''} onChange={e => setComplexInput({...complexInput, address: e.target.value})}/></Field>
                                <button onClick={handleAddItem} className="md:col-span-4 bg-blue-600 text-white py-3 rounded-xl font-black shadow-lg hover:bg-blue-700 transition-all active:scale-95">إضافة</button>
                            </div>
                        ) : (
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="text-[11px] font-black text-slate-400 mb-1 block pr-1">إضافة عنصر جديد لـ {selectedCategory.label}</label>
                                    <input className={inputClasses} value={simpleInput} onChange={e => setSimpleInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddItem()} placeholder="اكتب هنا ثم اضغط Enter..."/>
                                </div>
                                <button onClick={handleAddItem} className="bg-blue-600 text-white px-10 h-10 rounded-xl font-black shadow-lg hover:bg-blue-700 transition-all active:scale-95">إضافة</button>
                            </div>
                        )}
                    </GlassCard>

                    <div className="flex-1 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-y-auto h-full">
                            <table className="w-full text-center border-collapse">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr className="h-12 border-b text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="p-2 w-16">م</th>
                                        {selectedCategory.isComplex ? (
                                            <>
                                                <th>الكود</th>
                                                <th className="text-right pr-6">الاسم</th>
                                                <th>الهاتف</th>
                                                <th>العنوان</th>
                                            </>
                                        ) : (
                                            <th className="text-right pr-10">القيمة المسجلة</th>
                                        )}
                                        <th className="w-20">حذف</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[13px] font-bold text-slate-700">
                                    {(Array.isArray(listData) ? listData : []).map((item: any, idx: number) => (
                                        <tr key={item.id || `item-${selectedCategoryId}-${idx}`} className="border-b h-14 hover:bg-slate-50 transition-colors">
                                            <td className="p-2 text-slate-300" style={forceEnNumsStyle}>{idx + 1}</td>
                                            {selectedCategory.isComplex ? (
                                                <>
                                                    <td className="font-mono text-indigo-600" style={forceEnNumsStyle}>{item.code}</td>
                                                    <td className="text-right pr-6 font-black text-slate-900">{item.name}</td>
                                                    <td style={forceEnNumsStyle}>{item.phone || '-'}</td>
                                                    <td className="text-xs text-slate-400">{item.address || '-'}</td>
                                                </>
                                            ) : (
                                                <td className="text-right pr-10 font-black text-slate-900">{item}</td>
                                            )}
                                            <td className="p-2">
                                                <button onClick={() => setDeleteConfirm({ isOpen: true, index: selectedCategory.isComplex ? item.id : idx })} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-all"><Trash2 size={18}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {listData.length === 0 && (
                                        <tr key="empty-state"><td colSpan={10} className="p-20 text-slate-300 italic font-black text-xl text-center">لا توجد بيانات مسجلة في هذه القائمة</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-72 bg-white rounded-[2rem] shadow-premium overflow-hidden border border-slate-100 flex flex-col shrink-0">
                    <div className="p-5 bg-slate-50 text-slate-800 font-black text-right text-sm border-b uppercase tracking-tighter">القوائم المتاحة</div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-slate-50/30">
                        {filteredCategories.map((cat) => (
                            <button 
                                key={cat.id} 
                                onClick={() => { setSelectedCategoryId(cat.id); setSearchTerm(''); }}
                                className={`
                                    w-full text-right p-3.5 rounded-xl font-black text-xs transition-all flex items-center justify-between group
                                    ${selectedCategoryId === cat.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-transparent text-slate-500 hover:bg-white hover:shadow-md'}
                                `}
                            >
                                <span className="font-bold">{cat.label}</span>
                                <div className={`${selectedCategoryId === cat.id ? 'text-blue-100' : 'text-slate-300 group-hover:text-blue-500'} transition-colors`}>{cat.icon}</div>
                            </button>
                        ))}
                    </div>
                    <div className="p-4 bg-slate-100/50">
                         <div className="text-[10px] text-slate-400 text-center font-bold">إجمالي العناصر: {listData.length}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Field = ({ label, children }: any) => (
    <div className="flex flex-col gap-1 w-full text-right">
        <label className="text-[10px] font-black text-slate-400 mr-1 uppercase tracking-tighter">{label}</label>
        {children}
    </div>
);
