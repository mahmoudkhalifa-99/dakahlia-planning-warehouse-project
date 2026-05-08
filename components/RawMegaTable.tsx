
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Product, StockMovement, AppSettings, CustomFieldTarget } from '../types';
import { 
    Search, Plus, Save, X, Trash2, Calendar, Hash, Truck, 
    Settings, Printer, FileDown, FileUp, Clock, User, 
    Scale, Timer, FileText, ChevronLeft, 
    PlusCircle, ClipboardList, UserCheck, UserCog, 
    ArrowDownLeft, ArrowUpRight, EyeOff, Eye, Building2, MapPin,
    ArrowRightLeft, PlusSquare, MinusSquare, Warehouse, RefreshCw, 
    Database, AlertTriangle, ShieldAlert, FileWarning, LogOut, Gauge, 
    Undo2, RotateCcw, ClipboardPaste, Send, Edit2, Check, History, 
    Package, ShieldCheck, Activity, ShoppingCart, Download, FileSpreadsheet,
    XCircle, HardHat, ClipboardSignature, UserPlus, Phone, Share2
} from 'lucide-react';
import { printService } from '../services/printing';
import { InputModal, GlassCard } from './NeumorphicUI';
import { RawBalancesTable } from './RawBalancesTable';
import * as XLSX from 'xlsx';

export interface Props {
    view: 'raw_in' | 'control_out' | 'wh_out' | 'wh_transfer' | 'raw_sale' | 'silo_trans' | 'wh_adj' | 'silo_adj' | 'shortage' | 'raw_return' | 'raw_ledger' | 'balances' | 'raw_in_daily';
    onSuccess: () => void;
    title: string;
}

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontWeight: '700'
};

const inputClasses = "w-full p-2 border border-slate-200 rounded-xl text-[12px] font-bold outline-none focus:border-blue-500 bg-white transition-all shadow-sm h-9";
const labelClasses = "text-[10px] font-black text-slate-500 flex items-center gap-1 mb-0.5 whitespace-nowrap pr-1 uppercase tracking-tighter";

const RawLedgerView = () => <RawBalancesTable />;

const RawDailyDetailView = () => {
    const { settings } = useApp();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');

    const movements = dbService.getMovements().filter(m => 
        m.warehouse === 'raw' && 
        m.customFields?.viewContext === 'raw_in' &&
        m.date && m.date.startsWith(selectedDate)
    );

    const tableData: any[] = movements.flatMap((m, idx) => m.items.map((it, iIdx) => ({
        ...m,
        ...it,
        ...m.customFields,
        moveId: m.id,
        itemIdx: iIdx,
        displayDate: new Date(m.date).toLocaleDateString('en-GB')
    }))).filter(r => (r.productName || '').includes(searchTerm) || (r.refNumber || '').includes(searchTerm));

    return (
        <div className="space-y-4 animate-fade-in font-cairo" dir="rtl">
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-xl border no-print shadow-sm">
                <div className="flex items-center gap-2">
                    <Calendar size={20} className="text-blue-600" />
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)} 
                        className="p-2 border rounded-lg font-bold outline-none focus:ring-2 focus:ring-blue-100" 
                        style={forceEnNumsStyle}
                    />
                </div>
                <div className="relative flex-1">
                    <input 
                        className="w-full pr-10 pl-4 py-2 border rounded-xl outline-none focus:border-blue-500 font-bold" 
                        placeholder="بحث في وارد اليوم..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={18}/>
                </div>
            </div>
            
            <div className="bg-white rounded-xl border overflow-hidden shadow-premium overflow-x-auto">
                <table className="w-full text-center border-collapse min-w-[1800px]">
                    <thead className="bg-[#0f172a] text-yellow-400 h-14">
                        <tr className="text-[11px] uppercase font-black">
                            <th className="p-2 border border-slate-700 w-12">م</th>
                            <th className="p-2 border border-slate-700">رقم الإذن</th>
                            <th className="p-2 border border-slate-700 text-right pr-6">المورد</th>
                            <th className="p-2 border border-slate-700 text-right pr-6 min-w-[300px]">اسم الصنف</th>
                            <th className="p-2 border border-slate-700 bg-blue-900/30 font-black">وزن الميزان</th>
                            <th className="p-2 border border-slate-700">وزن البوليصة</th>
                            <th className="p-2 border border-slate-700">الفرق</th>
                            <th className="p-2 border border-slate-700">السيارة</th>
                            <th className="p-2 border border-slate-700">السائق</th>
                            <th className="p-2 border border-slate-700">الوردية</th>
                            <th className="p-2 border border-slate-700">أمين المخزن</th>
                        </tr>
                    </thead>
                    <tbody className="font-bold text-slate-700 text-sm">
                        {tableData.map((row, idx) => (
                            <tr key={`${row.moveId}-${row.itemIdx}`} className="border-b h-12 hover:bg-slate-50 transition-colors">
                                <td className="p-2 border" style={forceEnNumsStyle}>{idx + 1}</td>
                                <td className="p-2 border font-mono text-indigo-700">{row.refNumber}</td>
                                <td className="p-2 border text-right pr-4">{row.supplier || row.reason}</td>
                                <td className="p-2 border text-right pr-4 font-black text-slate-900">{row.productName}</td>
                                <td className="p-2 border bg-blue-50 text-blue-800 text-lg font-black" style={forceEnNumsStyle}>{row.quantity.toFixed(3)}</td>
                                <td className="p-2 border" style={forceEnNumsStyle}>{(parseFloat(row.policyWeight) || 0).toFixed(3)}</td>
                                <td className="p-2 border font-black text-rose-600" style={forceEnNumsStyle}>{(row.quantity - (parseFloat(row.policyWeight) || 0)).toFixed(3)}</td>
                                <td className="p-2 border font-mono">{row.carNumber}</td>
                                <td className="p-2 border">{row.driverName}</td>
                                <td className="p-2 border">{row.shift}</td>
                                <td className="p-2 border text-slate-400">{row.storekeeper}</td>
                            </tr>
                        ))}
                        {tableData.length === 0 && <tr><td colSpan={11} className="p-24 text-slate-300 font-black text-xl italic">لا توجد سجلات وارد في هذا التاريخ</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const Field: React.FC<{ label: string, icon?: React.ReactNode, children: React.ReactNode }> = ({ label, icon, children }) => (
    <div className="flex flex-col gap-1 w-full">
        <label className={labelClasses}>{icon} {label}</label>
        {children}
    </div>
);

const DynamicCustomFieldsRenderer: React.FC<{ 
    target: CustomFieldTarget, 
    formData: any, 
    setFormData: (data: any) => void 
}> = ({ target, formData, setFormData }) => {
    const { settings } = useApp();
    const relevantFields = (settings.customFields || []).filter(f => f.targets.includes(target));
    if (relevantFields.length === 0) return null;
    return (
        <>
            {relevantFields.map(field => (
                <Field key={field.id} label={field.label} icon={<Share2 size={13}/>}>
                    <select 
                        className={inputClasses} 
                        value={formData.customFields?.[field.id] || ''} 
                        onChange={e => {
                            const newCustom = { ...(formData.customFields || {}), [field.id]: e.target.value };
                            setFormData({ ...formData, customFields: newCustom });
                        }}
                    >
                        <option value="">-- اختر --</option>
                        {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </Field>
            ))}
        </>
    );
};

function smartNormalize(text: any) {
    if (!text) return '';
    return text.toString().trim().toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u0652]/g, '')
        .replace(/\s+/g, ''); 
}

const formatVal = (n: any) => {
    const num = parseFloat(n);
    if (isNaN(num) || num === 0) return '-';
    return num.toLocaleString('en-US', { 
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    });
};

