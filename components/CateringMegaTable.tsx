
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { 
    Search, Plus, Save, X, Trash2, Calendar, Hash, Truck, 
    User, Clock, FileText, ClipboardCheck,
    Settings, Package, PlusCircle, UserCog, Timer, Warehouse,
    ArrowRightLeft, UserCheck, MapPin, ShieldCheck, ShoppingCart, Tag, Briefcase, MinusCircle, ArrowDownLeft, ArrowUpRight, Undo2, ClipboardSignature,
    History
} from 'lucide-react';
import { StockMovement, Product, WarehouseType } from '../types';
import { TableToolbar } from './TableToolbar';
import { ReportActionsBar } from './ReportActionsBar';
import { PrintSettingsModal } from './PrintSettingsModal';
import { InputModal, GlassCard } from './NeumorphicUI';
import { printService } from '../services/printing';
import * as XLSX from 'xlsx';

interface Props {
    view: 'in' | 'out' | 'all' | 'transfer_in' | 'transfer_out' | 'adj_in' | 'adj_out' | 'return';
    title: string;
}

const DEFAULT_STYLES = {
    fontFamily: 'Calibri, sans-serif',
    fontSize: 13,
    isBold: true,
    textAlign: 'center' as 'right' | 'center' | 'left',
    verticalAlign: 'middle' as 'top' | 'middle' | 'bottom',
    decimals: 2,
    rowHeight: 45,
    columnWidth: 150
};

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontSize: '12px',
    fontWeight: '700'
};

