
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard, GlassButton, InputModal } from '../../components/NeumorphicUI';
import { dbService } from '../../services/storage';
import { Purchase, PurchaseItem, Product, WarehouseType, AppSettings } from '../../types';
// Add missing Printer icon
import { 
    Plus, Trash2, Save, X, Search, Truck, 
    ShoppingCart, List, Edit2, Warehouse, ChevronLeft, UserCog, Building2, Layers, Hash, Calendar, Tag, Clock, ClipboardList, User as UserIcon, Download,
    CheckCircle2, ClipboardCheck, Scale, MapPin, Undo2, RotateCcw, PlusCircle, LayoutList, FileText, ChevronRight, Printer, ArrowRight
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getIcon } from '../../utils/icons';
import { printService } from '../../services/printing';
import { PurchaseItemsReport } from '../../components/PurchaseItemsReport';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const
};

// --- واجهة إضافة طلب شراء (تطابق الصورة الأولى) ---
const AddPurchaseView: React.FC<{ 
    filterWh?: WarehouseType, 
    editingPurchase: Purchase | null, 
    onBack: () => void,
    onSaveSuccess: () => void
}> = ({ filterWh, editingPurchase, onBack, onSaveSuccess }) => {
    const { settings, products, updateSettings, addNotification } = useApp();
    const [cart, setOrderCart] = useState<PurchaseItem[]>(editingPurchase?.items || []);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [formData, setFormData] = useState<Partial<Purchase>>(editingPurchase || {
        orderNumber: dbService.peekNextId('purchaseOrder'), 
        date: new Date().toISOString().split('T')[0],
        supplier: '', 
        warehouse: filterWh || 'parts',
        department: '',
        section: '',
        storekeeper: '',
        requestType: 'عادي',
        requester: '', 
        requestFor: '',
        jdeCode: '',
        deliveryDays: 0,
        notes: ''
    });

    const [inputModal, setInputModal] = useState<{isOpen: boolean, listKey: keyof AppSettings | null, title: string}>({
        isOpen: false, listKey: null, title: ''
    });

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const term = searchTerm.toLowerCase();
            return p.name.toLowerCase().includes(term) || p.barcode.includes(term);
        });
    }, [products, searchTerm]);

    const addToCart = (p: Product) => {
        if (cart.some(item => item.productId === p.id)) return;
        setOrderCart([...cart, { 
            productId: p.id, productName: p.name, productCode: p.barcode, 
            jdeCode: p.jdeCode || p.jdeCodePacked || p.jdeCodeBulk || '',
            quantity: 1, receivedQuantity: 0, unitCost: p.cost, totalCost: p.cost, unit: p.unit || 'عدد' 
        }]);
    };

    const updateItem = (idx: number, field: keyof PurchaseItem, value: any) => {
        const newCart = [...cart];
        const item = { ...newCart[idx], [field]: value };
        if (field === 'quantity' || field === 'unitCost') {
            item.totalCost = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
        }
        newCart[idx] = item;
        setOrderCart(newCart);
    };

    const handleSave = async () => {
        if (!formData.supplier) return alert('يرجى اختيار المورد');
        if (cart.length === 0) return alert('قائمة الأصناف فارغة');

        const realId = editingPurchase ? formData.orderNumber! : await dbService.getNextId('purchaseOrder');
        const finalPurchase: Purchase = {
            ...formData as Purchase,
            id: editingPurchase?.id || Date.now().toString(),
            orderNumber: realId,
            items: cart,
            total: cart.reduce((sum, i) => sum + i.totalCost, 0),
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        dbService.savePurchase(finalPurchase);
        addNotification(`تم حفظ طلب الشراء بنجاح: ${realId}`, 'success');
        onSaveSuccess();
    };

    const inputClasses = "w-full px-3 py-2 border-2 border-slate-100 rounded-xl text-[13px] font-bold outline-none focus:border-indigo-500 transition-all bg-white shadow-inner h-10";
    const labelClasses = "text-[11px] font-black text-indigo-900/60 flex items-center gap-1 mb-1 pr-1 font-cairo";

    return (
        <div className="flex gap-6 animate-fade-in font-cairo h-full" dir="rtl">
            <InputModal 
                isOpen={inputModal.isOpen} 
                onClose={() => setInputModal({ isOpen: false, listKey: null, title: '' })} 
                onSave={(val) => inputModal.listKey && updateSettings({...settings, [inputModal.listKey]: [...(settings[inputModal.listKey] as string[] || []), val]})}
                title={inputModal.title}
            />

            {/* Sidebar: أصناف */}
            <div className="w-80 shrink-0 flex flex-col gap-4 no-print h-full">
                <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-xl h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-4 border-b pb-3">
                        <LayoutList size={20} className="text-indigo-600"/>
                        <h3 className="font-black text-slate-800 text-sm">قائمة الأصناف المتاحة</h3>
                    </div>
                    <div className="relative mb-4">
                        <input className="w-full p-3 pr-10 rounded-2xl border-2 border-slate-50 bg-slate-50 outline-none focus:bg-white focus:border-indigo-400 transition-all text-xs font-bold shadow-inner" placeholder="ابحث عن صنف..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                        <Search className="absolute right-3 top-3 text-slate-300" size={18}/>
                    </div>
                    <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                        {filteredProducts.map(p => (
                            <div key={p.id} onClick={() => addToCart(p)} className="bg-white border-2 border-slate-50 p-4 rounded-3xl cursor-pointer hover:border-indigo-400 hover:shadow-lg transition-all group">
                                <h4 className="font-black text-slate-800 text-[13px] mb-2 group-hover:text-indigo-600 leading-snug">{p.name}</h4>
                                <div className="flex justify-between items-center text-[11px] font-bold">
                                    <span className="text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl">كود: {p.barcode}</span>
                                    <span className={`${p.stock > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-2.5 py-1 rounded-xl`}>رصيد: {p.stock}</span>
                                </div>
                                <div className="mt-2 text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                    <Tag size={10}/> {p.category}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 space-y-6 overflow-y-auto h-full px-2">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-2xl relative">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black text-indigo-900 flex items-center gap-3">
                            <ClipboardCheck size={28} className="text-indigo-600"/> البيانات الإدارية والتنظيمية لطلب الشراء
                        </h3>
                        <div className="bg-indigo-50 px-4 py-1.5 rounded-full flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-tighter">
                            <span>نظام إدارة التوريدات الذكي</span>
                            <X size={14}/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6">
                        <div className="flex flex-col">
                            <label className={labelClasses}><Hash size={13}/> رقم طلب الشراء</label>
                            <input className={`${inputClasses} bg-indigo-50/50 border-indigo-100 text-indigo-900 font-mono text-center`} value={formData.orderNumber ?? ''} readOnly />
                        </div>
                        <div className="flex flex-col">
                            <label className={labelClasses}><Calendar size={13}/> تاريخ الطلب</label>
                            <input type="date" className={inputClasses} value={formData.date ?? ''} onChange={e => setFormData({...formData, date: e.target.value})} style={forceEnNumsStyle}/>
                        </div>
                        <div className="flex flex-col">
                            <label className={labelClasses}><Building2 size={13}/> الإدارة الطالبة</label>
                            <select className={inputClasses} value={formData.department ?? ''} onChange={e => setFormData({...formData, department: e.target.value})}>
                                <option value="">-- اختر الإدارة --</option>
                                {settings.departments?.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className={labelClasses}><Layers size={13}/> القسم التابع له</label>
                            <select className={inputClasses} value={formData.section ?? ''} onChange={e => setFormData({...formData, section: e.target.value})}>
                                <option value="">الصيانة / الانتاج..</option>
                                {settings.departments?.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label className={labelClasses}><Truck size={13}/> جهة التنفيذ</label>
                            <div className="flex gap-1.5">
                                <select className={inputClasses} value={formData.supplier ?? ''} onChange={e => setFormData({...formData, supplier: e.target.value})}>
                                    <option value="">-- اختر المورد --</option>
                                    {settings.suppliers?.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button onClick={() => setInputModal({isOpen: true, listKey: 'suppliers', title: 'إضافة مورد جديد'})} className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg hover:bg-indigo-700 shrink-0 transition-all transform active:scale-90"><Plus size={20}/></button>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className={labelClasses}><Warehouse size={13}/> المخزن التابع</label>
                            <div className="flex gap-1.5">
                                <select className={inputClasses} value={formData.warehouse ?? 'parts'} onChange={e => setFormData({...formData, warehouse: e.target.value as any})}>
                                    <option value="raw">خامات</option>
                                    <option value="finished">تام</option>
                                    <option value="parts">قطع غيار</option>
                                </select>
                                <button className="bg-emerald-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg hover:bg-emerald-700 shrink-0 transition-all transform active:scale-90"><Plus size={20}/></button>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className={labelClasses}><UserCog size={13}/> أمين المخزن</label>
                            <div className="flex gap-1.5">
                                <select className={inputClasses} value={formData.storekeeper ?? ''} onChange={e => setFormData({...formData, storekeeper: e.target.value})}>
                                    <option value="">-- اختر --</option>
                                    {settings.storekeepers?.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button onClick={() => setInputModal({isOpen: true, listKey: 'storekeepers', title: 'إضافة أمين مخزن'})} className="bg-purple-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg hover:bg-purple-700 shrink-0 transition-all transform active:scale-90"><Plus size={20}/></button>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className={labelClasses}><UserIcon size={13}/> الطلب لأجل</label>
                            <input className={inputClasses} value={formData.requestFor ?? ''} onChange={e => setFormData({...formData, requestFor: e.target.value})} placeholder="الغرض من الشراء..."/>
                        </div>

                        <div className="flex flex-col">
                            <label className={labelClasses}><UserIcon size={13}/> الشخص الطالب</label>
                            <input className={inputClasses} value={formData.requester ?? ''} onChange={e => setFormData({...formData, requester: e.target.value})} placeholder="ادخل اسم الطالب..."/>
                        </div>
                        <div className="flex flex-col">
                            <label className={labelClasses}><Hash size={13}/> رقم JDE</label>
                            <input className={inputClasses} value={formData.jdeCode ?? ''} onChange={e => setFormData({...formData, jdeCode: e.target.value})} placeholder="رقم السيستم..."/>
                        </div>
                        <div className="flex flex-col">
                            <label className={labelClasses}><Clock size={13}/> مدة التوريد (يوم)</label>
                            <input type="number" className={inputClasses} value={formData.deliveryDays ?? 0} onChange={e => setFormData({...formData, deliveryDays: Number(e.target.value)})} style={forceEnNumsStyle}/>
                        </div>
                        <div className="flex flex-col">
                            <label className={labelClasses}><Tag size={13}/> نوع الطلب</label>
                            <select className={inputClasses} value={formData.requestType ?? 'عادي'} onChange={e => setFormData({...formData, requestType: e.target.value})}>
                                <option value="عادي">عادي</option>
                                <option value="عاجل">عاجل</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* الجدول */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                    <div className="bg-[#0f172a] p-5 text-white flex justify-between items-center shadow-lg">
                        <h3 className="font-black text-sm flex items-center gap-3">
                            <ShoppingCart size={22} className="text-indigo-400"/> بنود وأصناف الطلب الحالي
                        </h3>
                        <span className="bg-indigo-600 px-5 py-1.5 rounded-full text-[11px] font-black shadow-inner">{cart.length} صنف</span>
                    </div>
                    <div className="overflow-x-auto min-h-[350px]">
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-[11px] font-black h-14 uppercase border-b border-slate-100 tracking-wider">
                                    <th className="p-2 w-16">م</th>
                                    <th>كود الصنف</th>
                                    <th className="text-right pr-8">بيان الصنف</th>
                                    <th>الكمية</th>
                                    <th>الوحدة</th>
                                    <th>تكلفة الوحدة</th>
                                    <th className="bg-indigo-50/50 text-indigo-900">الإجمالي</th>
                                    <th className="w-20">حذف</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-bold text-slate-700">
                                {cart.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 h-16 hover:bg-indigo-50/30 transition-colors">
                                        <td className="p-2 text-slate-300" style={forceEnNumsStyle}>{idx + 1}</td>
                                        <td className="p-2 font-mono text-indigo-600 font-black text-xs">{item.productCode}</td>
                                        <td className="p-2 text-right pr-8 font-black text-slate-900 text-[15px]">{item.productName}</td>
                                        <td className="p-2">
                                            <input type="number" className="w-28 p-2.5 border-2 border-indigo-50 rounded-xl text-center font-black text-indigo-700 shadow-sm outline-none focus:border-indigo-500" value={item.quantity ?? ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={forceEnNumsStyle}/>
                                        </td>
                                        <td className="p-2 text-slate-400 font-black text-xs">{item.unit ?? ''}</td>
                                        <td className="p-2">
                                            <input type="number" className="w-28 p-2.5 border-2 border-slate-50 rounded-xl text-center font-black shadow-sm outline-none focus:border-indigo-400" value={item.unitCost ?? ''} onChange={e => updateItem(idx, 'unitCost', e.target.value)} style={forceEnNumsStyle}/>
                                        </td>
                                        <td className="p-2 font-black text-indigo-900 text-lg bg-indigo-50/20" style={forceEnNumsStyle}>{(item.totalCost || 0).toLocaleString()}</td>
                                        <td className="p-2">
                                            <button onClick={() => setOrderCart(cart.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-600 p-3 rounded-full hover:bg-rose-50 transition-all transform active:scale-90"><Trash2 size={22}/></button>
                                        </td>
                                    </tr>
                                ))}
                                {cart.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-32 text-slate-200 font-black italic text-2xl flex flex-col items-center gap-4 justify-center w-full">
                                            لا توجد أصناف مضافة. اختر من القائمة الجانبية...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-6 items-center pt-4">
                    <button onClick={onBack} className="bg-white text-slate-400 px-12 py-5 rounded-[2rem] font-black text-xl border-2 border-slate-100 hover:bg-slate-50 transition-all shadow-lg active:scale-95">إلغاء</button>
                    <button onClick={handleSave} className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-5 rounded-[2rem] font-black text-2xl shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] border-b-[10px] border-indigo-900">
                        <Save size={36}/> حفظ وترحيل طلب الشراء
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- واجهة سجل المشتريات ---
const PurchaseListView: React.FC<{ filterWh?: WarehouseType, onEdit: (p: Purchase) => void, onBack: () => void }> = ({ filterWh, onEdit, onBack }) => {
    const { settings } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const purchases = dbService.getPurchases().filter(p => !filterWh || p.warehouse === filterWh).reverse();
    const filtered = purchases.filter(p => p.orderNumber.includes(searchTerm) || p.supplier.includes(searchTerm));

    return (
        <div className="space-y-6 animate-fade-in font-cairo">
            <div className="flex justify-between items-center bg-white p-5 rounded-[2rem] border border-slate-100 shadow-xl no-print">
                <div className="relative w-96">
                    <input className="w-full pr-12 pl-4 py-3 rounded-2xl border-2 border-slate-50 bg-slate-50 outline-none focus:border-indigo-400 transition-all text-sm font-bold shadow-inner" placeholder="بحث برقم الطلب أو المورد..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute right-4 top-3.5 text-slate-300" size={20}/>
                </div>
                <div className="flex items-center gap-3 text-slate-400 font-black text-xs uppercase tracking-[0.2em]">
                    <List size={22} className="text-indigo-600"/> سجل كافة أوامر الشراء الموثقة
                </div>
            </div>
            
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                <table className="w-full text-center border-collapse">
                    <thead className="bg-[#0f172a] text-yellow-400 h-16 shadow-lg">
                        <tr className="text-[12px] font-black uppercase tracking-wider">
                            <th className="p-4 border-l border-slate-800">التاريخ</th>
                            <th className="p-4 border-l border-slate-800">رقم الطلب</th>
                            <th className="p-4 border-l border-slate-800 text-right pr-10">جهة التنفيذ</th>
                            <th className="p-4 border-l border-slate-800">المخزن</th>
                            <th className="p-4 border-l border-slate-800">الحالة</th>
                            <th className="p-4 border-l border-slate-800">القيمة</th>
                            <th className="p-4">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-bold text-slate-700">
                        {filtered.map((p, idx) => (
                            <tr key={p.id} className={`border-b h-16 hover:bg-indigo-50/50 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/30' : 'bg-white'}`}>
                                <td className="p-4 border-l" style={forceEnNumsStyle}>{new Date(p.date).toLocaleDateString('en-GB')}</td>
                                <td className="p-4 border-l font-mono text-indigo-700 font-black text-lg">{p.orderNumber}</td>
                                <td className="p-4 border-l text-right pr-10 font-black text-slate-900">{p.supplier}</td>
                                <td className="p-4 border-l">
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase">{p.warehouse}</span>
                                </td>
                                <td className="p-4 border-l">
                                    <span className={`px-4 py-1 rounded-full text-[10px] font-black text-white ${p.status === 'received' ? 'bg-emerald-500' : 'bg-blue-500'}`}>{p.status === 'received' ? 'مستلم' : 'معلق'}</span>
                                </td>
                                <td className="p-4 border-l font-black text-indigo-900 text-lg" style={forceEnNumsStyle}>{p.total.toLocaleString()}</td>
                                <td className="p-4 flex justify-center gap-3">
                                    <button onClick={() => onEdit(p)} className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-2xl transition-all shadow-sm border border-blue-50"><Edit2 size={18}/></button>
                                    <button onClick={() => printService.printWindow(printService.generatePurchaseOrderHtml(p, settings))} className="p-2.5 text-slate-400 hover:bg-slate-50 rounded-2xl transition-all shadow-sm border border-slate-50"><Printer size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- واجهة استلام/مرتجع (تطابق الصورتين 2 و 4) ---
const SearchActionView: React.FC<{ 
    mode: 'receive' | 'return', 
    title: string, 
    onBack: () => void 
}> = ({ mode, title, onBack }) => {
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    const handleSearch = () => {
        alert('جاري البحث عن رقم المستند للبدء في الإجراء...');
    };

    return (
        <div className="flex flex-col items-center justify-center py-32 animate-fade-in font-cairo">
            <div className={`p-8 rounded-full mb-8 shadow-inner ${mode === 'receive' ? 'bg-blue-50 text-blue-500' : 'bg-rose-50 text-rose-500'}`}>
                {mode === 'receive' ? <Search size={64}/> : <RotateCcw size={64}/>}
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-10">{title}</h2>
            
            <div className="bg-white p-3 rounded-[2rem] shadow-2xl border border-slate-100 flex items-center gap-3 w-full max-w-2xl transform hover:scale-[1.02] transition-all">
                <input 
                    className="flex-1 p-5 text-xl font-bold text-center outline-none bg-transparent placeholder-slate-300 font-mono" 
                    placeholder="PO-000001" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    style={forceEnNumsStyle}
                    autoFocus
                />
                <button 
                    onClick={handleSearch}
                    className={`px-12 py-4 rounded-2xl font-black text-xl text-white shadow-xl transition-all active:scale-95 ${mode === 'receive' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                >
                    بحث
                </button>
            </div>
        </div>
    );
};

// --- الصفحة الرئيسية للمشتريات ---
export const Purchases: React.FC = () => {
    const { settings, t, uiConfig, user, selectWarehouse } = useApp();
    const [viewMode, setViewMode] = useState<'menu' | 'add' | 'list' | 'receive' | 'reports' | 'return'>('menu');
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [searchParams] = useSearchParams();
    const filterWh = searchParams.get('wh') as WarehouseType | undefined;
    const navigate = useNavigate();
    const isMinia = user?.selectedWarehouse === 'minia';

    const allowedButtons = useMemo(() => {
        return uiConfig.purchases.buttons.filter(btn => {
            if (!btn.isVisible) return false;
            if (user?.role === 'admin') return true;
            const level = user?.permissions?.features?.[btn.id];
            return level === 'available' || level === 'edit';
        });
    }, [uiConfig.purchases.buttons, user]);

    const handleAction = (action: string) => {
        if (action.startsWith('view:')) setViewMode(action.split(':')[1] as any);
        else if (action.startsWith('navigate:')) navigate(action.split(':')[1]);
    };

    const handleBack = () => {
        if (viewMode !== 'menu') {
            if (viewMode === 'add' && editingPurchase) setViewMode('list');
            else setViewMode('menu');
            setEditingPurchase(null);
        } else {
            navigate('/');
        }
    };

    const currentButton = uiConfig.purchases.buttons.find(b => b.action === `view:${viewMode}`);
    const viewTitle = viewMode === 'menu' ? (settings.language === 'ar' ? (uiConfig.purchases.titleAr || uiConfig.purchases.name || t('purchases')) : (uiConfig.purchases.titleEn || t('purchases'))) : (settings.language === 'ar' ? (currentButton?.labelAr || t(currentButton?.labelKey || '')) : (currentButton?.labelEn || t(currentButton?.labelKey || '')));

    return (
        <div className="p-6 space-y-6 h-screen flex flex-col" dir="rtl">
            <div className={`bg-white rounded-[2.5rem] shadow-premium px-12 py-5 flex items-center justify-between shrink-0 border-b-4 ${isMinia ? 'border-emerald-600' : 'border-blue-600'} animate-fade-in`}>
                <div className="flex items-center gap-3 relative z-10 font-cairo">
                    <button onClick={handleBack} className="flex items-center gap-2 bg-[#1e293b] hover:bg-black text-white px-6 py-2.5 rounded-xl font-black shadow-xl transition-all active:scale-95 group border border-slate-700/50 text-sm">
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> 
                        <span>{viewMode === 'menu' ? 'رجوع للرئيسية' : 'رجوع'}</span>
                    </button>
                </div>
                 <div className="flex-1 flex flex-col items-center justify-center">
                    <h1 className="text-5xl font-black text-blue-900 font-cairo leading-tight drop-shadow-sm tracking-tight">{viewTitle}</h1>
                 </div>
                 <div className="p-4 bg-white border border-blue-100 text-blue-600 rounded-2xl shadow-xl shrink-0 group hover:rotate-6 transition-transform">
                    <ShoppingCart size={38} strokeWidth={2.5}/>
                 </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {viewMode === 'menu' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 px-6 pt-4 animate-fade-in">
                        {allowedButtons.map(btn => {
                            const Icon = getIcon(btn.icon);
                            return (
                                <button key={btn.id} onClick={() => handleAction(btn.action)} className={`${btn.color} text-white p-5 rounded-xl shadow-lg flex flex-row items-center justify-start gap-4 min-h-[90px] group hover:scale-105 transition-all border border-white/20 relative active:scale-95 overflow-hidden`}>
                                    <div className="absolute top-0 right-0 w-full h-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rotate-12 translate-x-1/2"></div>
                                    <div className="bg-white/20 p-3 rounded-lg group-hover:scale-110 shadow-inner border border-white/10 transition-transform shrink-0"><Icon size={26}/></div>
                                    <span className="font-black text-lg leading-tight text-right w-full">{settings.language === 'ar' ? (btn.labelAr || t(btn.labelKey)) : (btn.labelEn || t(btn.labelKey))}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {viewMode !== 'menu' && (
                    <div className="h-full animate-fade-in">
                        {viewMode === 'add' && <AddPurchaseView filterWh={filterWh} editingPurchase={editingPurchase} onBack={handleBack} onSaveSuccess={() => { setViewMode('list'); setEditingPurchase(null); }} />}
                        
                        {['list', 'reports'].includes(viewMode) && (
                            <GlassCard className="h-full p-8 shadow-premium rounded-[3rem] border-white/40 bg-white overflow-hidden flex flex-col">
                                {viewMode === 'list' && <PurchaseListView filterWh={filterWh} onEdit={(p) => { setEditingPurchase(p); setViewMode('add'); }} onBack={handleBack} />}
                                {viewMode === 'reports' && <PurchaseItemsReport />}
                            </GlassCard>
                        )}

                        {viewMode === 'receive' && <SearchActionView mode="receive" title="بدء استلام مشتريات" onBack={handleBack}/>}
                        {viewMode === 'return' && <SearchActionView mode="return" title="مرتجع مشتريات لمورد" onBack={handleBack}/>}
                    </div>
                )}
            </div>
        </div>
    );
};
