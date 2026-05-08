
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { GlassButton, GlassInput, InputModal, GlassCard, ConfirmModal } from './NeumorphicUI';
import { dbService } from '../services/storage';
import { transportService } from '../firebase';
import { StockMovement, WarehouseType, Product, AppSettings, MiniaItem, OperationStatus, TransportRecord } from '../types';
import { 
    Save, Search, CheckCircle, X, Trash2, Edit2,
    History as HistoryIcon, Hash, UserCog, Building2, Layers, 
    Warehouse, Truck, Calendar, Clock, Package, 
    ChevronLeft, User as UserIcon, Settings2, Wrench, 
    Timer, Gauge, ClipboardCheck, Tag, Briefcase, 
    Activity, RotateCcw, AlertCircle, MapPin, 
    ArrowRightLeft, FileText, Printer, FileDown, CheckCircle2,
    PlusCircle, Plus, FileUp, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type, ChevronDown, RotateCcw as ResetIcon,
    ArrowUpRight, ArrowDownLeft, ClipboardSignature, ShoppingCart, UserPlus, Phone, Scale, MinusCircle, Car, Users
} from 'lucide-react';
import { ReportActionsBar } from './ReportActionsBar';
import { printService } from '../services/printing';
import * as XLSX from 'xlsx';
import { smartReadSheet } from '../utils/excelProcessor';
import { processInventoryExcel, processSalesExcel, normalizeArabic } from '../utils/excelProcessor';
import { excelService } from '../services/excelExport';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontSize: '14px',
    fontWeight: '700',
    textAlign: 'center' as const
};

const inputClasses = "w-full px-2 py-1 border border-slate-300 rounded-md text-[13px] bg-white outline-none focus:border-blue-500 font-bold shadow-sm h-9 transition-all";
const labelClasses = "text-[10px] font-black text-slate-600 mb-0.5 flex items-center gap-1 uppercase pr-1 tracking-tight";

const Field: React.FC<{ label: string, icon: React.ReactNode, children: React.ReactNode }> = ({ label, icon, children }) => (
    <div className="flex flex-col gap-1 w-full text-right">
        <label className={labelClasses}>{icon} {label}</label>
        {children}
    </div>
);

const ExcelRibbon = () => (
    <div className="bg-[#f3f4f6] border border-slate-300 rounded-t-xl p-1 flex items-center gap-1 overflow-x-auto no-print shadow-sm" dir="ltr">
        <div className="flex items-center gap-1 border-r border-slate-300 pr-2 mr-1">
            <div className="bg-white border border-slate-300 rounded px-2 py-0.5 flex items-center gap-2 text-[10px] font-bold w-24 justify-between">Calibri <ChevronDown size={10}/></div>
            <div className="bg-white border border-slate-300 rounded px-2 py-0.5 flex items-center gap-2 text-[10px] font-bold w-10 justify-between">12 <ChevronDown size={10}/></div>
        </div>
        <div className="flex items-center gap-0.5 border-r border-slate-300 pr-2 mr-1">
            <button className="p-1 hover:bg-slate-200 rounded border border-slate-300 bg-white shadow-sm"><Bold size={12}/></button>
            <button className="p-1 hover:bg-slate-200 rounded border border-slate-300 bg-white shadow-sm"><Italic size={12}/></button>
            <button className="p-1 hover:bg-slate-200 rounded border border-slate-300 bg-white shadow-sm"><Underline size={12}/></button>
        </div>
    </div>
);