const ActionHistoryTable: React.FC<{ 
    warehouse: WarehouseType, 
    view: string, 
    title: string 
}> = ({ warehouse, view, title }) => {
    const { movements: allMovements } = useApp();
    const movements = useMemo(() => {
        return allMovements
            .filter(m => m.warehouse === warehouse)
            .filter(m => {
                if (view === 'all') return true;
                if (view === 'in') return m.type === 'in' && !m.reason?.includes('تحويل') && !m.reason?.includes('مرتجع');
                if (view === 'out') return m.type === 'out' && !m.reason?.includes('تحويل');
                if (view === 'transfer_in') return m.type === 'in' && m.reason?.includes('تحويل');
                if (view === 'transfer_out') return m.type === 'out' && m.reason?.includes('تحويل');
                if (view === 'return') return m.type === 'return' || (m.type === 'in' && m.reason?.includes('مرتجع'));
                return m.type === view;
            })
            .reverse();
    }, [allMovements, warehouse, view]);

    return (
        <div className="mt-8 space-y-3 animate-fade-in no-print">
            <div className="flex items-center gap-2 px-2 text-slate-800">
                <History size={20} className="text-emerald-600"/>
                <h3 className="text-[16px] font-black font-cairo">سجل الحركات التاريخي لـ ({title})</h3>
            </div>
            <div className="bg-white rounded-[2rem] shadow-premium border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-center border-collapse min-w-[2000px]">
                        <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                            <tr className="h-12 text-[12px] font-black uppercase">
                                <th className="p-2 border-l border-slate-700 w-12">م</th>
                                <th className="p-2 border-l border-slate-700">التاريخ</th>
                                <th className="p-2 border-l border-slate-700">رقم الإذن</th>
                                <th className="p-2 border-l border-slate-700 text-right pr-6">اسم الصنف</th>
                                <th className="p-2 border-l border-slate-700">الكمية</th>
                                <th className="p-2 border-l border-slate-700">الوحدة</th>
                                <th className="p-2 border-l border-slate-700 text-right pr-6">المورد / المستلم</th>
                                <th className="p-2 border-l border-slate-700">رقم الفحص</th>
                                <th className="p-2 border-l border-slate-700">رقم الإضافة</th>
                                <th className="p-2 border-l border-slate-700">الدخول</th>
                                <th className="p-2 border-l border-slate-700">الخروج</th>
                                <th className="p-2 border-l border-slate-700">الفرق</th>
                                <th className="p-2 border-l border-slate-700">أمين المخزن</th>
                                <th className="p-2">الرصيد اللحظي</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px] font-bold text-slate-700">
                            {movements.flatMap((m, mIdx) => m.items.map((item, iIdx) => (
                                <tr key={`${m.id}-${iIdx}`} className="border-b hover:bg-emerald-50 h-12 transition-colors">
                                    <td className="p-2 border-l" style={forceEnNumsStyle}>{mIdx + 1}</td>
                                    <td className="p-2 border-l" style={forceEnNumsStyle}>{new Date(m.date).toLocaleDateString('en-GB')}</td>
                                    <td className="p-2 border-l font-mono text-indigo-700">{m.refNumber}</td>
                                    <td className="p-2 border-l text-right pr-6 font-black text-slate-900">{item.productName}</td>
                                    <td className="p-2 border-l text-emerald-800 font-black" style={forceEnNumsStyle}>{item.quantity}</td>
                                    <td className="p-2 border-l text-slate-400">{item.unit}</td>
                                    <td className="p-2 border-l text-right pr-6">{m.reason}</td>
                                    <td className="p-2 border-l font-mono text-[11px]">{m.customFields?.inspectionReportNo || '-'}</td>
                                    <td className="p-2 border-l font-mono text-[11px] text-blue-700">{m.customFields?.systemAddNo || '-'}</td>
                                    <td className="p-2 border-l font-mono text-[11px]">{m.customFields?.entryTime || '-'}</td>
                                    <td className="p-2 border-l font-mono text-[11px]">{m.customFields?.exitTime || '-'}</td>
                                    <td className="p-2 border-l font-mono text-[11px] text-indigo-600">{m.customFields?.timeDiff || '-'}</td>
                                    <td className="p-2 border-l">{m.user}</td>
                                    <td className="p-2 bg-slate-50 font-black" style={forceEnNumsStyle}>{item.currentBalance?.toFixed(2)}</td>
                                </tr>
                            )))}
                            {movements.length === 0 && (
                                <tr><td colSpan={14} className="p-16 text-center text-slate-300 font-bold italic text-lg">لا توجد حركات مسجلة حالياً لهذه العملية</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const CateringMegaTable: React.FC<Props> = ({ view, title }) => {
    const { settings, products, user, refreshProducts, updateSettings } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(view !== 'all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [itemSearch, setItemSearch] = useState('');
    const [qty, setQty] = useState<number | string>('');
    const [draftItems, setDraftItems] = useState<any[]>([]);
    const tableRef = useRef<HTMLTableElement>(null);
    const [tableStyles, setTableStyles] = useState(DEFAULT_STYLES);

    const [formHeader, setFormHeader] = useState({
        date: new Date().toISOString().split('T')[0],
        refNumber: '',
        supplierName: '',
        inspectionReportNo: '',
        inspectingOfficer: '',
        systemAddNo: '',
        housingOfficer: '',
        recipientName: '',
        destination: '',
        entryTime: '',
        exitTime: '',
        notes: '',
        storekeeper: user?.name || ''
    });

    const resetForm = () => {
        setDraftItems([]);
        setSelectedProduct(null);
        setItemSearch('');
        setQty('');
        setFormHeader(prev => ({
            ...prev,
            refNumber: '',
            supplierName: '',
            inspectionReportNo: '',
            inspectingOfficer: '',
            systemAddNo: '',
            housingOfficer: '',
            recipientName: '',
            destination: '',
            entryTime: '',
            exitTime: '',
            notes: ''
        }));
    };

    const timeDiff = useMemo(() => {
        if (!formHeader.entryTime || !formHeader.exitTime) return '00:00';
        const [h1, m1] = formHeader.entryTime.split(':').map(Number);
        const [h2, m2] = formHeader.exitTime.split(':').map(Number);
        let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        const h = Math.floor(diffMinutes / 60).toString().padStart(2, '0');
        const m = (diffMinutes % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    }, [formHeader.entryTime, formHeader.exitTime]);

    const handleAddToDraft = () => {
        if (!selectedProduct || Number(qty) <= 0) return;
        const newItem = {
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            productCode: selectedProduct.barcode,
            unit: selectedProduct.unit || 'عدد',
            quantity: Number(qty),
            currentBalance: selectedProduct.stock,
            timeDiff,
            ...formHeader
        };
        setDraftItems([...draftItems, newItem]);
        setSelectedProduct(null);
        setItemSearch('');
        setQty('');
    };

    const handleSaveMovement = () => {
        if (draftItems.length === 0) return;
        
        let type: any = (view === 'in' || view === 'transfer_in' || view === 'return') ? 'in' : (view === 'adj_in' || view === 'adj_out' ? 'adjustment' : 'out');
        if (view === 'return') type = 'return';

        const finalRef = formHeader.refNumber || dbService.getNextId(type === 'in' ? 'receiveVoucher' : 'issueVoucher');

        const movement: StockMovement = {
            id: Date.now().toString(),
            date: new Date(formHeader.date).toISOString(),
            type,
            warehouse: 'catering',
            refNumber: finalRef,
            user: formHeader.storekeeper,
            reason: formHeader.supplierName || formHeader.destination || title,
            items: draftItems,
            customFields: { ...formHeader, timeDiff, refNumber: finalRef }
        };
        
        dbService.saveMovement(movement);
        refreshProducts();
        resetForm();
        alert(`تم ترحيل مستند الإعاشة بنجاح رقم: ${finalRef}`);
    };

    const inputClasses = "w-full px-3 py-2 border border-slate-300 rounded-lg text-[14px] bg-white outline-none focus:border-emerald-500 font-bold shadow-sm h-10 transition-all";
    const labelClasses = "text-[11px] font-black text-slate-600 mb-0.5 flex items-center gap-1 uppercase pr-1 tracking-tight";

    return (
        <div className="space-y-0 font-cairo animate-fade-in" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context={`cateringmega_${view}`} />}
            
            {isFormOpen ? (
                <div className="bg-[#f3f4f6]/70 border-x border-b border-slate-300 shadow-2xl no-print relative overflow-visible rounded-xl mb-6">
                    <div className={`px-6 py-3 text-white flex justify-between items-center rounded-t-xl bg-emerald-700 shadow-lg`}>
                        <div className="flex items-center gap-3">
                            <PlusCircle size={22}/>
                            <h3 className="font-black text-[16px]">نافذة إدخال بيانات {title}</h3>
                        </div>
                        <button onClick={() => setIsFormOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-all border border-white/30 px-3 py-1 text-[12px] font-bold">إخفاء الحقول <X size={16} className="inline ml-1"/></button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-3">
                            <div className="flex flex-col"><label className={labelClasses}><Calendar size={13}/> التاريخ</label><input type="date" className={inputClasses} value={formHeader.date} onChange={e => setFormHeader({...formHeader, date: e.target.value})} style={forceEnNumsStyle}/></div>
                            <div className="flex flex-col"><label className={labelClasses}><Hash size={13}/> رقم الإذن</label><input className={`${inputClasses} text-center font-mono bg-slate-50`} placeholder="تلقائي" value={formHeader.refNumber} onChange={e => setFormHeader({...formHeader, refNumber: e.target.value})}/></div>
                            
                            {(view === 'in' || view === 'transfer_in' || view === 'return') ? (
                                <>
                                    <div className="flex flex-col"><label className={labelClasses}><Truck size={13}/> المورد / الجهة</label><input className={inputClasses} value={formHeader.supplierName} onChange={e => setFormHeader({...formHeader, supplierName: e.target.value})}/></div>
                                    <div className="flex flex-col"><label className={labelClasses}><FileText size={13}/> رقم محضر الفحص</label><input className={inputClasses} value={formHeader.inspectionReportNo} onChange={e => setFormHeader({...formHeader, inspectionReportNo: e.target.value})}/></div>
                                    <div className="flex flex-col"><label className={labelClasses}><UserCheck size={13}/> القائم بالفحص</label><input className={inputClasses} value={formHeader.inspectingOfficer} onChange={e => setFormHeader({...formHeader, inspectingOfficer: e.target.value})}/></div>
                                    <div className="flex flex-col"><label className={`${labelClasses} text-indigo-700`}><ClipboardSignature size={13}/> رقم الإضافة سيستم</label><input className={`${inputClasses} border-indigo-200`} value={formHeader.systemAddNo} onChange={e => setFormHeader({...formHeader, systemAddNo: e.target.value})}/></div>
                                </>
                            ) : (
                                <>
                                    <div className="flex flex-col"><label className={labelClasses}><MapPin size={13}/> الجهة / المستلم</label><input className={inputClasses} value={formHeader.destination} onChange={e => setFormHeader({...formHeader, destination: e.target.value})}/></div>
                                    <div className="flex flex-col"><label className={labelClasses}><ArrowDownLeft size={13}/> وقت الدخول</label><input type="time" className={inputClasses} value={formHeader.entryTime} onChange={e => setFormHeader({...formHeader, entryTime: e.target.value})} style={forceEnNumsStyle}/></div>
                                    <div className="flex flex-col"><label className={labelClasses}><ArrowUpRight size={13}/> وقت الخروج</label><input type="time" className={inputClasses} value={formHeader.exitTime} onChange={e => setFormHeader({...formHeader, exitTime: e.target.value})} style={forceEnNumsStyle}/></div>
                                    <div className="flex flex-col"><label className={labelClasses}><Timer size={13}/> الفرق</label><input className={`${inputClasses} bg-blue-50 text-blue-700 text-center font-black`} value={timeDiff} readOnly style={forceEnNumsStyle}/></div>
                                </>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-300 mt-4 space-y-3">
                            <label className="text-[12px] font-black text-emerald-700 block uppercase tracking-wide">إضافة صنف للسلة</label>
                            <div className="flex gap-4 items-center relative z-[300]">
                                <div className="relative flex-1">
                                    <input 
                                        className={`w-full p-3 pr-11 rounded-xl border border-slate-300 outline-none font-bold text-sm focus:ring-4 focus:ring-emerald-500/10 transition-all ${selectedProduct ? 'bg-emerald-50 border-emerald-500' : 'bg-white shadow-inner'}`} 
                                        placeholder="ابحث بكود أو اسم صنف الإعاشة..." 
                                        value={itemSearch} 
                                        onChange={e => { setItemSearch(e.target.value); if(selectedProduct) setSelectedProduct(null); }} 
                                    />
                                    <Search className="absolute right-4 top-3 text-slate-400" size={20}/>
                                    {itemSearch && !selectedProduct && (
                                        <div className="absolute top-full left-0 right-0 z-[1000] bg-white border border-slate-200 rounded-2xl shadow-2xl mt-2 max-h-60 overflow-y-auto p-2">
                                            {products.filter(p => p.warehouse === 'catering' && (p.name.includes(itemSearch) || p.barcode.includes(itemSearch))).map(p => (
                                                <div key={p.id} onClick={() => {setSelectedProduct(p); setItemSearch(p.name);}} className="p-4 hover:bg-emerald-50 cursor-pointer border-b last:border-0 rounded-xl flex justify-between items-center transition-all">
                                                    <div className="flex flex-col"><span className="font-black text-slate-800 text-sm">{p.name}</span><span className="text-[11px] text-slate-400 font-mono">{p.barcode}</span></div>
                                                    <span className="bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-[11px] font-black">رصيد: {p.stock}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="w-32">
                                    <input type="number" className="w-full p-3 rounded-xl border border-slate-300 outline-none text-center font-black text-emerald-900 shadow-inner h-11 text-lg" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" style={forceEnNumsStyle}/>
                                </div>
                                <button onClick={handleAddToDraft} className="bg-emerald-600 hover:bg-emerald-800 text-white px-8 h-11 rounded-xl shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 font-black text-[15px] border-b-4 border-emerald-900 shrink-0"><Plus size={22} strokeWidth={3}/> إضافة للجدول</button>
                            </div>
                        </div>

                        {draftItems.length > 0 && (
                            <div className="animate-fade-in space-y-4 pt-4">
                                <div className="bg-[#111827] rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
                                    <table className="w-full text-center text-[14px] border-collapse">
                                        <thead className="bg-[#111827] text-slate-300 h-14 font-black uppercase">
                                            <tr><th className="p-3 border-l border-slate-700 text-right pr-8 text-white">الصنف المضاف</th><th className="p-3 border-l border-slate-700">الكمية</th><th className="p-3 border-l border-slate-700">الوحدة</th><th className="p-3">حذف</th></tr>
                                        </thead>
                                        <tbody className="font-bold text-slate-700 bg-white">
                                            {draftItems.map((item, idx) => (
                                                <tr key={idx} className="border-b h-14 hover:bg-slate-50 transition-colors">
                                                    <td className="p-3 border-l text-right pr-8 font-black text-slate-900">{item.productName}</td>
                                                    <td className="p-3 border-l text-emerald-700 text-lg font-black" style={forceEnNumsStyle}>{item.quantity}</td>
                                                    <td className="p-3 border-l text-slate-400">{item.unit}</td>
                                                    <td className="p-3"><button onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"><Trash2 size={20}/></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button onClick={handleSaveMovement} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-black text-2xl shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] border-b-8 border-emerald-900"><Save size={32}/> ترحيل وحفظ مستند الـ {title} نهائياً</button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="p-4 no-print animate-fade-in mb-4">
                    <button 
                        onClick={() => setIsFormOpen(true)} 
                        className="bg-emerald-700 text-white px-10 py-3 rounded-2xl font-black shadow-lg hover:brightness-110 transition-all flex items-center gap-3 border-b-4 border-emerald-900"
                    >
                        <PlusCircle size={22}/> فتح نافذة إدخال بيانات {title}
                    </button>
                </div>
            )}

            {/* سجل التاريخ أسفل كل نموذج - يبقى ظاهراً دائماً */}
            <ActionHistoryTable warehouse="catering" view={view} title={title} />
        </div>
    );
};
