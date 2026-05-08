
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { 
    Search, Plus, Save, X, Trash2, Calendar, Hash, Truck, 
    User, HardHat, Building2, Briefcase, Tag, ClipboardCheck,
    Settings, FileText, Clock, AlertCircle, Package, PlusCircle,
    UserCog, Gauge, History, Timer, Warehouse, Layers, ArrowRightLeft,
    CheckCircle2, ShieldCheck, ShoppingCart, UserCheck, ArrowDownLeft, ArrowUpRight,
    Settings2, Check
} from 'lucide-react';
import { StockMovement, Product, AppSettings } from '../types';
import { TableToolbar } from './TableToolbar';
import { ReportActionsBar } from './ReportActionsBar';
import { PrintSettingsModal } from './PrintSettingsModal';
import { InputModal, GlassCard } from './NeumorphicUI';
import { printService } from '../services/printing';
import * as XLSX from 'xlsx';

interface Props {
    view: 'in' | 'out' | 'adjustment' | 'all' | 'period' | 'card' | 'transfer_in' | 'transfer_out';
    title: string;
}

const DEFAULT_STYLES = {
    fontFamily: 'Calibri, sans-serif',
    fontSize: 12,
    isBold: true,
    isItalic: false,
    textAlign: 'center' as 'right' | 'center' | 'left',
    verticalAlign: 'middle' as 'top' | 'middle' | 'bottom',
    decimals: 2
};

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const
};