const ActionHistoryTable: React.FC<{ 
    warehouse: WarehouseType, 
    mode: string, 
    title: string,
    refreshTrigger?: number 
}> = ({ warehouse, mode, title, refreshTrigger: externalTrigger = 0 }) => {
    const { refreshProducts, user } = useApp();
    const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id: string }>({ isOpen: false, id: '' });

    const movements = useMemo(() => {
        return dbService.getMovements()
            .filter(m => m.warehouse === warehouse)
            .filter(m => {
                if (mode === 'transfer_in') return m.type === 'transfer' && m.reason?.includes('إضافة');
                if (mode === 'transfer_out') return m.type === 'transfer' && m.reason?.includes('خصم');
                if (mode === 'adj_in') return m.type === 'adjustment' && !m.reason?.includes('خصم');
                if (mode === 'adj_out') return m.type === 'adjustment' && m.reason?.includes('خصم');
                if (mode === 'return') return m.type === 'return' || (m.type === 'in' && m.reason?.includes('مرتجع'));
                if (mode === 'in') return m.type === 'in' && !m.reason?.includes('مرتجع');
                if (mode === 'out') return m.type === 'out';
                if (mode === 'adjustment') return m.type === 'adjustment';
                if (mode === 'unfinished') return m.customFields?.entryMode === 'unfinished';
                return true;
            })
            .reverse();
    }, [warehouse, mode, localRefreshTrigger, externalTrigger]);

    const handleDelete = () => {
        if (!deleteModal.id) return;
        dbService.deleteMovement(deleteModal.id);
        refreshProducts();
        setLocalRefreshTrigger(p => p + 1);
        setDeleteModal({ isOpen: false, id: '' });
        alert('تم حذف المستند بنجاح وتحديث الأرصدة.');
    };

    const isSparePartsIssue = warehouse === 'parts' && mode === 'out' && user?.selectedWarehouse !== 'minia';
    const isMinia = user?.selectedWarehouse === 'minia';

    return (
        <div className="mt-8 space-y-3 animate-fade-in no-print">
            <ConfirmModal 
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: '' })}
                onConfirm={handleDelete}
                title="حذف مستند"
                message="هل أنت متأكد من حذف هذا المستند نهائياً؟"
                confirmText="حذف"
                cancelText="إلغاء"
            />
            <div className="flex items-center gap-2 px-2 text-slate-800">
                <HistoryIcon size={18} className="text-blue-600"/>
                <h3 className="text-[14px] font-black font-cairo">السجل التاريخي لعمليات ({title})</h3>
            </div>
            <div className="bg-white rounded-xl shadow-premium border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-center border-collapse min-w-[2800px]">
                        <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                            {isSparePartsIssue ? (
                                <tr className="h-11 text-[10px] font-black uppercase">
                                    <th className="p-2 border-l border-slate-700 w-12">م</th>
                                    <th className="p-2 border-l border-slate-700">التاريخ</th>
                                    <th className="p-2 border-l border-slate-700">رقم طلب الصرف</th>
                                    <th className="p-2 border-l border-slate-700">كود الصنف</th>
                                    <th className="p-2 border-l border-slate-700 text-right pr-4">اسم الصنف</th>
                                    <th className="p-2 border-l border-slate-700">الوحدة</th>
                                    <th className="p-2 border-l border-slate-700 bg-blue-900/30">صب</th>
                                    <th className="p-2 border-l border-slate-700 bg-indigo-900/30">معبأ</th>
                                    <th className="p-2 border-l border-slate-700">الكمية</th>
                                    <th className="p-2 border-l border-slate-700">المخزن التابع</th>
                                    <th className="p-2 border-l border-slate-700">الادارة التابع لها</th>
                                    <th className="p-2 border-l border-slate-700">القسم التابع له</th>
                                    <th className="p-2 border-l border-slate-700">أمين المخزن</th>
                                    <th className="p-2 border-l border-slate-700">كود الموظف</th>
                                    <th className="p-2 border-l border-slate-700">اسم المستلم</th>
                                    <th className="p-2 border-l border-slate-700">رقم امر الشغل</th>
                                    <th className="p-2 border-l border-slate-700">كود المعدة</th>
                                    <th className="p-2 border-l border-slate-700">حالة الصرف</th>
                                    <th className="p-2 border-l border-slate-700">موقف القطع القديمة</th>
                                    <th className="p-2 border-l border-slate-700">رقم العداد</th>
                                    <th className="p-2 border-l border-slate-700">الوردية</th>
                                    <th className="p-2 border-l border-slate-700">وقت الدخول</th>
                                    <th className="p-2 border-l border-slate-700">وقت الخروج</th>
                                    <th className="p-2 border-l border-slate-700">الفرق</th>
                                    <th className="p-2 border-l border-slate-700">الرصيد الحالى</th>
                                    <th className="p-2">ملاحظات</th>
                                    <th className="p-2 w-16">إجراء</th>
                                </tr>
                            ) : isMinia ? (
                                <tr className="h-11 text-[11px] font-black uppercase">
                                    <th className="p-2 border-l border-slate-700 w-12">م</th>
                                    <th className="p-2 border-l border-slate-700">التاريخ</th>
                                    <th className="p-2 border-l border-slate-700">رقم الإذن</th>
                                    <th className="p-2 border-l border-slate-700 text-right pr-4">اسم الصنف</th>
                                    <th className="p-2 border-l border-slate-700">الوحدة</th>
                                    <th className="p-2 border-l border-slate-700">الكمية</th>
                                    <th className="p-2 border-l border-slate-700 bg-blue-900/30">صب</th>
                                    <th className="p-2 border-l border-slate-700 bg-indigo-900/30">معبأ</th>
                                    <th className="p-2 border-l border-slate-700">المورد/العميل</th>
                                    <th className="p-2 border-l border-slate-700">رقم السيارة</th>
                                    <th className="p-2 border-l border-slate-700">الوردية</th>
                                    <th className="p-2 border-l border-slate-700">أمين المخزن</th>
                                    <th className="p-2 border-l border-slate-700">الرصيد اللحظي</th>
                                    <th className="p-2 w-16">إجراء</th>
                                </tr>
                            ) : (
                                <tr className="h-11 text-[11px] font-black uppercase">
                                    <th className="p-2 border-l border-slate-700 w-12">م</th>
                                    <th className="p-2 border-l border-slate-700">التاريخ</th>
                                    <th className="p-2 border-l border-slate-700">رقم الإذن</th>
                                    <th className="p-2 border-l border-slate-700 text-right pr-4">اسم الصنف</th>
                                    <th className="p-2 border-l border-slate-700 bg-blue-900/30">صب</th>
                                    <th className="p-2 border-l border-slate-700 bg-indigo-900/30">معبأ</th>
                                    <th className="p-2 border-l border-slate-700">الكمية الإجمالية</th>
                                    <th className="p-2 border-l border-slate-700">الوحدة</th>
                                    <th className="p-2 border-l border-slate-700 text-right pr-4">البيان / السبب</th>
                                    <th className="p-2 border-l border-slate-700">المستخدم</th>
                                    <th className="p-2 border-l border-slate-700">الرصيد اللحظي</th>
                                    <th className="p-2 w-24">إجراء</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="text-[12px] font-bold text-slate-700">
                            {movements.flatMap((m, mIdx) => m.items.map((item, iIdx) => (
                                <tr key={`${m.id}-${iIdx}`} className="border-b hover:bg-blue-50 h-10 transition-colors">
                                    <td className="p-2 border-l" style={forceEnNumsStyle}>{mIdx + 1}</td>
                                    <td className="p-2 border-l" style={forceEnNumsStyle}>{new Date(m.date).toLocaleDateString('en-GB')}</td>
                                    <td className="p-2 border-l font-mono text-indigo-700">{m.refNumber}</td>
                                    {isSparePartsIssue ? (
                                        <>
                                            <td className="p-2 border-l font-mono text-xs">{item.productCode}</td>
                                            <td className="p-2 border-l text-right pr-4 font-black text-slate-900">{item.productName}</td>
                                            <td className="p-2 border-l text-slate-400">{item.unit}</td>
                                            <td className="p-2 border-l text-blue-600 font-black" style={forceEnNumsStyle}>{item.quantityBulk || '-'}</td>
                                            <td className="p-2 border-l text-indigo-600 font-black" style={forceEnNumsStyle}>{item.quantityPacked || '-'}</td>
                                            <td className="p-2 border-l text-blue-800 font-black text-sm" style={forceEnNumsStyle}>{item.quantity}</td>
                                            <td className="p-2 border-l text-xs">{m.customFields?.subWarehouse || '-'}</td>
                                            <td className="p-2 border-l text-xs">{m.customFields?.department || '-'}</td>
                                            <td className="p-2 border-l text-xs">{m.customFields?.section || '-'}</td>
                                            <td className="p-2 border-l text-xs">{m.user}</td>
                                            <td className="p-2 border font-mono text-xs" style={forceEnNumsStyle}>{m.customFields?.employeeCode || '-'}</td>
                                            <td className="p-2 border-l text-xs font-bold">{m.reason || '-'}</td>
                                            <td className="p-2 border-l font-mono text-xs" style={forceEnNumsStyle}>{m.customFields?.workOrderNo || '-'}</td>
                                            <td className="p-2 border-l font-mono text-xs" style={forceEnNumsStyle}>{m.customFields?.equipmentCode || '-'}</td>
                                            <td className="p-2 border text-xs">{m.customFields?.issueStatus || '-'}</td>
                                            <td className="p-2 border text-xs">{m.customFields?.oldPartsStatus || '-'}</td>
                                            <td className="p-2 border-l font-mono text-xs" style={forceEnNumsStyle}>{m.customFields?.meterReading || '-'}</td>
                                            <td className="p-2 border-l text-xs">{m.customFields?.shift || '-'}</td>
                                            <td className="p-2 border-l font-mono text-xs" style={forceEnNumsStyle}>{m.customFields?.entryTime || '-'}</td>
                                            <td className="p-2 border-l font-mono text-xs" style={forceEnNumsStyle}>{m.customFields?.exitTime || '-'}</td>
                                            <td className="p-2 border-l font-mono text-xs text-indigo-600" style={forceEnNumsStyle}>{m.customFields?.timeDiff || '-'}</td>
                                            <td className="p-2 border-l bg-slate-50 font-black text-blue-900" style={forceEnNumsStyle}>{item.currentBalance?.toFixed(2)}</td>
                                            <td className="p-2 border-l text-xs italic text-slate-400">{m.customFields?.notes || '-'}</td>
                                        </>
                                    ) : isMinia ? (
                                        <>
                                            <td className="p-2 border-l text-right pr-4 font-black text-slate-900">{item.productName}</td>
                                            <td className="p-2 border-l text-slate-400">{item.unit}</td>
                                            <td className="p-2 border-l text-blue-800 font-black text-sm" style={forceEnNumsStyle}>{item.quantity}</td>
                                            <td className="p-2 border-l text-blue-600 font-bold" style={forceEnNumsStyle}>{item.quantityBulk || '-'}</td>
                                            <td className="p-2 border-l text-indigo-600 font-bold" style={forceEnNumsStyle}>{item.quantityPacked || '-'}</td>
                                            <td className="p-2 border-l font-bold">
                                        {typeof (m.customFields?.supplierName || m.customFields?.recipientName) === 'object' 
                                            ? ((m.customFields?.supplierName || m.customFields?.recipientName) as any).name 
                                            : (m.customFields?.supplierName || m.customFields?.recipientName || m.reason || '-')}
                                    </td>
                                            <td className="p-2 border-l font-mono text-xs" style={forceEnNumsStyle}>{m.customFields?.carNumber || '-'}</td>
                                            <td className="p-2 border-l text-xs">{m.customFields?.shift || '-'}</td>
                                            <td className="p-2 border-l text-xs text-gray-500">{m.customFields?.storekeeper || m.user}</td>
                                            <td className="p-2 border-l bg-slate-50 font-black" style={forceEnNumsStyle}>{item.currentBalance?.toFixed(2)}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-2 border-l text-right pr-4 font-black text-slate-900">{item.productName}</td>
                                            <td className="p-2 border-l text-blue-600 font-bold" style={forceEnNumsStyle}>{item.quantityBulk || '-'}</td>
                                            <td className="p-2 border-l text-indigo-600 font-bold" style={forceEnNumsStyle}>{item.quantityPacked || '-'}</td>
                                            <td className="p-2 border-l text-blue-800 font-black text-sm" style={forceEnNumsStyle}>{item.quantity}</td>
                                            <td className="p-2 border-l text-slate-400">{item.unit}</td>
                                            <td className="p-2 border-l text-right pr-4">{m.reason || '-'}</td>
                                            <td className="p-2 border-l">{m.user}</td>
                                            <td className="p-2 border-l bg-slate-50 font-black" style={forceEnNumsStyle}>{item.currentBalance?.toFixed(2)}</td>
                                        </>
                                    )}
                                    <td className="p-2 flex justify-center">
                                        <button onClick={() => setDeleteModal({ isOpen: true, id: m.id })} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-all"><Trash2 size={14}/></button>
                                    </td>
                                </tr>
                            )))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const StockEntryForm: React.FC<{ 
    warehouse: WarehouseType, 
    mode: 'in' | 'out' | 'adjustment' | 'return' | 'unfinished' | 'transfer_in' | 'transfer_out' | 'adj_in' | 'adj_out' | 'receipt_non_bulk', 
    label: string, 
    onSuccess: () => void 
}> = ({ warehouse, mode, label, onSuccess }) => {
    const { products, refreshProducts, user, settings, updateSettings, addNotification } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [draftItems, setDraftItems] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(true);
    const [qtyValue, setQtyValue] = useState<string>('');
    const [qtyBulk, setQtyBulk] = useState<string>('');
    const [qtyPacked, setQtyPacked] = useState<string>('');
    const [productionDate, setProductionDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
    
    // حالة نوع التسوية (زيادة أو عجز)
    const [adjSubType, setAdjSubType] = useState<'plus' | 'minus'>('plus');

    const voucherType = (mode === 'in' || mode === 'return' || mode === 'transfer_in' || mode === 'adj_in' || (mode === 'adjustment' && adjSubType === 'plus')) ? 'receiveVoucher' : 'issueVoucher';
    
    const INITIAL_HEADER = {
        date: new Date().toISOString().split('T')[0],
        refNumber: dbService.peekNextId(voucherType),
        subWarehouse: warehouse === 'parts' ? (user?.selectedWarehouse === 'minia' ? 'مخزن الخامات' : 'قطع الغيار الرئيسية') : (warehouse === 'raw' ? 'مخزن الخامات' : 'المخزن الرئيسي'),
        goodsGroup: user?.selectedWarehouse === 'minia' ? 'خامات (ذرة/صويا/كسب)' : 'قطع غيار ومهمات',
        storekeeper: user?.name || '',
        settlementReason: '', housingOfficer: '', recipientName: '', receiverWarehouse: '', supplierName: '',
        notes: '', department: '', section: '', employeeCode: '', workOrderNo: '', equipmentCode: '',
        meterReading: '', shift: 'الأولى', issueStatus: mode.includes('in') ? 'توريد عادي' : 'صرف عادي',
        oldPartsStatus: 'لم يتم الاستلام', entryTime: '', exitTime: '', paperVoucher: '',
        carNumber: '', transportMethod: '', carType: '', receiptType: 'غير صب'
    };

    const [header, setHeader] = useState(INITIAL_HEADER);
    const [inputModal, setInputModal] = useState<{isOpen: boolean, listKey: keyof AppSettings | null, title: string}>({
        isOpen: false, listKey: null, title: ''
    });

    const isSparePartsIssue = warehouse === 'parts' && mode === 'out' && user?.selectedWarehouse !== 'minia';

    const calculatedTimeDiff = useMemo(() => {
        if (!header.entryTime || !header.exitTime) return '00:00';
        const [h1, m1] = header.entryTime.split(':').map(Number);
        const [h2, m2] = header.exitTime.split(':').map(Number);
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60;
        return `${Math.floor(diff / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`;
    }, [header.entryTime, header.exitTime]);

    const filteredProducts = useMemo(() => {
        const term = (searchTerm || '').toString().trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[\u064B-\u0652]/g, ''); 
        if (!term || selectedProduct) return [];
        
        if (user?.selectedWarehouse === 'minia' && settings.miniaItems) {
            return (settings.miniaItems as any[]).filter(p => 
                (p.name || '').toLowerCase().includes(term) || 
                (p.code || '').includes(term)
            ).map(p => ({
                id: p.id || p.code,
                name: p.name,
                barcode: p.code,
                stock: 0,
                unit: p.unit || 'طن',
                warehouse: warehouse
            })).slice(0, 50);
        }

        return products.filter(p => p.warehouse === warehouse && (p.name.toLowerCase().includes(term) || p.barcode.includes(term))).slice(0, 50);
    }, [products, searchTerm, selectedProduct, warehouse, user?.selectedWarehouse, settings.miniaItems]);

    const [showBulkImport, setShowBulkImport] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const bulkFileInputRef = useRef<HTMLInputElement>(null);

    const handlePasteImport = () => {
        if (!pasteData.trim()) return;
        const lines = pasteData.trim().split('\n');
        if (lines.length === 0) return;

        const firstLine = lines[0].split('\t');
        const hasHeaders = firstLine.some(cell => 
            normalizeArabic(cell).includes('صنف') || 
            normalizeArabic(cell).includes('الاسم') || 
            normalizeArabic(cell).includes('اسم') ||
            normalizeArabic(cell).includes('كود')
        );

        let headers: string[] = [];
        let dataLines: string[] = [];

        if (hasHeaders) {
            headers = firstLine.map(h => h.trim());
            dataLines = lines.slice(1);
        } else {
            headers = firstLine.map((_, i) => `Column_${i}`);
            dataLines = lines;
        }

        const rawObjects = dataLines.map(line => {
            const cells = line.split('\t');
            const obj: any = {};
            headers.forEach((h, i) => {
                obj[h] = cells[i] || '';
            });
            return obj;
        });

        const processedRows = processSalesExcel(rawObjects);
        const newItems: any[] = [];
        let matchedCount = 0;

        processedRows.forEach((item: any) => {
            const nameOrCode = String(item.goodsType || item.name || item.jdeCode || "").trim();
            const bulk = Number(item.bulkWeight || 0);
            const packed = Number(item.packedWeight || 0);
            const qty = Number(item.weight || item.quantity || (bulk + packed) || 0);

            if (!nameOrCode) return;

            const prod = products.find(p => p.warehouse === warehouse && (
                (p.name || "").trim() === nameOrCode || 
                (p.barcode || "").trim() === nameOrCode ||
                (p.name || "").trim().includes(nameOrCode)
            ));

            if (prod) {
                newItems.push({
                    productId: prod.id, productName: prod.name, productCode: prod.barcode,
                    quantity: qty || (bulk + packed), quantityBulk: bulk, quantityPacked: packed,
                    productionDate: warehouse === 'finished' ? productionDate : undefined,
                    unit: prod.unit || 'عدد', currentBalance: prod.stock || 0, ...header
                });
                matchedCount++;
            }
        });

        if (newItems.length > 0) {
            setDraftItems(prev => [...prev, ...newItems]);
            setPasteData('');
            setShowBulkImport(false);
            addNotification(`تم استيراد ${matchedCount} أصناف بنجاح بذكاء`, 'success');
        } else if (matchedCount > 0) {
             addNotification('تم العثور على أصناف موجودة بالفعل', 'info');
             setShowBulkImport(false);
        } else {
            alert('لم يتم العثور على أصناف مطابقة.');
        }
    };

    const handleExcelImportBulk = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawData = smartReadSheet(worksheet);

                if (rawData.length === 0) return alert('الملف المختار فارغ أو غير صالح.');

                const processedRows = processSalesExcel(rawData);
                const newItems: any[] = [];
                let matchedCount = 0;

                processedRows.forEach((item: any) => {
                    const nameOrCode = String(item.goodsType || item.name || item.jdeCode || "").trim();
                    const bulk = Number(item.bulkWeight || 0);
                    const packed = Number(item.packedWeight || 0);
                    const qty = Number(item.weight || item.quantity || (bulk + packed) || 0);

                    if (!nameOrCode) return;

                    const prod = products.find(p => p.warehouse === warehouse && (
                        (p.name || "").trim() === nameOrCode || 
                        (p.barcode || "").trim() === nameOrCode ||
                        (p.name || "").trim().includes(nameOrCode)
                    ));

                    if (prod) {
                        newItems.push({
                            productId: prod.id, productName: prod.name, productCode: prod.barcode,
                            quantity: qty || (bulk + packed), quantityBulk: bulk, quantityPacked: packed,
                            productionDate: warehouse === 'finished' ? productionDate : undefined,
                            unit: prod.unit || 'عدد', currentBalance: prod.stock || 0, ...header
                        });
                        matchedCount++;
                    }
                });

                if (newItems.length > 0) {
                    setDraftItems(prev => [...prev, ...newItems]);
                    setShowBulkImport(false);
                    addNotification(`تم استيراد ${matchedCount} صنف بذكاء من Excel بنجاح`, 'success');
                } else if (matchedCount > 0) {
                    addNotification('تم العثور على أصناف موجودة بالفعل', 'info');
                    setShowBulkImport(false);
                } else {
                    alert('لم يتم العثور على أصناف مطابقة في ملف Excel.');
                }
            } catch (err) {
                console.error(err);
                alert('خطأ في معالجة ملف Excel');
            }
            if (e.target) e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const handleAddToDraft = () => {
        if (!selectedProduct) return alert('يرجى اختيار صنف أولاً');
        const isMinia = user?.selectedWarehouse === 'minia';
        let finalBulk = Number(qtyBulk) || 0;
        let finalPacked = Number(qtyPacked) || 0;
        let finalQty = 0;

        if (warehouse === 'finished' || warehouse === 'raw') {
            finalQty = finalBulk + finalPacked;
        } else if (isMinia && (mode === 'receipt' || mode === 'out' || mode.includes('in') || mode.includes('adj'))) {
            finalQty = Number(qtyValue) || 0;
            const rType = (header as any).receiptType;
            if (rType === 'صــب') {
                finalBulk = finalQty;
                finalPacked = 0;
            } else {
                finalPacked = finalQty;
                finalBulk = 0;
            }
        } else {
            finalQty = Number(qtyValue);
        }

        if (finalQty <= 0) return alert('يرجى إدخل كمية صحيحة');

        const newItem = {
            productId: selectedProduct.id, productName: selectedProduct.name, productCode: selectedProduct.barcode,
            quantity: finalQty, quantityBulk: finalBulk, quantityPacked: finalPacked,
            productionDate: warehouse === 'finished' ? productionDate : undefined,
            unit: selectedProduct.unit || 'عدد', currentBalance: selectedProduct.stock || 0, notes: header.notes, ...header
        };

        setDraftItems(prev => [...prev, newItem]);
        setSelectedProduct(null); setSearchTerm(''); setQtyValue(''); setQtyBulk(''); setQtyPacked('');
    };

    const handleFinalSubmit = () => {
        if (draftItems.length === 0) return alert('يرجى إضافة أصناف للجدول أولاً');
        const realRef = header.refNumber || dbService.getNextId(voucherType);
        
        let moveType: any = mode.includes('in') ? 'in' : 'out';
        if (mode.includes('adj')) moveType = 'adjustment';
        if (mode.includes('transfer')) moveType = 'transfer';
        if (mode === 'return') moveType = 'return';
        
        // ضبط مسمى السبب ليكون متوافقاً مع محرك التقارير
        let finalReason = header.recipientName || header.supplierName || label;
        if (mode === 'adjustment') {
            finalReason = adjSubType === 'plus' ? 'تسوية بالزيادة (+)' : 'تسوية بالعجز (-)';
        }

        const movement: StockMovement = {
            id: Date.now().toString(),
            date: new Date(header.date).toISOString(),
            type: moveType, warehouse: warehouse, refNumber: realRef, user: header.storekeeper || user?.name || 'admin',
            reason: finalReason,
            items: draftItems.map(item => ({ ...item, currentBalance: 0 })),
            customFields: { ...header, timeDiff: calculatedTimeDiff, refNumber: realRef, entryMode: mode, adjType: adjSubType }
        };

        dbService.saveMovement(movement);

        // إذا كان استلام خامات في المنيا، نرسلها لسجلات النقل لتظهر في تقرير دمياط
        if (user?.selectedWarehouse === 'minia') {
            const isReceipt = mode === 'receipt' || mode.includes('in');
            const isIssue = mode === 'out';
            
            if (isReceipt || isIssue) {
                draftItems.forEach(async (item) => {
                    let trType = '';
                    if (isReceipt) {
                        trType = (header as any).receiptType === 'صــب' ? 'استلام خامات صب' : 'استلام خامات غير صب';
                    } else {
                        // الافتراضي في الصرف هو غير صب (صرف موقع) إلا لو كان حركة خامات صب
                        trType = (header as any).receiptType === 'صــب' ? 'حركة خامات صب' : 'صرف خامات الموقع'; 
                    }

                    const tr: TransportRecord = {
                        autoId: `${mode === 'out' ? 'ISS' : 'REC'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        date: header.date,
                        departureTime: new Date().toLocaleTimeString('ar-EG', { hour12: false }),
                        goodsType: item.productName,
                        itemCode: item.productCode,
                        weight: item.quantity,
                        quantityBulk: item.quantityBulk,
                        quantityPacked: item.quantityPacked,
                        status: OperationStatus.DONE,
                        carNumber: header.carNumber || '---',
                        transportMethod: (header.transportMethod as string) || '---',
                        carType: (header.carType as string) || '---',
                        shift: header.shift || 'الأولى',
                        driverName: header.recipientName || header.supplierName || '---',
                        driverPhone: '---',
                        orderNo: realRef,
                        unloadingSite: isReceipt ? 'مخازن المنيا' : (header.recipientName || '---'),
                        loadingSite: isReceipt ? (header.supplierName || 'دمياط') : 'مخازن المنيا',
                        notes: `${trType}: ${header.notes || ''}`,
                        contractorName: '---',
                        waybillNo: realRef,
                        expenditureType: trType,
                        port: 'دمياط'
                    };
                    await transportService.addRecord(tr, true);
                });
            }
        }

        refreshProducts();
        setDraftItems([]);
        setHeader({...INITIAL_HEADER, refNumber: dbService.peekNextId(voucherType)});
        setHistoryRefreshKey(prev => prev + 1);
        addNotification(`تم ترحيل مستند ${label} بنجاح رقم: ${realRef}`, 'success');
    };

    const renderDropdown = (label: string, field: keyof typeof header, listKey: keyof AppSettings, icon: React.ReactNode) => (
        <div className="flex flex-col gap-0.5">
            <label className={labelClasses}>{icon} {label}</label>
            <div className="flex gap-0.5">
                <select className={`${inputClasses} flex-1`} value={header[field] as string} onChange={e => setHeader({...header, [field]: e.target.value})}>
                    <option value="">-- اختر --</option>
                    {(settings[listKey] as any[])?.map(item => {
                        const val = typeof item === 'object' ? (item.name || item.id || String(item)) : String(item);
                        const label = typeof item === 'object' ? (item.name || item.label || String(item)) : String(item);
                        return <option key={val} value={val}>{label}</option>;
                    })}
                </select>
                <button onClick={() => setInputModal({ isOpen: true, listKey, title: `إضافة ${label} جديد` })} className="bg-blue-600 text-white w-9 h-9 rounded-md flex items-center justify-center shadow-sm shrink-0"><Plus size={16}/></button>
            </div>
        </div>
    );

    const isDeficit = mode === 'adjustment' && adjSubType === 'minus';
    const themeColor = (mode.includes('out') || isDeficit) ? 'bg-[#f4511e]' : 'bg-[#059669]';

    return (
        <div className="space-y-0 animate-fade-in" dir="rtl">
            <ExcelRibbon />
            <InputModal 
                isOpen={inputModal.isOpen} onClose={() => setInputModal({ isOpen: false, listKey: null, title: '' })} 
                onSave={(result) => { 
                    if(inputModal.listKey) {
                        const finalValue = Array.isArray(result) ? result : [...(settings[inputModal.listKey] as any[] || []), result];
                        updateSettings({...settings, [inputModal.listKey]: finalValue}); 
                    }
                }}
                title={inputModal.title}
                list={inputModal.listKey ? (settings[inputModal.listKey] as string[]) : []}
            />

            {isOpen && (
                <div className="bg-[#f3f4f6]/70 border-x border-b border-slate-300 shadow-2xl no-print relative overflow-visible rounded-b-xl mb-4 p-4 space-y-4">
                    <div className={`${themeColor} px-4 py-2.5 text-white flex justify-between items-center shadow-lg rounded-t-xl transition-colors duration-500`}>
                        <h3 className="text-[15px] font-black font-cairo flex items-center gap-2">
                           <Scale size={18}/> نافذة إدخال بيانات: {label} {mode === 'adjustment' && `(${adjSubType === 'plus' ? 'زيادة +' : 'عجز -'})`}
                        </h3>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 px-3 py-1 rounded-lg transition-all border border-white/30 text-[12px] font-bold">إخفاء الإدخال <X size={16} className="inline"/></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {/* خيار نوع التسوية المضاف حديثاً */}
                        {mode === 'adjustment' && (
                            <div className="md:col-span-2 flex flex-col gap-1">
                                <label className={labelClasses}><Scale size={13}/> تحديد نوع التسوية الجردية</label>
                                <div className="flex bg-white rounded-lg p-1 border border-slate-300 h-9">
                                    <button 
                                        onClick={() => setAdjSubType('plus')}
                                        className={`flex-1 flex items-center justify-center gap-2 rounded-md font-black text-xs transition-all ${adjSubType === 'plus' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                                    >
                                        <PlusCircle size={14}/> تسوية بالزيادة (+)
                                    </button>
                                    <button 
                                        onClick={() => setAdjSubType('minus')}
                                        className={`flex-1 flex items-center justify-center gap-2 rounded-md font-black text-xs transition-all ${adjSubType === 'minus' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                                    >
                                        <MinusCircle size={14}/> تسوية بالعجز (-)
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <Field label="التاريخ" icon={<Calendar size={13}/>}><input type="date" value={header.date ?? ''} onChange={e => setHeader({...header, date: e.target.value})} className={inputClasses} style={forceEnNumsStyle}/></Field>
                        <Field label="رقم الإذن" icon={<Hash size={13}/>}><input value={header.refNumber ?? ''} readOnly className={`${inputClasses} bg-slate-100`} /></Field>
                        
                        {isSparePartsIssue && (
                             <>
                                {renderDropdown("المخزن التابع", "subWarehouse", "partsSubWarehouses" as any, <Warehouse size={13}/>)}
                                {renderDropdown("الادارة التابع لها", "department", "departments" as any, <Building2 size={13}/>)}
                                <Field label="القسم التابع له" icon={<Layers size={13}/>}><input className={inputClasses} value={header.section ?? ''} onChange={e => setHeader({...header, section: e.target.value})} /></Field>
                                {renderDropdown("أمين المخزن", "storekeeper", "storekeepersParts" as any, <UserCog size={13}/>)}
                                <Field label="كود الموظف" icon={<Hash size={13}/>}><input className={inputClasses} value={header.employeeCode ?? ''} onChange={e => setHeader({...header, employeeCode: e.target.value})} style={forceEnNumsStyle}/></Field>
                                <Field label="اسم المستلم" icon={<UserIcon size={13}/>}><input className={inputClasses} value={header.recipientName ?? ''} onChange={e => setHeader({...header, recipientName: e.target.value})} /></Field>
                                <Field label="رقم امر الشغل" icon={<Wrench size={13}/>}><input className={inputClasses} value={header.workOrderNo ?? ''} onChange={e => setHeader({...header, workOrderNo: e.target.value})} /></Field>
                                <Field label="كود المعدة" icon={<Settings2 size={13}/>}><input className={inputClasses} value={header.equipmentCode ?? ''} onChange={e => setHeader({...header, equipmentCode: e.target.value})} /></Field>
                                {renderDropdown("حالة الصرف", "issueStatus", "partsIssueTypes" as any, <CheckCircle2 size={13}/>)}
                                {renderDropdown("موقف القطع القديمة", "oldPartsStatus", "partsOldPartsStatuses" as any, <HistoryIcon size={13}/>)}
                                <Field label="رقم العداد" icon={<Gauge size={13}/>}><input className={inputClasses} value={header.meterReading ?? ''} onChange={e => setHeader({...header, meterReading: e.target.value})} style={forceEnNumsStyle}/></Field>
                                <Field label="الوردية" icon={<Clock size={13}/>}><select className={inputClasses} value={header.shift ?? ''} onChange={e => setHeader({...header, shift: e.target.value})}>{settings.shifts?.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
                                <Field label="وقت الدخول" icon={<Timer size={13}/>}><input type="time" className={inputClasses} value={header.entryTime ?? ''} onChange={e => setHeader({...header, entryTime: e.target.value})} style={forceEnNumsStyle}/></Field>
                                <Field label="وقت الخروج" icon={<Timer size={13}/>}><input type="time" className={inputClasses} value={header.exitTime ?? ''} onChange={e => setHeader({...header, exitTime: e.target.value})} style={forceEnNumsStyle}/></Field>
                                <Field label="الفرق" icon={<Activity size={13}/>}><input value={calculatedTimeDiff ?? '00:00'} readOnly className={`${inputClasses} bg-blue-50 text-blue-700 text-center font-black`} style={forceEnNumsStyle}/></Field>
                             </>
                        )}
                        {!isSparePartsIssue && user?.selectedWarehouse === 'minia' && (
                             <>
                                {((mode === 'receipt' || mode.includes('in')) || (user?.selectedWarehouse === 'minia' && mode === 'out')) && (
                                    <Field label={mode === 'out' ? "نوع الصرف" : "نوع الاستلام"} icon={<Layers size={13}/>}>
                                        <div className="flex gap-2">
                                            {['صــب', 'غير صب'].map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setHeader({...header, receiptType: type} as any)}
                                                    className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${
                                                        (header as any).receiptType === type 
                                                        ? 'bg-blue-600 text-white shadow-lg scale-105' 
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </Field>
                                )}
                                {renderDropdown("اسم المورد", "supplierName", "vendors" as any, <UserIcon size={13}/>)}
                                {renderDropdown("اسم العميل", "recipientName", "clients" as any, <Users size={13}/>)}
                                {renderDropdown("طريقة النقل", "transportMethod" as any, "transportMethods" as any, <Truck size={13}/>)}
                                {renderDropdown("نوع السيارة", "carType" as any, "carTypes" as any, <Car size={13}/>)}
                                <Field label="رقم السيارة" icon={<Hash size={13}/>}><input className={inputClasses} value={(header as any).carNumber ?? ''} onChange={e => setHeader({...header, carNumber: e.target.value} as any)} /></Field>
                             </>
                        )}
                        {!isSparePartsIssue && (
                            <>
                                <Field label="الوردية" icon={<Clock size={13}/>}><select className={inputClasses} value={header.shift ?? ''} onChange={e => setHeader({...header, shift: e.target.value})}>{settings.shifts?.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
                                {user?.selectedWarehouse !== 'minia' && renderDropdown("أمين المخزن", "storekeeper", (warehouse === 'raw' ? 'storekeepersRaw' : (warehouse === 'parts' ? 'storekeepersParts' : 'storekeepersFinished')) as any, <UserCog size={13}/>)}
                                {user?.selectedWarehouse !== 'minia' && (warehouse === 'finished' || warehouse === 'raw') && mode.includes('in') && (
                                    <Field label="مصنع الإنتاج / المورد" icon={<Building2 size={13}/>}>
                                        <select className={inputClasses} value={header.supplierName ?? ''} onChange={e => setHeader({...header, supplierName: e.target.value})}>
                                            <option value="">-- اختر --</option>
                                            <option value="دماص">دماص</option>
                                            <option value="السادات">السادات</option>
                                            <option value="المنيا">المنيا</option>
                                        </select>
                                    </Field>
                                )}
                            </>
                        )}
                        <Field label="ملاحظات" icon={<FileText size={13}/>}><input className={inputClasses} value={header.notes ?? ''} onChange={e => setHeader({...header, notes: e.target.value})} /></Field>
                    </div>

                    <div className="bg-[#0f172a] rounded-xl p-4 flex flex-col md:flex-row items-end gap-4 shadow-2xl relative z-[300]">
                        <div className="flex-1 relative w-full">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase mr-4">البحث عن صنف</label>
                                <button 
                                    onClick={() => setShowBulkImport(!showBulkImport)} 
                                    className="text-[10px] font-black text-blue-400 hover:text-blue-300 underline uppercase flex items-center gap-1"
                                >
                                    {showBulkImport ? <X size={10}/> : <FileUp size={10}/>}
                                    {showBulkImport ? 'إلغاء الاستيراد' : 'استيراد جماعي (Excel / Paste)'}
                                </button>
                            </div>
                            {showBulkImport ? (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <textarea 
                                        className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white outline-none font-bold text-xs h-24"
                                        placeholder="انسخ البيانات من Excel هنا (العمود الأول: الاسم/الكود، الثاني: صب، الثالث: معبأ)..."
                                        value={pasteData}
                                        onChange={e => setPasteData(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handlePasteImport}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-xs shadow-lg transition-all"
                                        >
                                            <ClipboardSignature size={14} className="inline ml-1"/> تنفيذ الاستيراد من النص
                                        </button>
                                        <button 
                                            onClick={() => bulkFileInputRef.current?.click()}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold text-xs shadow-lg transition-all"
                                        >
                                            <FileDown size={14} className="inline ml-1"/> استيراد من ملف Excel
                                        </button>
                                        <input type="file" ref={bulkFileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleExcelImportBulk} />
                                    </div>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white outline-none font-bold" placeholder="ابحث بكود الصنف أو الاسم..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); if(selectedProduct) setSelectedProduct(null); }} />
                                    {searchTerm && !selectedProduct && (
                                        <div className="absolute top-full left-0 right-0 z-[1000] bg-white border rounded-xl shadow-2xl mt-2 max-h-60 overflow-y-auto p-2">
                                            {filteredProducts.map(p => (
                                                <div key={p.id} onMouseDown={(e) => { e.preventDefault(); setSelectedProduct(p); setSearchTerm(p.name); }} className="p-3 hover:bg-blue-50 cursor-pointer border-b flex justify-between rounded-xl">
                                                    <span className="font-black text-slate-800">{p.name}</span>
                                                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-[11px] font-black">رصيد: {p.stock}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {(warehouse === 'finished' || warehouse === 'raw') ? (
                            <>
                                <div className="w-40"><label className="text-[10px] text-blue-300 mb-1 block text-center uppercase font-black">صب</label><input type="number" className="w-full p-3 rounded-xl bg-slate-800 text-white text-center font-black text-xl border border-slate-600 focus:border-blue-500 shadow-inner h-14" value={qtyBulk ?? ''} onChange={e => setQtyBulk(e.target.value)} placeholder="0" style={forceEnNumsStyle}/></div>
                                <div className="w-40"><label className="text-[10px] text-blue-300 mb-1 block text-center uppercase font-black">معبأ</label><input type="number" className="w-full p-3 rounded-xl bg-slate-800 text-white text-center font-black text-xl border border-slate-600 focus:border-indigo-500 shadow-inner h-14" value={qtyPacked ?? ''} onChange={e => setQtyPacked(e.target.value)} placeholder="0" style={forceEnNumsStyle}/></div>
                            </>
                        ) : (
                            <div className="w-32"><label className="text-[10px] text-blue-300 mb-1 block text-center uppercase font-black">الكمية</label><input type="number" className="w-full p-3 rounded-xl bg-slate-800 text-white text-center font-black text-xl border border-slate-600 shadow-inner h-14" value={qtyValue ?? ''} onChange={e => setQtyValue(e.target.value)} placeholder="0" style={forceEnNumsStyle}/></div>
                        )}
                        <button onClick={handleAddToDraft} className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl shadow-xl h-14 px-8 border-b-4 border-blue-900 transition-all active:scale-95"><Plus size={32}/></button>
                    </div>

                    {draftItems.length > 0 && (
                        <div className="space-y-4 pt-2 animate-fade-in">
                            <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                                <table className="w-full text-center text-[13px] border-collapse bg-white">
                                    <thead className="bg-[#111827] text-slate-300 h-10 font-black">
                                        <tr>
                                            <th className="p-2 border-l border-slate-700 text-right pr-6">الصنف</th>
                                            <th className="p-2 border-l border-slate-700">صب</th>
                                            <th className="p-2 border-l border-slate-700">معبأ</th>
                                            <th className="p-2 border-l border-slate-700">الإجمالي</th>
                                            <th className="p-2">حذف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {draftItems.map((item, idx) => (
                                            <tr key={idx} className="border-b h-10">
                                                <td className="p-2 text-right pr-6 font-black">{item.productName}</td>
                                                <td className="p-2 font-black text-blue-600" style={forceEnNumsStyle}>{item.quantityBulk || '-'}</td>
                                                <td className="p-2 font-black text-indigo-600" style={forceEnNumsStyle}>{item.quantityPacked || '-'}</td>
                                                <td className="p-2 font-black text-blue-700" style={forceEnNumsStyle}>{item.quantity}</td>
                                                <td className="p-2"><button onClick={() => setDraftItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500"><Trash2 size={16}/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button onClick={handleFinalSubmit} className={`w-full py-4 ${themeColor} text-white rounded-xl font-black text-xl shadow-xl border-b-4 border-black/20`}><Save size={24} className="inline ml-2"/> ترحيل وحفظ {label}</button>
                        </div>
                    )}
                </div>
            )}
            {!isOpen && (
                <div className="p-4 no-print animate-fade-in"><button onClick={() => setIsOpen(true)} className={`${themeColor} text-white px-8 py-2.5 rounded-xl font-black shadow-lg flex items-center gap-2 border-b-4 border-black/20`}><PlusCircle size={20}/> فتح نافذة إدخال {label}</button></div>
            )}
            <ActionHistoryTable warehouse={warehouse} mode={mode} title={label} refreshTrigger={historyRefreshKey} />
        </div>
    );
};

export const IssueVoucherForm: React.FC<{ warehouse: WarehouseType, title: string, onSuccess: () => void }> = ({ warehouse, title, onSuccess }) => {
    let mode: any = 'out';
    if (title.includes('استلام')) mode = 'receipt';
    else if (title.includes('إضافة')) mode = 'transfer_in';
    else if (title.includes('خصم')) mode = 'transfer_out';
    else if (title.includes('تسوية')) mode = title.includes('بالاضافة') ? 'adj_in' : 'adj_out';
    else if (title.includes('مرتجع')) mode = 'return';
    return <StockEntryForm warehouse={warehouse} mode={mode} label={title} onSuccess={onSuccess} />;
};

export const StocktakingForm: React.FC<{ warehouse: WarehouseType }> = ({ warehouse }) => {
    const { products, refreshProducts, t, addNotification } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filtered = products.filter(p => 
        p.warehouse === warehouse && 
        (p.name.includes(searchTerm) || p.barcode.includes(searchTerm))
    );

    const handleUpdate = (id: string, field: string, val: string) => {
        const prod = products.find(p => p.id === id);
        if (!prod) return;
        const num = parseFloat(val) || 0;
        const updated = { ...prod, [field]: num };
        
        const newBulk = field === 'initialStockBulk' ? num : (prod.initialStockBulk || 0);
        const newPacked = field === 'initialStockPacked' ? num : (prod.initialStockPacked || 0);
        updated.stock = newBulk + newPacked;
        updated.stockBulk = newBulk;
        updated.stockPacked = newPacked;

        dbService.saveProduct(updated);
        refreshProducts();
    };

    const handleExport = () => {
        const headers = ["كود الصنف", "اسم الصنف", "الوحدة", "رصيد أول (صب) ثابت", "رصيد أول (معبأ) ثابت"];
        const rows = filtered.map(p => [p.barcode, p.name, p.unit || 'طن', p.initialStockBulk || 0, p.initialStockPacked || 0]);
        excelService.exportStyledTable(`الأرصدة الافتتاحية - ${warehouse}`, headers, rows, `Opening_Balances_${warehouse}`);
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
                const rawData = smartReadSheet(worksheet);

                const processedRows = processInventoryExcel(rawData);
                const currentProducts = [...products];
                let updatedCount = 0;

                processedRows.forEach((item: any) => {
                    const code = String(item.jdeCode || "").trim();
                    const name = String(item.name || "").trim();
                    const openBulk = Number(item.initialStockBulk || 0);
                    const openPacked = Number(item.initialStockPacked || 0);

                    const prodIdx = currentProducts.findIndex(p => 
                        (code && p.barcode === code) || (name && p.name === name)
                    );

                    if (prodIdx >= 0) {
                        const p = currentProducts[prodIdx];
                        p.initialStockBulk = openBulk;
                        p.initialStockPacked = openPacked;
                        p.stockBulk = openBulk;
                        p.stockPacked = openPacked;
                        p.stock = openBulk + openPacked;
                        updatedCount++;
                    }
                });

                dbService.saveProducts(currentProducts);
                refreshProducts();
                addNotification(`تم تحديث أرصدة جرد ${updatedCount} صنف بنجاح بذكاء.`, 'success');
            } catch (err) {
                console.error(err);
                alert('خطأ في قراءة ملف Excel، تأكد من توافق الأعمدة.');
            }
            if (e.target) e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-4 p-4 bg-white rounded-2xl border shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
                <div className="flex gap-2 items-center flex-1 w-full relative">
                    <input 
                        className="w-full pr-12 pl-4 py-2.5 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 font-bold bg-slate-50 shadow-inner" 
                        placeholder="البحث عن صنف لضبط رصيد الافتتاحي..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute right-4 top-3.5 text-gray-400" size={18}/>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-6 h-11 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md font-black text-xs"
                    >
                        <FileDown size={18}/> استيراد Excel
                    </button>
                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-2 px-6 h-11 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md font-black text-xs"
                    >
                        <FileUp size={18}/> تصدير Excel
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImport} />
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-inner">
                <table className="w-full text-center border-collapse">
                    <thead className="bg-[#1f2937] text-white h-12 font-black sticky top-0 z-10">
                        <tr>
                            <th className="p-2 border-l border-slate-700">كود</th>
                            <th className="p-2 border-l border-slate-700 text-right pr-6">اسم الصنف</th>
                            <th className="p-2 border-l border-slate-700">الوحدة</th>
                            <th className="p-2 border-l border-slate-700 bg-blue-900/30">رصيد أول (صب) ثابت</th>
                            <th className="p-2 border-l border-slate-700 bg-indigo-900/30">رصيد أول (معبأ) ثابت</th>
                        </tr>
                    </thead>
                    <tbody className="font-bold">
                        {filtered.map(p => (
                            <tr key={p.id} className="border-b h-14 hover:bg-blue-50 transition-colors">
                                <td className="p-2 border-l font-mono text-xs text-slate-400">{p.barcode}</td>
                                <td className="p-2 border-l text-right pr-6 font-black text-slate-900">{p.name}</td>
                                <td className="p-2 border-l text-slate-400 text-xs">{p.unit || 'طن'}</td>
                                <td className="p-2 border-l bg-blue-50/50">
                                    <input 
                                        type="number" step="any" 
                                        className="w-32 p-2 border-2 border-blue-100 rounded-lg text-center font-black text-blue-700 outline-none focus:border-blue-500" 
                                        defaultValue={p.initialStockBulk} 
                                        onBlur={e => handleUpdate(p.id, 'initialStockBulk', e.target.value)}
                                        style={forceEnNumsStyle}
                                    />
                                </td>
                                <td className="p-2 border-l bg-indigo-50/50">
                                    <input 
                                        type="number" step="any" 
                                        className="w-32 p-2 border-2 border-indigo-100 rounded-lg text-center font-black text-indigo-700 outline-none focus:border-indigo-500" 
                                        defaultValue={p.initialStockPacked} 
                                        onBlur={e => handleUpdate(p.id, 'initialStockPacked', e.target.value)}
                                        style={forceEnNumsStyle}
                                    />
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-bold italic text-lg">لا توجد أصناف مطابقة للبحث</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
