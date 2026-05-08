
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
// Add missing ClipboardList icon
import { 
    Search, Printer, FileDown, Settings, Filter, 
    ShoppingCart, Truck, Clock, CheckCircle2, 
    Calendar, Hash, Briefcase, Eye, EyeOff, RotateCcw, FileSpreadsheet, Download, ClipboardList
} from 'lucide-react';
import { printService } from '../services/printing';
import { TableToolbar } from './TableToolbar';
import { ReportActionsBar } from './ReportActionsBar';
import { GlassCard } from './NeumorphicUI';
import { PrintSettingsModal } from './PrintSettingsModal';
import * as XLSX from 'xlsx';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const
};

const DEFAULT_STYLES = {
    fontFamily: 'Calibri, sans-serif',
    fontSize: 13,
    isBold: true,
    isItalic: false,
    isUnderline: false,
    textAlign: 'center' as 'right' | 'center' | 'left',
    verticalAlign: 'middle' as 'top' | 'middle' | 'bottom',
    decimals: 2,
    rowHeight: 45,
    columnWidth: 140
};

export const PurchaseItemsReport: React.FC = () => {
    const { settings, t, products } = useApp();
    const [dateFilter, setDateFilter] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState('all');
    const [selectedWarehouse, setSelectedWarehouse] = useState('all');
    const [showPrintModal, setShowPrintModal] = useState(false);
    
    const [tableStyles, setTableStyles] = useState(() => {
        const saved = localStorage.getItem('glasspos_purchase_rep_styles');
        return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES;
    });

    useEffect(() => {
        localStorage.setItem('glasspos_purchase_rep_styles', JSON.stringify(tableStyles));
    }, [tableStyles]);

    const purchases = dbService.getPurchases();

    const reportData = useMemo(() => {
        const start = new Date(dateFilter.start); start.setHours(0,0,0,0);
        const end = new Date(dateFilter.end); end.setHours(23,59,59,999);

        return purchases
            .filter(p => {
                const d = new Date(p.date);
                const matchesDate = d >= start && d <= end;
                const matchesSupplier = selectedSupplier === 'all' || p.supplier === selectedSupplier;
                const matchesWarehouse = selectedWarehouse === 'all' || p.warehouse === selectedWarehouse;
                return matchesDate && matchesSupplier && matchesWarehouse;
            })
            .flatMap(p => p.items.map(item => {
                const productRef = products.find(prod => prod.id === item.productId);
                const jdeCode = item.jdeCode || productRef?.jdeCode || productRef?.jdeCodePacked || productRef?.jdeCodeBulk || '-';

                return {
                    ...item,
                    jdeCode: jdeCode,
                    orderNumber: p.orderNumber,
                    date: p.date,
                    supplier: p.supplier,
                    warehouse: p.warehouse,
                    status: p.status,
                    requestFor: p.requestFor || '-',
                    department: p.department || '-',
                    remaining: Math.max(0, item.quantity - (item.receivedQuantity || 0))
                };
            }))
            .filter(row => 
                row.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.orderNumber.includes(searchTerm) ||
                row.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.jdeCode.includes(searchTerm)
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [purchases, dateFilter, searchTerm, selectedSupplier, selectedWarehouse, products]);

    const stats = useMemo(() => {
        const uniqueOrders = new Set(reportData.map(r => r.orderNumber));
        const totalValue = reportData.reduce((sum, r) => sum + r.totalCost, 0);
        const pendingValue = reportData.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.totalCost, 0);
        
        return {
            orderCount: uniqueOrders.size,
            totalValue,
            pendingValue,
            itemCount: reportData.length
        };
    }, [reportData]);

    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, "PurchaseReport.xlsx");
    };

    const handlePrint = () => {
        printService.printWindow(document.getElementById('purchase-print-area')?.innerHTML || '');
    };

    return (
        <div className="space-y-6 animate-fade-in flex flex-col h-full font-cairo" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="purchases" />}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 no-print">
                <StatCard label="إجمالي القيمة" value={stats.totalValue} unit="جنية" icon={<ShoppingCart size={32}/>} color="bg-blue-600" />
                <StatCard label="قيمة الطلبات المعلقة" value={stats.pendingValue} unit="جنية" icon={<Clock size={32}/>} color="bg-amber-500" />
                <StatCard label="عدد بنود التوريد" value={stats.itemCount} unit="صنف" icon={<ClipboardList size={32}/>} color="bg-indigo-600" />
                <StatCard label="إجمالي البنود" value={1} unit="صنف" icon={<Truck size={32}/>} color="bg-violet-600" />
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-xl flex flex-col xl:flex-row items-end gap-6 no-print">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1 w-full items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-black text-slate-400 mr-1 uppercase">من تاريخ</label>
                        <input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="w-full p-2.5 border rounded-xl font-bold bg-slate-50" style={forceEnNumsStyle}/>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-black text-slate-400 mr-1 uppercase">إلى تاريخ</label>
                        <input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="w-full p-2.5 border rounded-xl font-bold bg-slate-50" style={forceEnNumsStyle}/>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-black text-slate-400 mr-1 uppercase">جهة التنفيذ</label>
                        <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full p-2.5 border rounded-xl font-black bg-white">
                            <option value="all">كل جهات التنفيذ</option>
                            {settings.suppliers?.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-black text-slate-400 mr-1 uppercase">المخزن</label>
                        <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)} className="w-full p-2.5 border rounded-xl font-black bg-white">
                            <option value="all">كل المخازن</option>
                            <option value="raw">مخزن الخامات</option>
                            <option value="finished">مخزن التام</option>
                        </select>
                    </div>
                    <div className="relative">
                        <label className="text-[11px] font-black text-slate-400 mb-1 block mr-1 uppercase">بحث سريع</label>
                        <input className="w-full p-2.5 pr-10 rounded-xl border bg-slate-50/50 outline-none focus:border-indigo-400 font-bold" placeholder="رقم الطلب أو الصنف أو JDE..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search className="absolute right-3 top-8.5 text-slate-300" size={18}/>
                    </div>
                </div>
                <div className="flex gap-2 pb-1">
                    <button onClick={handleExport} className="bg-white border-2 border-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg hover:bg-emerald-50 transition-all"><FileSpreadsheet size={20}/> تصدير Excel</button>
                    <button onClick={handlePrint} className="bg-white border-2 border-slate-50 text-slate-800 px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg hover:bg-slate-50 transition-all"><Printer size={20}/> طباعة التقرير</button>
                    <button onClick={() => setShowPrintModal(true)} className="p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-md"><Settings size={22}/></button>
                </div>
            </div>

            <TableToolbar styles={tableStyles} setStyles={setTableStyles} onReset={() => setTableStyles(DEFAULT_STYLES)} />

            <div id="purchase-print-area" className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 shadow-2xl overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-center whitespace-nowrap border-collapse">
                        <thead className="bg-[#0f172a] text-white h-16 sticky top-0 z-40">
                            <tr className="text-[11px] font-black uppercase tracking-widest">
                                <th className="p-4 border-l border-slate-700">تاريخ الطلب</th>
                                <th className="p-4 border-l border-slate-700">رقم الطلب</th>
                                <th className="p-4 border-l border-slate-700">جهة التنفيذ</th>
                                <th className="p-4 border-l border-slate-700">الطلب لأجل</th>
                                <th className="p-4 border-l border-slate-700 text-right pr-8">بيان الصنف</th>
                                <th className="p-4 border-l border-slate-700 bg-blue-900/30 text-yellow-300">كود JDE</th>
                                <th className="p-4 border-l border-slate-700 text-blue-300">المطلوب</th>
                                <th className="p-4 border-l border-slate-700 text-emerald-300">المستلم</th>
                                <th className="p-4 border-l border-slate-700 text-rose-300">المتبقي</th>
                                <th className="p-4 border-l border-slate-700">الحالة</th>
                                <th className="p-4">إجمالي القيمة</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-900 font-bold text-[13px]">
                            {reportData.map((row, idx) => (
                                <tr key={idx} className={`border-b border-slate-100 h-14 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/30`}>
                                    <td className="p-3 border-l" style={forceEnNumsStyle}>{new Date(row.date).toLocaleDateString('en-GB')}</td>
                                    <td className="p-3 border-l font-mono text-indigo-700 font-black">{row.orderNumber}</td>
                                    <td className="p-3 border-l text-right pr-6">{row.supplier}</td>
                                    <td className="p-3 border-l text-xs text-slate-400">{row.requestFor}</td>
                                    <td className="p-3 border-l text-right pr-8 font-black text-slate-800">{row.productName}</td>
                                    <td className="p-3 border-l font-mono bg-blue-50/10 text-indigo-800 text-xs">{row.jdeCode}</td>
                                    <td className="p-3 border-l text-blue-600 font-black" style={forceEnNumsStyle}>{row.quantity}</td>
                                    <td className="p-3 border-l text-emerald-600 font-black" style={forceEnNumsStyle}>{row.receivedQuantity || 0}</td>
                                    <td className={`p-3 border-l font-black ${row.remaining > 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-300'}`} style={forceEnNumsStyle}>{row.remaining}</td>
                                    <td className="p-3 border-l">
                                        <span className={`px-4 py-1 rounded-full text-[10px] font-black text-white ${row.status === 'received' ? 'bg-emerald-500' : 'bg-blue-500 shadow-lg'}`}>{row.status === 'received' ? 'مستلم' : 'معلق'}</span>
                                    </td>
                                    <td className="p-3 font-black text-slate-900" style={forceEnNumsStyle}>{row.totalCost.toFixed(2)}</td>
                                </tr>
                            ))}
                            {reportData.length === 0 && (
                                <tr><td colSpan={11} className="p-32 text-slate-200 font-black italic text-2xl">لا توجد بيانات للعرض...</td></tr>
                            )}
                        </tbody>
                        {reportData.length > 0 && (
                            <tfoot className="bg-slate-100 text-slate-900 font-black h-16 border-t-2 border-slate-200 shadow-inner">
                                <tr>
                                    <td colSpan={5} className="p-4 text-left pr-10 text-lg uppercase tracking-widest">إجمالي الصفحة:</td>
                                    <td colSpan={1} className="text-left font-mono"></td>
                                    <td className="p-4 border-l border-white text-blue-700 text-lg" style={forceEnNumsStyle}>{reportData.reduce((s,r) => s + r.quantity, 0)}</td>
                                    <td className="p-4 border-l border-white text-emerald-700 text-lg" style={forceEnNumsStyle}>{reportData.reduce((s,r) => s + (r.receivedQuantity || 0), 0)}</td>
                                    <td className="p-4 border-l border-white text-rose-700 text-lg" style={forceEnNumsStyle}>{reportData.reduce((s,r) => s + r.remaining, 0)}</td>
                                    <td className="p-4 border-l border-white"></td>
                                    <td className="p-4 bg-indigo-50 font-black text-indigo-900 text-xl" style={forceEnNumsStyle}>{reportData.reduce((s,r) => s + r.totalCost, 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, unit, icon, color }: any) => (
    <GlassCard className={`p-6 flex items-center justify-between border-none shadow-xl ${color} text-white group hover:scale-[1.03] transition-all`}>
        <div className="flex flex-col">
            <p className="text-[10px] font-black opacity-80 mb-1 uppercase tracking-wider">{label}</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black drop-shadow-md" style={forceEnNumsStyle}>{value.toLocaleString()}</h3>
                <span className="text-xs font-bold opacity-60 uppercase">{unit}</span>
            </div>
        </div>
        <div className="bg-white/20 p-4 rounded-3xl group-hover:rotate-12 transition-transform shadow-inner border border-white/10">
            {icon}
        </div>
    </GlassCard>
);