export const PartsMegaTable: React.FC<Props> = ({ view, title }) => {
    const { settings, products, user, refreshProducts, updateSettings, t } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);
    const tableRef = useRef<HTMLTableElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [updateTrigger, setUpdateTrigger] = useState(0);

    const [tableStyles, setTableStyles] = useState(() => {
        const saved = localStorage.getItem(`glasspos_partsmega_${view}_styles`);
        return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES;
    });

    const tableData = useMemo(() => {
        const movements = dbService.getMovements();
        return movements
            .filter(m => m.warehouse === 'parts')
            .filter(m => {
                if (view === 'all' || view === 'period') return true;
                if (view === 'transfer_in') return m.type === 'transfer' && (m.reason?.includes('وارد') || m.reason?.includes('من'));
                if (view === 'transfer_out') return m.type === 'transfer' && (m.reason?.includes('منصرف') || m.reason?.includes('إلى'));
                return m.type === view;
            })
            .flatMap(m => m.items.map((item, idx) => ({
                ...m,
                ...m.customFields, 
                ...item,
                moveId: m.id,
                itemIdx: idx,
                displayDate: new Date(m.date).toLocaleDateString('en-GB')
            })))
            .filter(row => 
                (row.productName || '').includes(searchTerm) || 
                (row.recipientName || '').includes(searchTerm) ||
                (row.supplierName || '').includes(searchTerm) ||
                (row.equipmentCode || '').includes(searchTerm) ||
                (row.refNumber || '').includes(searchTerm) ||
                (row.reason || '').includes(searchTerm)
            )
            .reverse();
    }, [view, searchTerm, updateTrigger, products]);

    const isInbound = view === 'in' || view === 'transfer_in' || view === 'all';
    const isSparePartsIssue = view === 'out' && user?.selectedWarehouse !== 'minia';
    const isMinia = user?.selectedWarehouse === 'minia';

    const cols = isSparePartsIssue ? [
        "م", "التاريخ", "رقم طلب الصرف", "كود الصنف", "اسم الصنف", "الوحدة", "الكمية", 
        "المخزن التابع", "الادارة التابع لها", "القسم التابع له", "أمين المخزن", 
        "كود الموظف", "اسم المستلم", "رقم امر الشغل", "كود المعدة", "حالة الصرف", 
        "موقف القطع القديمة", "رقم العداد", "الوردية", "وقت الدخول", "وقت الخروج", 
        "الفرق", "الرصيد الحالى", "ملاحظات"
    ] : isMinia ? [
        "م", "التاريخ", "رقم الإذن", "الكود", "اسم الصنف", "الوحدة", "الكمية", 
        "المورد/العميل", "طريقة النقل", "نوع السيارة", "رقم السيارة", "الوردية", "أمين المخزن", "الرصيد اللحظي"
    ] : isInbound ? [
        "م", "التاريخ", "رقم الإذن", "رقم PO", "المورد", "الكود", "اسم الصنف", "الوحدة", "الكمية", 
        "رقم الفحص", "القائم بالفحص", "القائم بالتسكين", "رقم الإضافة سيستم", "أمين المخزن", "الرصيد اللحظي"
    ] : [
        "م", "التاريخ", "رقم الإذن", "نوع الصرف", "الكود", "اسم الصنف", "الوحدة", "الكمية", 
        "الإدارة", "القسم", "المستلم", "كود المعدة", "أمر الشغل", "أمين المخزن", "الرصيد اللحظي"
    ];

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        alert("خاصية الاستيراد للسجلات قيد التطوير.");
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getCellStyle = (isNumeric: boolean = false): React.CSSProperties => ({
        fontFamily: isNumeric ? 'Inter, sans-serif' : tableStyles.fontFamily,
        fontSize: `${tableStyles.fontSize}px`,
        fontWeight: tableStyles.isBold ? 'bold' : 'normal',
        textAlign: tableStyles.textAlign,
        verticalAlign: tableStyles.verticalAlign,
        ...(isNumeric ? forceEnNumsStyle : {})
    });

    const formatVal = (n: any) => {
        const num = parseFloat(n);
        if (isNaN(num)) return '-';
        return num.toLocaleString('en-US', { minimumFractionDigits: tableStyles.decimals, maximumFractionDigits: tableStyles.decimals });
    };

    return (
        <div className="space-y-4 font-cairo animate-fade-in" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context={`partsmega_${view}`} />}
            
            <TableToolbar styles={tableStyles} setStyles={setTableStyles} onReset={() => setTableStyles(DEFAULT_STYLES)} />

            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4 no-print relative z-10">
                <div className="flex gap-2 items-center flex-1">
                    <ReportActionsBar 
                        onPrint={() => printService.printWindow(tableRef.current?.parentElement?.innerHTML || '')}
                        onExport={() => {}} 
                        onImport={() => fileInputRef.current?.click()}
                        onSettings={() => setShowPrintModal(true)}
                        hideImport={false}
                    />
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" />
                    <div className="relative flex-1 max-w-xs">
                        <input className="w-full pr-10 pl-4 py-2 border rounded-xl text-sm outline-none font-bold bg-slate-50/50 shadow-inner" placeholder="بحث في السجل..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search className="absolute right-3 top-2.5 text-gray-400" size={16}/>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-premium border border-slate-300 overflow-hidden relative z-0">
                <div className="overflow-auto max-h-[75vh]">
                    <table className="w-full border-collapse min-w-[3800px]" ref={tableRef}>
                        <thead className="sticky top-0 z-20 bg-slate-900 text-white">
                            <tr className="h-14">
                                {cols.map((c, i) => (
                                    <th key={i} className="p-3 border border-slate-700 text-[10px] uppercase font-black" style={getCellStyle()}>
                                        {c}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((row: any, idx: number) => (
                                <tr key={`${row.moveId}-${row.itemIdx}`} className={`border-b hover:bg-indigo-50 transition-colors h-12 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                    <td className="p-2 border" style={getCellStyle(true)}>{idx + 1}</td>
                                    <td className="p-2 border" style={getCellStyle(true)}>{row.displayDate}</td>
                                    <td className="p-2 border font-bold text-indigo-800" style={getCellStyle(true)}>{row.refNumber}</td>
                                    
                                    {isSparePartsIssue ? (
                                        <>
                                            <td className="p-2 border font-mono text-xs" style={getCellStyle(true)}>{row.productCode}</td>
                                            <td className="p-2 border text-right pr-4 font-black text-blue-900" style={getCellStyle()}>{row.productName}</td>
                                            <td className="p-2 border bg-slate-50 font-bold" style={getCellStyle()}>{row.unit}</td>
                                            <td className="p-2 border font-black text-lg text-orange-600 bg-orange-50" style={getCellStyle(true)}>{formatVal(row.quantity)}</td>
                                            <td className="p-2 border text-xs">{row.subWarehouse || '-'}</td>
                                            <td className="p-2 border text-xs">{row.department || '-'}</td>
                                            <td className="p-2 border text-xs">{row.section || '-'}</td>
                                            <td className="p-2 border text-xs">{row.storekeeper || row.user}</td>
                                            <td className="p-2 border font-mono text-xs" style={getCellStyle(true)}>{row.employeeCode || '-'}</td>
                                            <td className="p-2 border text-xs font-bold">{row.reason || '-'}</td>
                                            <td className="p-2 border font-mono text-xs" style={getCellStyle(true)}>{row.workOrderNo || '-'}</td>
                                            <td className="p-2 border font-mono text-xs" style={getCellStyle(true)}>{row.equipmentCode || '-'}</td>
                                            <td className="p-2 border text-xs">{row.issueStatus || '-'}</td>
                                            <td className="p-2 border text-xs">{row.oldPartsStatus || '-'}</td>
                                            <td className="p-2 border font-mono text-xs" style={getCellStyle(true)}>{row.meterReading || '-'}</td>
                                            <td className="p-2 border text-xs">{row.shift || '-'}</td>
                                            <td className="p-2 border font-mono text-xs" style={getCellStyle(true)}>{row.entryTime || '-'}</td>
                                            <td className="p-2 border font-mono text-xs" style={getCellStyle(true)}>{row.exitTime || '-'}</td>
                                            <td className="p-2 border font-mono text-xs text-indigo-600 font-black" style={getCellStyle(true)}>{row.timeDiff || '-'}</td>
                                            <td className="p-2 border bg-slate-50 font-black text-blue-900" style={getCellStyle(true)}>{formatVal(row.currentBalance)}</td>
                                            <td className="p-2 border text-xs italic text-slate-400">{row.notes || '-'}</td>
                                        </>
                                    ) : isMinia ? (
                                        <>
                                            <td className="p-2 border font-mono text-[11px]" style={getCellStyle(true)}>{row.productCode}</td>
                                            <td className="p-2 border text-right pr-4 font-black text-blue-900" style={getCellStyle()}>{row.productName}</td>
                                            <td className="p-2 border bg-slate-50 font-bold" style={getCellStyle()}>{row.unit}</td>
                                            <td className={`p-2 border font-black text-lg ${row.type === 'in' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`} style={getCellStyle(true)}>{formatVal(row.quantity)}</td>
                                            <td className="p-2 border font-bold" style={getCellStyle()}>{row.supplierName || row.recipientName || row.reason || '-'}</td>
                                            <td className="p-2 border" style={getCellStyle()}>{row.transportMethod || '-'}</td>
                                            <td className="p-2 border" style={getCellStyle()}>{row.carType || '-'}</td>
                                            <td className="p-2 border" style={getCellStyle(true)}>{row.carNumber || '-'}</td>
                                            <td className="p-2 border" style={getCellStyle()}>{row.shift || '-'}</td>
                                            <td className="p-2 border text-gray-500" style={getCellStyle()}>{row.storekeeper || row.user}</td>
                                            <td className="p-2 border bg-slate-100 text-slate-800 font-bold" style={getCellStyle(true)}>{formatVal(row.currentBalance)}</td>
                                        </>
                                    ) : (
                                        <>
                                            {isInbound ? (
                                                <>
                                                    <td className="p-2 border text-blue-700 font-bold" style={getCellStyle(true)}>{row.purchaseOrderNo || '-'}</td>
                                                    <td className="p-2 border font-black text-slate-800" style={getCellStyle()}>{row.supplierName || row.reason || '-'}</td>
                                                </>
                                            ) : (
                                                <td className="p-2 border font-bold text-indigo-600" style={getCellStyle()}>{row.issueType || '-'}</td>
                                            )}

                                            <td className="p-2 border font-mono text-[11px]" style={getCellStyle(true)}>{row.productCode}</td>
                                            <td className="p-2 border text-right pr-4 font-black text-blue-900" style={getCellStyle()}>{row.productName}</td>
                                            <td className="p-2 border bg-slate-50 font-bold" style={getCellStyle()}>{row.unit}</td>
                                            <td className={`p-2 border font-black text-lg ${row.type === 'in' ? 'text-green-600 bg-green-50' : row.type === 'out' ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50'}`} style={getCellStyle(true)}>{formatVal(row.quantity)}</td>
                                            
                                            {isInbound ? (
                                                <>
                                                    <td className="p-2 border" style={getCellStyle(true)}>{row.inspectionReportNo || '-'}</td>
                                                    <td className="p-2 border" style={getCellStyle()}>{row.inspectingOfficer || '-'}</td>
                                                    <td className="p-2 border text-indigo-600 font-bold" style={getCellStyle()}>{row.housingOfficer || '-'}</td>
                                                    <td className="p-2 border bg-rose-50 text-rose-800 font-black" style={getCellStyle(true)}>{row.systemAddNo || '-'}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-2 border" style={getCellStyle()}>{row.department || '-'}</td>
                                                    <td className="p-2 border" style={getCellStyle()}>{row.section || '-'}</td>
                                                    <td className="p-2 border font-bold" style={getCellStyle()}>{row.recipientName || '-'}</td>
                                                    <td className="p-2 border" style={getCellStyle(true)}>{row.equipmentCode || '-'}</td>
                                                    <td className="p-2 border text-blue-700 font-bold" style={getCellStyle(true)}>{row.workOrderNo || '-'}</td>
                                                </>
                                            )}
                                            
                                            <td className="p-2 border text-gray-500" style={getCellStyle()}>{row.storekeeper || row.user}</td>
                                            <td className="p-2 border bg-slate-100 text-slate-800 font-bold" style={getCellStyle(true)}>{formatVal(row.currentBalance)}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