/**
 * 1. وارد خامات (مشتريات)
 */
const RawInView: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
    const { settings, products, user, refreshProducts, addNotification } = useApp();
    const [isFormOpen, setIsFormOpen] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [itemSearch, setItemSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [draftItems, setDraftItems] = useState<any[]>([]);
    const [updateTrigger, setUpdateTrigger] = useState(0);
    
    const INITIAL_FORM = {
        date: new Date().toISOString().split('T')[0],
        supplyOrderNo: '', policyNo: '', carType: 'دبابة', 
        storekeeper: user?.name || 'System Admin',
        supplier: '', supplierCode: 'آلي..', transportCompany: '', carNumber: '',
        driverName: '', driverPhone: '', arrivalTime: '', entryTime: '', exitTime: '',
        shift: 'الأولى', inspector: '', weighmasterName: '', inspectionReportNo: '',
        procedure: '', policyWeight: '', scaleWeight: '', cardId: '', 
        itemStatus: 'تحت الفحص', refNumber: '', customFields: {}
    };

    const [formHeader, setFormHeader] = useState<any>(INITIAL_FORM);

    const [inputModal, setInputModal] = useState<{isOpen: boolean, listKey: keyof AppSettings | null, title: string}>({
        isOpen: false, listKey: null, title: ''
    });

    const calculatedDuration = useMemo(() => {
        if (!formHeader.entryTime || !formHeader.exitTime) return '--:--';
        const [h1, m1] = formHeader.entryTime.split(':').map(Number);
        const [h2, m2] = formHeader.exitTime.split(':').map(Number);
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60;
        return `${Math.floor(diff / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`;
    }, [formHeader.entryTime, formHeader.exitTime]);

    const handleAddToDraft = () => {
        if (!selectedProduct) return alert('يرجى اختيار صنف أولاً');
        const sw = parseFloat(formHeader.scaleWeight) || 0;
        if (sw <= 0) return alert('يرجى إدخال وزن الميزان');
        const pw = parseFloat(formHeader.policyWeight) || 0;
        
        setDraftItems([...draftItems, {
            productId: selectedProduct.id, productName: selectedProduct.name,
            productCode: selectedProduct.barcode, quantity: sw, policyWeight: pw,
            diffWeight: sw - pw, 
            additionQty: Math.min(sw, pw), // حساب الإضافة (القيمة الأقل)
            cardId: formHeader.cardId, itemStatus: formHeader.itemStatus,
            unit: selectedProduct.unit || 'طن', jdeCode: selectedProduct.jdeCode || '-'
        }]);
        setSelectedProduct(null); setItemSearch('');
    };

    const handleSave = () => {
        if (draftItems.length === 0) return alert('قائمة الأصناف فارغة');
        const realRef = formHeader.refNumber || dbService.getNextId('receiveVoucher');
        const move: StockMovement = {
            id: Date.now().toString(), 
            date: new Date(formHeader.date).toISOString(),
            type: 'in', warehouse: 'raw', refNumber: realRef,
            user: user?.name || 'Admin', items: draftItems, 
            reason: formHeader.supplier || 'وارد خامات',
            customFields: { ...formHeader, ...formHeader.customFields, viewContext: 'raw_in', duration: calculatedDuration, refNumber: realRef }
        };
        dbService.saveMovement(move); 
        refreshProducts(); 
        setDraftItems([]); 
        setFormHeader({...INITIAL_FORM, refNumber: dbService.peekNextId('receiveVoucher')});
        setUpdateTrigger(p => p + 1);
        addNotification('تم ترحيل الوارد بنجاح وتصفير الحقول', 'success');
    };

    const tableData: any[] = useMemo(() => {
        return dbService.getMovements()
            .filter(m => m.customFields?.viewContext === 'raw_in')
            .flatMap(m => m.items.map(it => ({ 
                ...m, 
                ...it, 
                ...m.customFields, 
                moveId: m.id,
                displayDate: new Date(m.date).toLocaleDateString('en-GB')
            })))
            .filter(r => smartNormalize(r.productName).includes(smartNormalize(searchTerm)) || smartNormalize(r.refNumber).includes(smartNormalize(searchTerm)))
            .reverse();
    }, [searchTerm, updateTrigger]);

    const handleExport = () => {
        const headers = [
            "م", "التاريخ", "رقم الإذن", "أمر التوريد", "رقم البوليصة", "المورد", "الصنف", 
            "وزن البوليصة", "وزن الميزان", "الاضافة (الأقل)", "الفرق", "الحالة", 
            "شركة النقل", "رقم السيارة", "السائق", "دخول", "خروج", "المدة", "الوردية", 
            "الفحص", "الوزان", "أمين المخزن"
        ];
        const data = tableData.map((r, i) => [
            i + 1, r.displayDate, r.refNumber, r.supplyOrderNo, r.policyNo, r.supplier, r.productName,
            r.policyWeight, r.quantity, r.additionQty || Math.min(r.quantity, parseFloat(r.policyWeight) || 0),
            r.diffWeight, r.itemStatus, r.transportCompany, r.carNumber, r.driverName, 
            r.entryTime, r.exitTime, r.duration, r.shift, r.inspectingOfficer, r.weighmasterName, r.storekeeper
        ]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, "RawInboundDetailed");
        XLSX.writeFile(wb, `Raw_Inbound_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const tableRef = useRef<HTMLTableElement>(null);

    const DropdownWithAdd = ({ label, field, listKey, icon }: any) => (
        <Field label={label} icon={icon}>
            <div className="flex gap-1">
                <button 
                  onClick={() => setInputModal({ isOpen: true, listKey, title: `إضافة ${label}` })}
                  className="bg-blue-600 text-white w-8 h-9 rounded-lg flex items-center justify-center shadow-sm hover:bg-blue-700 transition-colors"
                >
                  <Plus size={14}/>
                </button>
                <select 
                  className={`${inputClasses} flex-1`} 
                  value={(formHeader as any)[field]} 
                  onChange={e => setFormHeader({...formHeader, [field]: e.target.value})}
                >
                    <option value="">-- اختر --</option>
                    {(settings[listKey] as string[] || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
        </Field>
    );

    return (
        <div className="space-y-6 animate-fade-in font-cairo" dir="rtl">
            <InputModal 
                isOpen={inputModal.isOpen} 
                onClose={() => setInputModal({ isOpen: false, listKey: null, title: '' })} 
                onSave={(val) => inputModal.listKey && dbService.saveSettings({ ...settings, [inputModal.listKey]: [...(settings[inputModal.listKey] as string[] || []), val] })}
                title={inputModal.title}
            />

            {isFormOpen && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-premium overflow-hidden no-print">
                    <div className="bg-[#059669] px-6 py-2.5 text-white flex justify-between items-center shadow-md">
                        <h3 className="text-[14px] font-black flex items-center gap-2">إدخال وارد خامات (مشتريات)</h3>
                        <button onClick={() => setIsFormOpen(false)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-1 rounded-lg font-black text-[12px] flex items-center gap-2 border border-white/30 transition-all active:scale-95">
                            <X size={16}/> إغلاق
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <Field label="التاريخ" icon={<Calendar size={13}/>}><input type="date" value={formHeader.date} onChange={e => setFormHeader({...formHeader, date: e.target.value})} className={inputClasses} style={forceEnNumsStyle}/></Field>
                            <Field label="رقم أمر التوريد" icon={<Hash size={13}/>}><input className={inputClasses} value={formHeader.supplyOrderNo} onChange={e => setFormHeader({...formHeader, supplyOrderNo: e.target.value})}/></Field>
                            <Field label="رقم البوليصة" icon={<FileText size={13}/>}><input className={inputClasses} value={formHeader.policyNo} onChange={e => setFormHeader({...formHeader, policyNo: e.target.value})}/></Field>
                            <DropdownWithAdd label="نوع السيارة" field="carType" listKey="carTypes" icon={<Truck size={13}/>}/>
                            <DropdownWithAdd label="أمين مخزن الخامات" field="storekeeper" listKey="storekeepersRaw" icon={<UserCog size={13}/>}/>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <DropdownWithAdd label="المورد" field="supplier" listKey="suppliers" icon={<Building2 size={13}/>}/>
                            <Field label="كود المورد" icon={<Hash size={13}/>}><input className={`${inputClasses} bg-slate-50`} value={formHeader.supplierCode} readOnly /></Field>
                            <DropdownWithAdd label="شركة النقل" field="transportCompany" listKey="rawTransportCompanies" icon={<Truck size={13}/>}/>
                            <Field label="رقم السيارة" icon={<Hash size={13}/>}><input className={inputClasses} value={formHeader.carNumber} onChange={e => setFormHeader({...formHeader, carNumber: e.target.value})} style={forceEnNumsStyle}/></Field>
                            <Field label="اسم السائق" icon={<User size={13}/>}><input className={inputClasses} value={formHeader.driverName} onChange={e => setFormHeader({...formHeader, driverName: e.target.value})}/></Field>
                            <Field label="تليفون السائق" icon={<Phone size={13}/>}><input className={inputClasses} value={formHeader.driverPhone} onChange={e => setFormHeader({...formHeader, driverPhone: e.target.value})} style={forceEnNumsStyle}/></Field>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-9 gap-3">
                            <Field label="وصول المصنع" icon={<Clock size={13}/>}><input type="time" className={inputClasses} value={formHeader.arrivalTime} onChange={e => setFormHeader({...formHeader, arrivalTime: e.target.value})} style={forceEnNumsStyle}/></Field>
                            <Field label="ساعة الدخول" icon={<ArrowDownLeft size={13}/>}><input type="time" className={inputClasses} value={formHeader.entryTime} onChange={e => setFormHeader({...formHeader, entryTime: e.target.value})} style={forceEnNumsStyle}/></Field>
                            <Field label="ساعة الخروج" icon={<ArrowUpRight size={13}/>}><input type="time" className={inputClasses} value={formHeader.exitTime} onChange={e => setFormHeader({...formHeader, exitTime: e.target.value})} style={forceEnNumsStyle}/></Field>
                            <Field label="المدة" icon={<Timer size={13}/>}><input className={`${inputClasses} bg-blue-50 text-blue-700 text-center font-black border-blue-200`} value={calculatedDuration} readOnly style={forceEnNumsStyle}/></Field>
                            <Field label="الوردية" icon={<History size={13}/>}><select className={inputClasses} value={formHeader.shift} onChange={e => setFormHeader({...formHeader, shift: e.target.value})}>{settings.shifts?.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
                            <DropdownWithAdd label="القائم بالفحص" field="inspector" listKey="inspectors" icon={<UserCheck size={13}/>}/>
                            <DropdownWithAdd label="الوزان" field="weighmasterName" listKey="weighmasters" icon={<Scale size={13}/>}/>
                            <Field label="رقم الفحص" icon={<ClipboardSignature size={13}/>}><input className={inputClasses} value={formHeader.inspectionReportNo} onChange={e => setFormHeader({...formHeader, inspectionReportNo: e.target.value})}/></Field>
                            <Field label="إجرائية" icon={<Settings size={13}/>}><input className={inputClasses} value={formHeader.procedure} onChange={e => setFormHeader({...formHeader, procedure: e.target.value})}/></Field>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t pt-4">
                            <DynamicCustomFieldsRenderer target="raw_receive" formData={formHeader} setFormData={setFormHeader} />
                        </div>
                        
                        <div className="bg-[#002060] p-4 rounded-xl flex flex-col md:flex-row items-center gap-4 shadow-xl border-b-8 border-[#001a4d] relative z-20 mt-4">
                            <div className="flex-1 relative w-full">
                                <label className="text-[10px] font-black text-blue-200 mb-1 block mr-4 uppercase">ابحث عن صنف</label>
                                <div className="relative">
                                    <input className="w-full p-2.5 pr-10 rounded-lg border-none outline-none font-bold text-sm shadow-inner" placeholder="اسم الصنف، كود دريف أو JDE..." value={itemSearch} onChange={e => { setItemSearch(e.target.value); if(selectedProduct) setSelectedProduct(null); }} />
                                    <Search className="absolute right-4 top-2.5 text-slate-300" size={18}/>
                                    {itemSearch && !selectedProduct && (
                                        <div className="absolute top-full left-0 right-0 z-[1000] bg-white border border-blue-400 rounded-xl shadow-2xl mt-2 max-h-60 overflow-y-auto p-2">
                                            {products.filter(p => p.warehouse === 'raw').filter(p => smartNormalize(p.name).includes(smartNormalize(itemSearch)) || smartNormalize(p.barcode).includes(smartNormalize(itemSearch))).map(p => (
                                                <div key={p.id} onClick={() => {setSelectedProduct(p); setItemSearch(p.name);}} className="p-3 hover:bg-blue-50 cursor-pointer border-b rounded-lg flex justify-between items-center transition-all group">
                                                    <div className="flex flex-col"><span className="font-black text-slate-800 text-xs group-hover:text-blue-600 transition-colors">{p.name}</span><span className="text-[10px] text-slate-400">كود: {p.barcode}</span></div>
                                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black">رصيد: {p.stock}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="w-full md:w-32"><label className="text-[10px] font-black text-blue-200 mb-1 block text-center uppercase">وزن البوليصة</label><input type="number" className="w-full p-2.5 rounded-lg bg-blue-100/20 text-white font-black text-center outline-none border border-blue-400/50 shadow-inner" value={formHeader.policyWeight} onChange={e => setFormHeader({...formHeader, policyWeight: e.target.value})} style={forceEnNumsStyle}/></div>
                            <div className="w-full md:w-32"><label className="text-[10px] font-black text-blue-200 mb-1 block text-center uppercase">وزن الميزان</label><input type="number" className="w-full p-2.5 rounded-lg bg-emerald-100/20 text-white font-black text-center outline-none border border-emerald-400/50 shadow-inner" value={formHeader.scaleWeight} onChange={e => setFormHeader({...formHeader, scaleWeight: e.target.value})} style={forceEnNumsStyle}/></div>
                            <div className="w-full md:w-32"><label className="text-[10px] font-black text-blue-200 mb-1 block text-center uppercase">رقم الكارت</label><input className="w-full p-2.5 rounded-lg bg-white text-[#002060] font-black text-center outline-none border-none shadow-inner" value={formHeader.cardId} onChange={e => setFormHeader({...formHeader, cardId: e.target.value})}/></div>
                            <div className="w-full md:w-40">
                                <label className="text-[10px] font-black text-blue-200 mb-1 block text-center uppercase">حالة الصنف</label>
                                <select className="w-full p-2.5 rounded-lg bg-[#f59e0b] text-white font-black text-center outline-none border-none cursor-pointer" value={formHeader.itemStatus} onChange={e => setFormHeader({...formHeader, itemStatus: e.target.value})}>
                                    <option value="تحت الفحص">تحت الفحص</option>
                                    <option value="مقبول">مقبول</option>
                                    <option value="مرفوض">مرفوض</option>
                                </select>
                            </div>
                            <button onClick={handleAddToDraft} className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all mt-5 md:mt-4">
                                <Plus size={36} strokeWidth={4}/>
                            </button>
                        </div>

                        {draftItems.length > 0 && (
                            <div className="space-y-4 pt-4 animate-fade-in">
                                <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                                    <table className="w-full text-center text-[13px] border-collapse">
                                        <thead className="bg-[#111827] text-slate-400 h-10 font-black uppercase">
                                            <tr><th className="p-3 border-l border-slate-700 text-right pr-8 text-white">الصنف</th><th className="p-3 border-l border-slate-700">وزن البوليسة</th><th className="p-3 border-l border-slate-700">وزن الميزان</th><th className="p-3 border-l border-slate-700">الاضافة</th><th className="p-3 border-l border-slate-700">الفرق</th><th className="p-3">حذف</th></tr>
                                        </thead>
                                        <tbody className="font-bold bg-white text-slate-800 text-[12px]">
                                            {draftItems.map((item, idx) => (
                                                <tr key={idx} className="border-b h-12 hover:bg-slate-50 transition-colors">
                                                    <td className="p-3 border-l text-right pr-8 font-black text-slate-900">{item.productName}</td>
                                                    <td className="p-3 border-l" style={forceEnNumsStyle}>{item.policyWeight}</td>
                                                    <td className="p-3 border-l text-blue-700 font-black text-lg" style={forceEnNumsStyle}>{item.quantity}</td>
                                                    <td className="p-3 border-l text-emerald-800 font-black text-lg bg-emerald-50/30" style={forceEnNumsStyle}>{item.additionQty.toFixed(3)}</td>
                                                    <td className={`p-3 border-l font-black ${item.diffWeight < 0 ? 'text-red-600' : 'text-emerald-600'}`} style={forceEnNumsStyle}>{item.diffWeight.toFixed(3)}</td>
                                                    <td className="p-3"><button onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"><Trash2 size={18}/></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button onClick={handleSave} className="w-full py-5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl font-black text-2xl shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] border-b-8 border-[#064e3b]"><Save size={32}/> ترحيل الوارد نهائياً</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="bg-white rounded-xl border border-slate-100 shadow-premium overflow-hidden mt-6">
                <div className="bg-[#1e293b] p-6 flex flex-col md:flex-row justify-between items-center gap-4 text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/10 rounded-2xl shadow-inner text-yellow-400"><History size={24}/></div>
                        <div><h2 className="text-xl font-black">سجل وارد خامات (مشتريات)</h2></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-64"><input className="w-full pr-10 pl-4 py-2.5 rounded-xl text-slate-800 text-sm font-bold shadow-inner border-none bg-slate-50" placeholder="بحث سريع..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /><Search className="absolute right-3 top-3 text-slate-300" size={18}/></div>
                        <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 border-b-4 border-emerald-800 transition-all"><FileUp size={18}/> تصدير Excel</button>
                        {!isFormOpen && <button onClick={() => setIsFormOpen(true)} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-[12px] flex items-center gap-2 shadow-lg active:scale-95 border-b-4 border-blue-800 transition-all"><Plus size={18}/> إظهار الإدخال</button>}
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[60vh] relative z-10">
                    <table className="w-full border-collapse min-w-[3200px]" ref={tableRef}>
                        <thead className="sticky top-0 z-20 bg-[#002060] text-yellow-300 font-black text-[10px] uppercase h-14 shadow-lg border-b border-slate-700">
                            <tr>
                                <th className="p-3 border-l border-slate-700 w-12">م</th>
                                <th className="p-3 border-l border-slate-700">التاريخ</th>
                                <th className="p-3 border-l border-slate-700">رقم الإذن</th>
                                <th className="p-3 border-l border-slate-700">أمر التوريد</th>
                                <th className="p-3 border-l border-slate-700">رقم البوليصة</th>
                                <th className="p-3 border-l border-slate-700 text-right pr-4">المورد</th>
                                <th className="p-3 border-l border-slate-700 text-right pr-4 min-w-[300px]">الصنف</th>
                                <th className="p-3 border-l border-slate-700">وزن البوليصة</th>
                                <th className="p-3 border-l border-slate-700">وزن الميزان</th>
                                <th className="p-3 border-l border-slate-700 bg-emerald-900/40 text-white">الاضافة</th>
                                <th className="p-3 border-l border-slate-700">الفرق</th>
                                <th className="p-3 border-l border-slate-700">الحالة</th>
                                <th className="p-3 border-l border-slate-700">شركة النقل</th>
                                <th className="p-3 border-l border-slate-700">رقم السيارة</th>
                                <th className="p-3 border-l border-slate-700">اسم السائق</th>
                                <th className="p-3 border-l border-slate-700">وصول</th>
                                <th className="p-3 border-l border-slate-700">دخول</th>
                                <th className="p-3 border-l border-slate-700">خروج</th>
                                <th className="p-3 border-l border-slate-700">المدة</th>
                                <th className="p-3 border-l border-slate-700">الوردية</th>
                                <th className="p-3 border-l border-slate-700">الفحص</th>
                                <th className="p-3 border-l border-slate-700">الوزان</th>
                                <th className="p-3 border-l border-slate-700">أمين المخزن</th>
                                <th className="p-3">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="text-[12px] font-bold text-slate-700 bg-white">
                            {tableData.map((r, i) => {
                                const addition = r.additionQty || Math.min(r.quantity, parseFloat(r.policyWeight) || 0);
                                return (
                                    <tr key={`${r.moveId}-${i}`} className={`border-b h-14 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50 transition-colors`}>
                                        <td className="p-2 border-l" style={forceEnNumsStyle}>{i + 1}</td>
                                        <td className="p-2 border-l" style={forceEnNumsStyle}>{r.displayDate}</td>
                                        <td className="p-2 border-l font-mono text-indigo-700 font-black" style={forceEnNumsStyle}>{r.refNumber}</td>
                                        <td className="p-2 border-l font-mono" style={forceEnNumsStyle}>{r.supplyOrderNo || '-'}</td>
                                        <td className="p-2 border-l font-mono" style={forceEnNumsStyle}>{r.policyNo || '-'}</td>
                                        <td className="p-2 border-l text-right pr-4 font-bold">{r.supplier}</td>
                                        <td className="p-2 border-l text-right pr-6 font-black text-slate-900">{r.productName}</td>
                                        <td className="p-2 border-l" style={forceEnNumsStyle}>{parseFloat(r.policyWeight || 0).toFixed(3)}</td>
                                        <td className="p-2 border-l text-blue-700 font-bold" style={forceEnNumsStyle}>{r.quantity.toFixed(3)}</td>
                                        <td className="p-2 border-l bg-emerald-50 text-emerald-800 font-black text-md" style={forceEnNumsStyle}>{addition.toFixed(3)}</td>
                                        <td className={`p-2 border-l font-black ${r.diffWeight < 0 ? 'text-red-600' : 'text-emerald-600'}`} style={forceEnNumsStyle}>{r.diffWeight?.toFixed(3) || '-'}</td>
                                        <td className="p-2 border-l"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.itemStatus === 'مرفوض' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{r.itemStatus || 'تحت الفحص'}</span></td>
                                        <td className="p-2 border-l text-xs">{r.transportCompany || '-'}</td>
                                        <td className="p-2 border-l font-mono" style={forceEnNumsStyle}>{r.carNumber}</td>
                                        <td className="p-2 border-l">{r.driverName}</td>
                                        <td className="p-2 border-l" style={forceEnNumsStyle}>{r.arrivalTime || '-'}</td>
                                        <td className="p-2 border-l" style={forceEnNumsStyle}>{r.entryTime || '-'}</td>
                                        <td className="p-2 border-l" style={forceEnNumsStyle}>{r.exitTime || '-'}</td>
                                        <td className="p-2 border-l font-black text-blue-600" style={forceEnNumsStyle}>{r.duration || '-'}</td>
                                        <td className="p-2 border-l text-[10px]">{r.shift}</td>
                                        <td className="p-2 border-l text-[10px]">{r.inspectingOfficer || r.inspector || '-'}</td>
                                        <td className="p-2 border-l text-[10px]">{r.weighmasterName || '-'}</td>
                                        <td className="p-2 border-l">{r.storekeeper}</td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => { if(window.confirm('حذف؟')) { dbService.deleteMovement(r.moveId); refreshProducts(); setUpdateTrigger(p => p + 1); } }} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-all active:scale-90"><Trash2 size={20}/></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

/**
 * 2. صرف كنترول - Control Center Issues
 */
const ControlOutView: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
    const { settings, products, user, refreshProducts, addNotification } = useApp();
    const [isFormOpen, setIsFormOpen] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [pastedItems, setPastedItems] = useState<any[]>([]);
    const [updateTrigger, setUpdateTrigger] = useState(0);

    const INITIAL_HEADER = { 
        date: new Date().toISOString().split('T')[0], 
        shift: 'الأولى', 
        storekeeper: user?.name || 'System Admin', 
        notes: '', 
        fattening: '', 
        fish: '', 
        duck: '', 
        pets: '', 
        refNumber: '',
        customFields: {}
    };

    const [formHeader, setFormHeader] = useState<any>(INITIAL_HEADER);
    const [itemSearch, setItemSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);

    const handlePaste = (e: React.ClipboardEvent) => {
        const text = e.clipboardData.getData('text');
        if (!text) return;
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        const items = lines.map(line => {
            const cols = line.split('\t');
            if (cols.length < 5) return null;
            const name = cols[3]?.trim();
            const product = products.find(p => smartNormalize(p.name) === smartNormalize(name) || p.barcode === cols[1]?.trim());
            const f = parseFloat(cols[5]) || 0; const s = parseFloat(cols[6]) || 0; const d = parseFloat(cols[7]) || 0; const p = parseFloat(cols[8]) || 0;
            const total = f + s + d + p;
            return {
                date: cols[0], code: product?.barcode || cols[1], name: product?.name || name,
                fattening: f, fish: s, duck: d, pets: p, total, isValid: !!product, productId: product?.id, currentStock: product?.stockPacked || 0
            };
        }).filter(Boolean);
        setPastedItems(items);
    };

    const handleBatchPost = () => {
        if (pastedItems.length === 0) return;
        
        pastedItems.forEach(item => {
            if (!item.isValid) return;
            const move: StockMovement = {
                id: (Date.now() + Math.random()).toString(), 
                date: new Date(item.date).toISOString(),
                type: 'out', warehouse: 'raw', refNumber: dbService.getNextId('issueVoucher'),
                user: user?.name || 'Admin', 
                items: [{ productId: item.productId, productName: item.name, quantity: item.total, quantityPacked: item.total, unit: 'طن' }],
                reason: 'صرف كنترول مجمع',
                customFields: { ...formHeader, ...formHeader.customFields, viewContext: 'control_out', fattening: item.fattening, fish: item.fish, duck: item.duck, pets: item.pets, moveMode: 'out' }
            };
            dbService.saveMovement(move);
        });
        
        refreshProducts(); 
        setPastedItems([]); 
        setUpdateTrigger(prev => prev + 1);
        addNotification('تم ترحيل كافة البيانات بنجاح', 'success');
    };

    const handleQuickAdd = () => {
        if (!selectedProduct) return alert('اختر صنفاً');
        const f = parseFloat(formHeader.fattening) || 0; const s = parseFloat(formHeader.fish) || 0; const d = parseFloat(formHeader.duck) || 0; const p = parseFloat(formHeader.pets) || 0;
        const total = f+s+d+p;
        if (total <= 0) return alert('ادخل كمية صحيحة');

        const move: StockMovement = {
            id: Date.now().toString(), 
            date: new Date(formHeader.date).toISOString(), 
            type: 'out', warehouse: 'raw', 
            refNumber: formHeader.refNumber || dbService.getNextId('issueVoucher'), 
            user: user?.name || 'Admin',
            items: [{ productId: selectedProduct.id, productName: selectedProduct.name, quantity: total, quantityPacked: total, unit: selectedProduct.unit || 'طن' }],
            reason: 'صرف كنترول يدوي',
            customFields: { ...formHeader, ...formHeader.customFields, viewContext: 'control_out', moveMode: 'out' }
        };
        
        dbService.saveMovement(move); 
        refreshProducts(); 
        setSelectedProduct(null); 
        setItemSearch('');
        setFormHeader({...INITIAL_HEADER, refNumber: dbService.peekNextId('issueVoucher') }); 
        setUpdateTrigger(prev => prev + 1);
        addNotification('تم تسجيل الحركة بنجاح وتصفير الحقول', 'success');
    };

    const tableData: any[] = useMemo(() => {
        return dbService.getMovements()
            .filter(m => m.customFields?.viewContext === 'control_out')
            .flatMap(m => m.items.map(it => ({ 
                ...m, 
                ...it, 
                ...m.customFields, 
                moveId: m.id, 
                displayDate: new Date(m.date).toLocaleDateString('en-GB') 
            })))
            .filter(r => smartNormalize(r.productName).includes(smartNormalize(searchTerm)))
            .reverse();
    }, [searchTerm, updateTrigger]);

    const handleExport = () => {
        const headers = ["م", "التاريخ", "رقم الإذن", "الصنف", "تسمين", "سمك", "بط", "أليفة", "الإجمالي", "الوردية", "أمين المخزن"];
        const data = tableData.map((r, i) => [
            i + 1, r.displayDate, r.refNumber, r.productName, r.fattening, r.fish, r.duck, r.pets, r.quantity, r.shift, r.storekeeper
        ]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, "ControlOut");
        XLSX.writeFile(wb, `Control_Issue_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {isFormOpen && (
                <div className="bg-white p-8 rounded-xl border border-violet-100 shadow-xl no-print">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-violet-100 text-violet-700 rounded-xl shadow-sm"><Gauge size={28}/></div>
                            <div><h3 className="text-xl font-black text-slate-800">صرف الكنترول (إدخال مجمع أو يدوي)</h3></div>
                        </div>
                        <button onClick={() => setIsFormOpen(false)} className="bg-rose-600 text-white px-6 py-2 rounded-xl font-black text-[12px] flex items-center gap-2 shadow-lg border-b-4 border-rose-800 transition-all transform active:scale-95"><X size={16}/> إخفاء</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                        <Field label="التاريخ"><input type="date" value={formHeader.date} onChange={e => setFormHeader({...formHeader, date: e.target.value})} className={inputClasses} style={forceEnNumsStyle}/></Field>
                        <Field label="رقم الإذن (يدوي)"><input className={`${inputClasses} bg-blue-50 border-blue-200`} value={formHeader.refNumber} onChange={e => setFormHeader({...formHeader, refNumber: e.target.value})} placeholder="تلقائي"/></Field>
                        <Field label="الوردية"><select className={inputClasses} value={formHeader.shift} onChange={e => setFormHeader({...formHeader, shift: e.target.value})}>{settings.shifts?.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
                        <Field label="أمين المخزن"><input className={inputClasses} value={formHeader.storekeeper} onChange={e => setFormHeader({...formHeader, storekeeper: e.target.value})}/></Field>
                        <Field label="ملاحظات"><input className={inputClasses} value={formHeader.notes} onChange={e => setFormHeader({...formHeader, notes: e.target.value})}/></Field>
                        
                        <DynamicCustomFieldsRenderer target="raw_issue" formData={formHeader} setFormData={setFormHeader} />
                    </div>

                    <div className="bg-slate-900 rounded-xl p-6 flex flex-col md:flex-row items-end gap-4 shadow-2xl relative z-10 mb-6 border-b-8 border-slate-950">
                        <div className="flex-1 relative w-full"><label className="text-[11px] font-black text-slate-400 mb-1 block mr-4 uppercase">البحث عن الصنف</label><div className="relative"><input className="w-full p-2.5 pr-12 rounded-xl border-none bg-white outline-none font-bold text-md shadow-inner" placeholder="بحث صنف تشغيل..." value={itemSearch} onChange={e => { setItemSearch(e.target.value); if(selectedProduct) setSelectedProduct(null); }} /><Search className="absolute right-4 top-2.5 text-slate-300" size={24}/>{itemSearch && !selectedProduct && (
                            <div className="absolute top-full left-0 right-0 z-[1000] bg-white border border-blue-200 rounded-xl shadow-2xl mt-2 max-h-72 overflow-y-auto p-2">
                                {products.filter(p => p.warehouse === 'raw').filter(p => smartNormalize(p.name).includes(smartNormalize(itemSearch))).map(p => (
                                    <div key={p.id} onClick={() => {setSelectedProduct(p); setItemSearch(p.name);}} className="p-4 hover:bg-slate-50 cursor-pointer border-b rounded-xl flex justify-between items-center transition-all group">
                                        <div className="flex flex-col"><span className="font-black text-slate-800">{p.name}</span><span className="text-[10px] text-slate-400 font-bold">كود: {p.barcode}</span></div>
                                        <span className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-[11px] font-black">رصيد: {p.stockPacked}</span>
                                    </div>
                                ))}
                            </div>
                        )}</div></div>
                        <div className="w-24 text-center"><label className="text-[10px] text-blue-300 mb-1 block uppercase">تسمين</label><input type="number" className="w-full p-2 rounded-xl bg-white text-center font-black" value={formHeader.fattening} onChange={e => setFormHeader({...formHeader, fattening: e.target.value})} style={forceEnNumsStyle}/></div>
                        <div className="w-24 text-center"><label className="text-[10px] text-blue-300 mb-1 block uppercase">سمك</label><input type="number" className="w-full p-2 rounded-xl bg-white text-center font-black" value={formHeader.fish} onChange={e => setFormHeader({...formHeader, fish: e.target.value})} style={forceEnNumsStyle}/></div>
                        <div className="w-24 text-center"><label className="text-[10px] text-blue-300 mb-1 block uppercase">بط</label><input type="number" className="w-full p-2 rounded-xl bg-white text-center font-black" value={formHeader.duck} onChange={e => setFormHeader({...formHeader, duck: e.target.value})} style={forceEnNumsStyle}/></div>
                        <div className="w-24 text-center"><label className="text-[10px] text-blue-300 mb-1 block uppercase">أليفة</label><input type="number" className="w-full p-2 rounded-xl bg-white text-center font-black" value={formHeader.pets} onChange={e => setFormHeader({...formHeader, pets: e.target.value})} style={forceEnNumsStyle}/></div>
                        <button onClick={handleQuickAdd} className="bg-violet-600 hover:bg-violet-700 text-white p-3 rounded-xl shadow-xl active:scale-90 h-12 px-8 font-black border-b-4 border-violet-900"><Plus size={24}/></button>
                    </div>

                    {pastedItems.length === 0 ? (
                        <div className="bg-violet-50/50 border-4 border-dashed border-violet-100 rounded-xl p-12 text-center group hover:bg-violet-50 transition-all relative">
                            <textarea className="absolute inset-0 opacity-0 cursor-pointer z-10" onPaste={handlePaste} placeholder="الصق هنا..." />
                            <div className="flex flex-col items-center gap-4 pointer-events-none">
                                <div className="p-6 bg-white rounded-full shadow-lg text-violet-600 group-hover:scale-110 transition-transform"><ClipboardPaste size={48}/></div>
                                <h4 className="text-xl font-black text-violet-900">اضغط هنا ثم قم باللصق (Ctrl + V)</h4>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white border rounded-xl overflow-hidden shadow-md max-h-[400px] overflow-y-auto">
                                <table className="w-full text-center text-sm border-collapse">
                                    <thead className="bg-[#002060] text-yellow-300 font-black h-10 sticky top-0 z-10">
                                        <tr><th>التاريخ</th><th>الاسم</th><th>تسمين</th><th>سمك</th><th>بط</th><th>أليفة</th><th>الإجمالي</th><th>رصيد متوقع</th></tr>
                                    </thead>
                                    <tbody className="font-bold">
                                        {pastedItems.map((it, i) => (
                                            <tr key={i} className={`border-b h-10 ${it.isValid ? 'hover:bg-blue-50' : 'bg-red-50'}`}>
                                                <td style={forceEnNumsStyle}>{it.date}</td>
                                                <td className="text-right pr-4">{it.name}</td>
                                                <td style={forceEnNumsStyle}>{it.fattening}</td><td style={forceEnNumsStyle}>{it.fish}</td><td style={forceEnNumsStyle}>{it.duck}</td><td style={forceEnNumsStyle}>{it.pets}</td>
                                                <td className="text-violet-700 font-black" style={forceEnNumsStyle}>{it.total.toFixed(3)}</td>
                                                <td className={`font-black ${(it.currentStock - it.total) < 0 ? 'text-red-500' : 'text-green-500'}`} style={forceEnNumsStyle}>{(it.currentStock - it.total).toFixed(3)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={handleBatchPost} className="flex-1 bg-violet-600 text-white py-4 rounded-xl font-black text-xl shadow-xl flex items-center justify-center gap-3 active:scale-95 border-b-4 border-violet-900"><Send/> ترحيل البيانات للصوامع</button>
                                <button onClick={() => setPastedItems([])} className="px-8 bg-slate-100 rounded-xl font-bold border border-slate-200">إلغاء</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            <div className="bg-white rounded-xl border border-slate-100 shadow-premium overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-slate-900 text-white">
                    <h2 className="text-xl font-black">سجل الكنترول التاريخي</h2>
                    <div className="flex items-center gap-4">
                        <div className="relative w-64"><input className="w-full pr-10 pl-4 py-2 rounded-xl text-slate-800 text-sm font-bold shadow-inner border-none" placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/><Search className="absolute right-3 top-2.5 text-gray-400" size={18}/></div>
                        <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 border-b-4 border-emerald-800 transition-all"><FileUp size={18}/> تصدير Excel</button>
                        {!isFormOpen && <button onClick={() => setIsFormOpen(true)} className="bg-violet-600 text-white px-6 py-2 rounded-xl font-black text-[12px] flex items-center gap-2 shadow-lg active:scale-95 border-b-4 border-violet-800 transition-all"><Plus size={18}/> إظهار الإدخال</button>}
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full border-collapse min-w-[2000px]" ref={tableRef}>
                        <thead className="sticky top-0 bg-[#002060] text-yellow-300 font-black text-[11px] uppercase border-b h-12 shadow-lg z-10">
                            <tr><th className="p-3 border-l border-slate-700">م</th><th className="p-3 border-l border-slate-700">التاريخ</th><th className="p-3 border-l border-slate-700">رقم الإذن</th><th className="p-3 border-l border-slate-700 text-right pr-6 min-w-[250px]">اسم الصنف</th><th className="p-3 border-l border-slate-700">تسمين</th><th className="p-3 border-l border-slate-700">سمك</th><th className="p-3 border-l border-slate-700">بط</th><th className="p-3 border-l border-slate-700">أليفة</th><th className="p-3 border-l border-slate-700 font-black">الإجمالي</th><th className="p-3">إجراءات</th></tr>
                        </thead>
                        <tbody className="text-[13px] font-bold">
                            {tableData.map((r, i) => (
                                <tr key={`${r.moveId}-${i}`} className={`border-b h-14 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-violet-50 transition-colors`}>
                                    <td className="p-2 border-l" style={forceEnNumsStyle}>{i + 1}</td>
                                    <td className="p-2 border-l" style={forceEnNumsStyle}>{r.displayDate}</td>
                                    <td className="p-2 border-l font-mono text-indigo-600" style={forceEnNumsStyle}>{r.refNumber}</td>
                                    <td className="p-2 border-l text-right pr-6 font-black text-slate-900">{r.productName}</td>
                                    <td className="p-2 border-l" style={forceEnNumsStyle}>{formatVal(r.fattening)}</td>
                                    <td className="p-2 border-l" style={forceEnNumsStyle}>{formatVal(r.fish)}</td>
                                    <td className="p-2 border-l" style={forceEnNumsStyle}>{formatVal(r.duck)}</td>
                                    <td className="p-2 border-l" style={forceEnNumsStyle}>{formatVal(r.pets)}</td>
                                    <td className="p-2 border-l text-violet-700 font-black text-lg" style={forceEnNumsStyle}>{formatVal(r.quantity)}</td>
                                    <td className="p-2 text-center"><button onClick={() => { if(window.confirm('حذف؟')) { dbService.deleteMovement(r.moveId); refreshProducts(); setUpdateTrigger(p => p + 1); } }} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-all active:scale-90"><Trash2 size={20}/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

/**
 * 3. حركات مخزنية أخرى
 */
const OtherMovementsView: React.FC<{ view: any, title: string, onSuccess: () => void }> = ({ view, title, onSuccess }) => {
    const { settings, products, user, refreshProducts, addNotification } = useApp();
    const [activeTab, setActiveTab] = useState('out');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [itemSearch, setItemSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [qty, setQty] = useState('');
    const [updateTrigger, setUpdateTrigger] = useState(0);

    const INITIAL_HEADER = { 
        date: new Date().toISOString().split('T')[0], 
        notes: '', recipientName: '', targetWarehouse: '', refNumber: '', customFields: {}
    };
    const [formHeader, setFormHeader] = useState<any>(INITIAL_HEADER);
    const tableRef = useRef<HTMLTableElement>(null);

    const isQuickDesign = ['shortage', 'wh_adj', 'silo_adj', 'silo_trans', 'raw_return', 'wh_out', 'wh_transfer', 'raw_sale'].includes(view);
    const currentTabs = useMemo(() => {
        if (view === 'silo_trans') return [{ id: 'in', label: 'إضافة للصوامع', icon: <PlusCircle size={24}/>, color: 'emerald' }, { id: 'out', label: 'خصم من الصوامع', icon: <MinusSquare size={24}/>, color: 'rose' }];
        if (view === 'shortage') return [{ id: 'allowed', label: 'عجز مسموح', icon: <FileWarning size={24}/>, color: 'amber' }, { id: 'disallowed', label: 'عجز غير مسموح', icon: <ShieldAlert size={24}/>, color: 'rose' }];
        if (view.includes('adj')) return [{ id: 'in', label: 'تسوية إضافة', icon: <PlusSquare size={24}/>, color: 'emerald' }, { id: 'out', label: 'تسوية خصم', icon: <MinusSquare size={24}/>, color: 'rose' }];
        if (view === 'raw_return') return [{ id: 'in', label: 'مرتجع وارد', icon: <Undo2 size={24}/>, color: 'emerald' }, { id: 'out', label: 'مرتجع صادر', icon: <RotateCcw size={24}/>, color: 'rose' }];
        if (view === 'wh_out') return [{ id: 'out', label: 'صرف من المخزن', icon: <LogOut size={24}/>, color: 'rose' }];
        if (view === 'wh_transfer') return [{ id: 'out', label: 'تحويل صادر', icon: <ArrowRightLeft size={24}/>, color: 'blue' }];
        if (view === 'raw_sale') return [{ id: 'out', label: 'إذن مبيعات', icon: <ShoppingCart size={24}/>, color: 'blue' }];
        return [];
    }, [view]);

    useEffect(() => { if (currentTabs.length > 1) setActiveTab(currentTabs[0].id); }, [view]);

    const handleSave = () => {
        if (!selectedProduct || !qty) return alert('أكمل البيانات');
        let type: any = 'out';
        if (activeTab === 'in' || activeTab === 'allowed') type = (view === 'raw_return' ? 'return' : (isQuickDesign ? 'adjustment' : 'in'));
        if (activeTab === 'out' || activeTab === 'disallowed') type = (view === 'raw_return' ? 'out' : (isQuickDesign ? 'adjustment' : 'out'));
        if (view === 'silo_trans' || view === 'wh_transfer') type = 'transfer';
        if (view === 'raw_sale') type = 'out';

        const finalRef = formHeader.refNumber || dbService.getNextId(type === 'in' ? 'receiveVoucher' : 'issueVoucher');

        const move: StockMovement = {
            id: Date.now().toString(), date: new Date(formHeader.date).toISOString(), type, warehouse: 'raw',
            refNumber: finalRef,
            user: user?.name || 'Admin', items: [{ productId: selectedProduct.id, productName: selectedProduct.name, quantity: parseFloat(qty), unit: selectedProduct.unit || 'طن', notes: formHeader.notes }],
            reason: formHeader.recipientName || title,
            customFields: { ...formHeader, ...formHeader.customFields, viewContext: view, moveMode: activeTab, refNumber: finalRef }
        };
        dbService.saveMovement(move); 
        refreshProducts(); 
        setQty(''); 
        setSelectedProduct(null); 
        setItemSearch('');
        setFormHeader({...INITIAL_HEADER, refNumber: dbService.peekNextId(type === 'in' ? 'receiveVoucher' : 'issueVoucher')});
        setUpdateTrigger(p => p + 1);
        addNotification('تم تسجيل الحركة بنجاح وتصفير الحقول', 'success');
    };

    const tableData: any[] = useMemo(() => {
        return dbService.getMovements()
            .filter(m => m.customFields?.viewContext === view)
            .flatMap(m => m.items.map(it => ({ 
                ...m, 
                ...it, 
                ...m.customFields, 
                moveId: m.id, 
                displayDate: new Date(m.date).toLocaleDateString('en-GB') 
            })))
            .filter(r => smartNormalize(r.productName).includes(smartNormalize(searchTerm)))
            .reverse();
    }, [view, searchTerm, updateTrigger]);

    const handleExport = () => {
        const headers = ["م", "التاريخ", "رقم الإذن", "الصنف", "الكمية", "البيان / المستلم", "أمين المخزن", "ملاحظات"];
        const data = tableData.map((r, i) => [
            i + 1, r.displayDate, r.refNumber, r.productName, r.quantity, r.reason, r.user, r.notes || '-'
        ]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `${title}_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const TabItem = ({ active, onClick, icon, label, color }: any) => {
        const colorClasses: Record<string, string> = {
            emerald: active ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50',
            rose: active ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50',
            amber: active ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50',
            blue: active ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50',
        };
        const colorClass = colorClasses[color] || (active ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50');
        return <button onClick={onClick} className={`flex items-center gap-2 p-4 rounded-xl border-2 transition-all ${colorClass}`}>{icon} <span className="font-black text-xs">{label}</span></button>;
    };

    return (
        <div className="space-y-6">
            {isFormOpen && (
                <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-xl no-print">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black text-slate-800">{title}</h3>
                        <button onClick={() => setIsFormOpen(false)} className="bg-rose-600 text-white px-6 py-2 rounded-xl font-black text-[12px] flex items-center gap-2 shadow-lg border-b-4 border-rose-800 transition-all"><X size={16}/> إخفاء</button>
                    </div>
                    {isQuickDesign && currentTabs.length > 1 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">{currentTabs.map(t => <TabItem key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} {...t}/>)}</div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                        <Field label="التاريخ"><input type="date" value={formHeader.date} onChange={e => setFormHeader({...formHeader, date: e.target.value})} className={inputClasses} style={forceEnNumsStyle}/></Field>
                        <Field label="رقم الإذن (يدوي)"><input className={`${inputClasses} bg-blue-50 border-blue-200`} value={formHeader.refNumber} onChange={e => setFormHeader({...formHeader, refNumber: e.target.value})} placeholder="تلقائي"/></Field>
                        <Field label="البيان / المستلم"><input className={inputClasses} value={formHeader.recipientName} onChange={e => setFormHeader({...formHeader, recipientName: e.target.value})}/></Field>
                        <Field label="ملاحظات"><input className={inputClasses} value={formHeader.notes} onChange={e => setFormHeader({...formHeader, notes: e.target.value})}/></Field>
                        {view === 'wh_transfer' && <Field label="المخزن الوجهة"><input className={inputClasses} value={formHeader.targetWarehouse} onChange={e => setFormHeader({...formHeader, targetWarehouse: e.target.value})}/></Field>}
                        
                        <DynamicCustomFieldsRenderer 
                            target={ (view === 'raw_in' || view === 'raw_return') ? 'raw_receive' : (view === 'wh_adj' || view === 'silo_adj' || view === 'shortage') ? 'raw_settlement' : 'raw_issue' } 
                            formData={formHeader} 
                            setFormData={setFormHeader} 
                        />
                    </div>
                    <div className="bg-slate-900 p-6 rounded-xl flex flex-col md:flex-row items-end gap-4 shadow-xl border-b-8 border-slate-950">
                        <div className="flex-1 relative w-full"><label className="text-[10px] text-slate-400 mb-1 block">البحث عن الصنف</label>
                            <input className="w-full p-3 rounded-xl border-none font-bold outline-none" value={itemSearch} onChange={e => { setItemSearch(e.target.value); if(selectedProduct) setSelectedProduct(null); }} placeholder="بحث..." />
                            {itemSearch && !selectedProduct && (
                                <div className="absolute top-full left-0 right-0 bg-white border-2 border-indigo-100 rounded-xl shadow-2xl z-[1000] p-2 max-h-40 overflow-y-auto">
                                    {products.filter(p => p.warehouse === 'raw').filter(p => smartNormalize(p.name).includes(smartNormalize(itemSearch))).map(p => (
                                        <div key={p.id} onClick={() => {setSelectedProduct(p); setItemSearch(p.name);}} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 font-bold text-sm rounded-lg flex justify-between"><span>{p.name}</span><span className="text-xs text-blue-600">رصيد: {p.stock}</span></div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="w-48"><label className="text-[10px] text-slate-400 mb-1 block text-center">الكمية</label><input type="number" value={qty} onChange={e => setQty(e.target.value)} className="w-full p-3 rounded-xl text-center font-black text-blue-800" style={forceEnNumsStyle} placeholder="0.000"/></div>
                        <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-black shadow-lg flex items-center gap-2 h-[52px] border-b-4 border-indigo-900 active:scale-95 transition-all"><Save size={20}/> تسجيل الحركة</button>
                    </div>
                </div>
            )}
            <div className="bg-white rounded-xl border border-slate-100 shadow-premium overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-slate-900 text-white">
                    <h2 className="text-xl font-black">السجل التاريخي للعملية: {title}</h2>
                    <div className="flex items-center gap-4">
                        <div className="relative w-64"><input className="w-full pr-10 pl-4 py-2 rounded-xl text-slate-800 text-sm font-bold shadow-inner border-none" placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/><Search className="absolute right-3 top-2.5 text-gray-400" size={18}/></div>
                        <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 border-b-4 border-emerald-800 transition-all"><FileUp size={18}/> تصدير Excel</button>
                        {!isFormOpen && <button onClick={() => setIsFormOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg active:scale-95 border-b-4 border-blue-800 transition-all"><PlusCircle size={16} className="inline ml-1"/> إظهار الإدخال</button>}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[1500px]" ref={tableRef}>
                        <thead className="bg-[#1e293b] text-white font-black text-[11px] uppercase border-b h-12 shadow-md">
                            <tr><th className="p-4 border-l border-slate-700 w-12 text-center">م</th><th>التاريخ</th><th>رقم الإذن</th><th className="text-right pr-6 min-w-[250px]">اسم الصنف</th><th>الكمية</th><th>نوع الحركة / السبب</th><th>أمين المخزن</th><th>الرصيد</th><th>إجراء</th></tr>
                        </thead>
                        <tbody className="text-[13px] font-bold text-slate-700 bg-white">
                            {tableData.map((r, i) => (
                                <tr key={`${r.moveId}-${i}`} className={`border-b h-14 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                    <td className="p-2 border-l text-center" style={forceEnNumsStyle}>{i + 1}</td>
                                    <td className="p-2 border-l text-center" style={forceEnNumsStyle}>{r.displayDate}</td>
                                    <td className="p-2 border-l text-center font-mono text-indigo-700" style={forceEnNumsStyle}>{r.refNumber}</td>
                                    <td className="p-2 border-l text-right pr-6 font-black text-slate-900">{r.productName}</td>
                                    <td className={`p-2 border-l text-center text-xl font-black ${r.type === 'in' || r.moveMode?.includes('in') || r.moveMode?.includes('allowed') ? 'text-emerald-600' : 'text-rose-600'}`} style={forceEnNumsStyle}>{r.quantity.toFixed(3)}</td>
                                    <td className="p-2 border-l text-center font-bold">{r.reason}</td>
                                    <td className="p-2 border-l text-center font-bold text-slate-400">{r.storekeeper || r.user}</td>
                                    <td className="p-2 border-l text-center font-black text-blue-900 bg-blue-50/20" style={forceEnNumsStyle}>{r.currentBalance?.toFixed(3)}</td>
                                    <td className="p-2 text-center"><button onClick={() => { if(window.confirm('حذف؟')) { dbService.deleteMovement(r.moveId); refreshProducts(); setUpdateTrigger(p => p + 1); } }} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-all active:scale-90"><Trash2 size={16}/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const RawMegaTable: React.FC<Props> = ({ view, onSuccess, title }) => {
    if (view === 'raw_in') return <RawInView onSuccess={onSuccess} />;
    if (view === 'control_out') return <ControlOutView onSuccess={onSuccess} />;
    if (view === 'raw_ledger' || view === 'balances') return <RawLedgerView />;
    if (view === 'raw_in_daily') return <RawDailyDetailView />;
    if (['wh_out', 'wh_transfer', 'raw_sale', 'silo_trans', 'wh_adj', 'silo_adj', 'shortage', 'raw_return'].includes(view)) {
        return <OtherMovementsView view={view} title={title} onSuccess={onSuccess} />;
    }
    return <div className="p-20 text-center text-slate-400 font-black italic">جاري التحميل...</div>;
};
