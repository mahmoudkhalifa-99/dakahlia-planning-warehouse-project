
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Product, StockMovement } from '../types';
import { 
    Search, Calendar, Printer, Settings, Eye, EyeOff, 
    FileSpreadsheet, Download, History, Calculator, ArrowRightLeft,
    ChevronLeft, ZoomIn, ChevronDown
} from 'lucide-react';
import { printService } from '../services/printing';
import { TableToolbar } from './TableToolbar';
import { PrintSettingsModal } from './PrintSettingsModal';
import { GlassCard } from './NeumorphicUI';
import * as XLSX from 'xlsx';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontWeight: '700',
    fontSize: '13px'
};

const DEFAULT_STYLES = {
    fontFamily: 'Calibri, sans-serif',
    fontSize: 12,
    isBold: true,
    isItalic: false,
    isUnderline: false,
    textAlign: 'center' as 'right' | 'center' | 'left',
    verticalAlign: 'middle' as 'top' | 'middle' | 'bottom',
    decimals: 3,
    columnWidth: 110
};

const COLUMN_WIDTHS: Record<number, number> = {
    0: 50, 1: 80, 2: 70, 3: 90, 4: 90, 5: 350, 6: 150, 7: 70, 8: 110, 9: 85, 10: 85, 11: 85, 12: 85, 13: 85, 14: 85, 15: 85, 16: 85, 17: 85, 18: 85, 19: 100, 20: 110, 21: 110, 22: 85, 23: 85, 24: 85, 25: 85, 26: 85, 27: 110, 28: 140, 29: 120, 30: 400
};

export const RawPeriodReport: React.FC = () => {
    const { products, settings, t } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [hideZeroRows, setHideZeroRows] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [pageScale, setPageScale] = useState(100); // New state for zoom
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const tableRef = useRef<HTMLTableElement>(null);

    const [tableStyles, setTableStyles] = useState(() => {
        const saved = localStorage.getItem('glasspos_raw_period_styles');
        return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES;
    });

    useEffect(() => {
        localStorage.setItem('glasspos_raw_period_styles', JSON.stringify(tableStyles));
    }, [tableStyles]);

    const columns = [
        "م", "رقم البلاطة", "الاستاند", "كود JDE", "كود دريف", "اسم الصنف", "وصف الصنف", "الوحدة",
        "رصيد أول للمخازن", "الوارد", "تسوية بالإضافة", "تحويلات (+)", "مرتجع وارد", "مرتجع صادر", "مبيعات", "العجز المسموح", "العجز الغير مسموح به",
        "تسوية بالخصم", "صرف المخازن", "المحول من الصوامع", "رصيد المخازن (نهاية)",
        "أول مدة صوامع", "وارد صوامع", "المنصرف كنترول", "تسويات صوامع (+)", "تسويات صوامع (-)", "تحويلات صوامع", "رصيد الصوامع (نهاية)",
        "اجمالي المصنع الان", "اسم المخزن", "ملاحظات"
    ];

    function smartNormalize(t: any) {
        return (t || '').toString().trim().toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/[\u064B-\u0652]/g, '');
    }

    const reportData = useMemo(() => {
        const rawItems = products.filter(p => p.warehouse === 'raw' || ['خامات', 'خامات اساسية', 'اضافات', 'شكاير', 'كروت', 'مستلزمات'].includes(p.category));
        const movements = dbService.getMovements().filter(m => m.warehouse === 'raw');
        
        const startDate = new Date(dateRange.start); startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end); endDate.setHours(23, 59, 59, 999);

        let data = rawItems.map((p, idx) => {
            const itemMoves = movements.filter(m => m.items.some(i => i.productId === p.id));
            
            const stats = {
                preWh: 0, preSilo: 0,
                inbound: 0, adjIn: 0, transfers: 0, sales: 0, allowedShort: 0, disallowedShort: 0,
                adjOut: 0, issueWh: 0, 
                inSilo: 0, transFromSilo: 0, controlOut: 0, adjInSilo: 0, adjOutSilo: 0, transSiloOut: 0,
                whTransfer: 0,
                returnIn: 0, returnOut: 0
            };

            itemMoves.forEach(m => {
                const item = m.items.find(i => i.productId === p.id);
                if (!item) return;
                const qty = Number(item.quantity) || 0;
                const ctx = m.customFields?.viewContext || '';
                const moveMode = m.customFields?.moveMode || '';
                const mDate = new Date(m.date);

                const isWhImpact = ['raw_in', 'raw_sale', 'wh_adj', 'shortage', 'wh_out', 'wh_transfer', 'raw_return'].includes(ctx);
                const isSiloImpact = ['silo_trans', 'control_out', 'silo_adj'].includes(ctx);

                if (mDate < startDate) {
                    let factor = (m.type === 'in' || m.type === 'return' || (m.type === 'adjustment' && !m.reason?.includes('خصم') && !m.reason?.includes('عجز'))) ? 1 : -1;
                    if (isWhImpact) {
                        stats.preWh += (qty * factor);
                        if (ctx === 'wh_out') stats.preSilo += qty;
                    } else if (isSiloImpact) {
                        stats.preSilo += (qty * factor);
                        if (ctx === 'silo_trans' && moveMode === 'in') stats.preWh += qty;
                    }
                }
                else if (mDate <= endDate) {
                    if (ctx === 'wh_out') { stats.issueWh += qty; stats.inSilo += qty; } 
                    else if (ctx === 'wh_transfer') { stats.whTransfer += qty; }
                    else if (ctx === 'silo_trans') {
                        if (moveMode === 'in') stats.transFromSilo += qty; 
                        else if (moveMode === 'out') stats.transSiloOut += qty; 
                        else stats.transfers += qty;
                    }
                    else if (ctx === 'control_out') { stats.controlOut += qty; }
                    else if (ctx === 'silo_adj') {
                        if (m.type === 'adjustment' && (m.reason?.includes('خصم') || m.reason?.includes('عجز'))) stats.adjOutSilo += qty;
                        else stats.adjInSilo += qty;
                    }
                    else if (ctx === 'shortage') {
                        const reason = (m.reason || '').toLowerCase();
                        if (reason.includes('مسموح')) stats.allowedShort += qty;
                        else if (reason.includes('غير مسموح')) stats.disallowedShort += qty;
                        else stats.adjOut += qty;
                    }
                    else if (ctx === 'wh_adj') {
                        if (m.type === 'adjustment' && (m.reason?.includes('خصم') || m.reason?.includes('عجز'))) stats.adjOut += qty;
                        else stats.adjIn += qty;
                    }
                    else if (ctx === 'raw_in') { stats.inbound += qty; }
                    else if (ctx === 'raw_sale') { stats.sales += qty; }
                    else if (ctx === 'raw_return') {
                        if (m.type === 'return' || m.type === 'in' || moveMode === 'in') stats.returnIn += qty;
                        else if (m.type === 'out' || moveMode === 'out') stats.returnOut += qty;
                    }
                }
            });

            const openingWh = (p.initialStockBulk || 0) + stats.preWh;
            const openingSilo = (p.initialStockPacked || 0) + stats.preSilo;

            const closingWh = openingWh + stats.inbound + stats.adjIn + stats.transFromSilo + stats.returnIn - stats.returnOut - stats.sales - stats.allowedShort - stats.disallowedShort - stats.adjOut - stats.issueWh - stats.whTransfer;
            const closingSilo = openingSilo + stats.inSilo + stats.adjInSilo - stats.controlOut - stats.adjOutSilo - stats.transSiloOut - stats.transFromSilo;

            return {
                ...p,
                stats,
                openingWh,
                openingSilo,
                whBalance: closingWh,
                siloBalance: closingSilo,
                totalFactory: closingWh + closingSilo
            };
        });

        if (hideZeroRows) {
            data = data.filter(r => Math.abs(r.totalFactory) > 0.001 || Math.abs(r.openingWh) > 0.001);
        }

        return data.filter(r => 
            smartNormalize(r.name).includes(smartNormalize(searchTerm)) || 
            smartNormalize(r.barcode).includes(smartNormalize(searchTerm))
        );
    }, [products, searchTerm, hideZeroRows, dateRange]);

    const handleExport = () => {
        const headers = columns;
        const rows = reportData.map((r, i) => [
            i+1, r.customFields?.tile || '-', r.customFields?.stand || '-', r.jdeCode || '-', r.barcode, r.name, r.category, r.unit,
            r.openingWh, r.stats.inbound, r.stats.adjIn, r.stats.whTransfer, r.stats.returnIn, r.stats.returnOut, r.stats.sales, r.stats.allowedShort, r.stats.disallowedShort,
            r.stats.adjOut, r.stats.issueWh, r.stats.transFromSilo, r.whBalance,
            r.openingSilo, r.stats.inSilo, r.stats.controlOut, r.stats.adjInSilo, r.stats.adjOutSilo, r.stats.transSiloOut, r.siloBalance,
            r.totalFactory, r.customFields?.warehouseName || 'مخزن الخامات', r.notes || '-'
        ]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, "PeriodReport");
        XLSX.writeFile(wb, `Raw_Period_Report_${dateRange.start}_to_${dateRange.end}.xlsx`);
    };

    const getCellStyle = (isNumeric: boolean = false, colIdx?: number): React.CSSProperties => {
        const baseWidth = colIdx !== undefined ? (COLUMN_WIDTHS[colIdx] || tableStyles.columnWidth) : tableStyles.columnWidth;
        return {
            fontFamily: isNumeric ? 'Inter, sans-serif' : tableStyles.fontFamily,
            fontSize: isNumeric ? '13px' : `${tableStyles.fontSize}px`,
            fontWeight: tableStyles.isBold ? 'bold' : 'normal',
            textAlign: tableStyles.textAlign,
            verticalAlign: tableStyles.verticalAlign,
            border: '1px solid #000',
            width: `${baseWidth}px`,
            minWidth: `${baseWidth}px`,
            maxWidth: `${baseWidth}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            ...(isNumeric ? forceEnNumsStyle : {})
        };
    };

    const val = (n: any) => {
        const num = parseFloat(n);
        if (isNaN(num) || num === 0) return '-';
        return num.toLocaleString('en-US', { 
            minimumFractionDigits: tableStyles.decimals,
            maximumFractionDigits: tableStyles.decimals
        });
    };

    return (
        <div className="space-y-4 animate-fade-in font-cairo" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="raw_period_report" />}
            
            {/* Unified Premium Header - Combined Title, Dates, and Controls */}
            <div className="bg-gradient-to-l from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] rounded-[2.5rem] border-y-4 border-indigo-500 shadow-2xl p-6 relative overflow-hidden flex flex-col xl:flex-row items-center justify-between gap-6 no-print">
                <div className="absolute top-0 right-0 w-64 h-full bg-indigo-400/5 blur-3xl pointer-events-none"></div>
                
                {/* 1. Title Section */}
                <div className="flex items-center gap-5 relative z-10">
                    <div className="p-4 bg-white/10 rounded-[2rem] backdrop-blur-md border border-white/20 shadow-inner text-yellow-400">
                        <History size={36} strokeWidth={2.5}/>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white drop-shadow-md tracking-tight leading-none mb-1">تقرير الخامات عن مدة</h1>
                        <div className="h-1.5 w-full bg-gradient-to-r from-yellow-400/80 to-transparent rounded-full"></div>
                    </div>
                </div>

                {/* 2. Integrated Date Inputs & Controls */}
                <div className="flex flex-wrap items-center justify-center gap-4 relative z-10">
                    {/* Date Block */}
                    <div className="flex items-center bg-black/30 p-2 rounded-[2rem] border border-white/10 backdrop-blur-sm shadow-inner overflow-hidden">
                        <div className="px-5 border-l border-white/10 text-center">
                            <label className="block text-[9px] font-black text-indigo-200 mb-0.5 uppercase tracking-tighter">التاريخ من</label>
                            <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="bg-transparent text-white font-black outline-none text-[15px]" style={forceEnNumsStyle}/>
                        </div>
                        <div className="px-5 text-center">
                            <label className="block text-[9px] font-black text-indigo-200 mb-0.5 uppercase tracking-tighter">التاريخ إلى</label>
                            <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="bg-transparent text-white font-black outline-none text-[15px]" style={forceEnNumsStyle}/>
                        </div>
                    </div>

                    {/* Action Buttons Block */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => printService.printWindow(tableRef.current?.parentElement?.innerHTML || '')} className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-900 rounded-2xl font-black text-xs shadow-xl hover:bg-yellow-400 hover:text-indigo-950 transition-all active:scale-95 group">
                            <Printer size={18} className="group-hover:rotate-12 transition-transform"/> طباعة
                        </button>
                        <button onClick={handleExport} className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-emerald-600 transition-all active:scale-95">
                            <FileSpreadsheet size={18}/> تصدير Excel
                        </button>

                        {/* Zoom Scale Button */}
                        <div className="relative group">
                            <button className="px-4 py-3 rounded-2xl font-black border bg-white border-slate-300 text-slate-700 transition-all flex items-center gap-2 text-xs hover:bg-slate-50 shadow-sm">
                                <ZoomIn size={18}/>
                                <span>{pageScale}%</span>
                                <ChevronDown size={14}/>
                            </button>
                            <div className="absolute top-full right-0 mt-2 bg-white border rounded-xl shadow-2xl z-[500] hidden group-hover:block p-2 w-28 animate-fade-in">
                                {[100, 90, 80, 70, 60, 50].map(s => (
                                    <button key={s} onClick={() => setPageScale(s)} className={`w-full text-center p-2 rounded-lg font-bold text-xs hover:bg-blue-50 mb-1 last:mb-0 ${pageScale === s ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{s}%</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={() => setShowPrintModal(true)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all shadow-lg border border-white/10">
                            <Settings size={22}/>
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 no-print">
                <div className="relative flex-1">
                    <input className="w-full pr-12 pl-4 py-2.5 border-2 border-slate-50 rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-100 font-bold bg-slate-50 shadow-inner" placeholder="بحث سريع في أسماء الأصناف أو الأكواد..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute right-4 top-3 text-slate-300" size={20}/>
                </div>
                <button onClick={() => setHideZeroRows(!hideZeroRows)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs border transition-all ${hideZeroRows ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-inner' : 'bg-white border-slate-200 text-slate-500'}`}>
                    {hideZeroRows ? <EyeOff size={18}/> : <Eye size={18}/>}
                    {hideZeroRows ? 'إظهار الصفري' : 'إخفاء الصفري'}
                </button>
            </div>

            <TableToolbar styles={tableStyles} setStyles={setTableStyles} onReset={() => setTableStyles(DEFAULT_STYLES)} />

            {/* Main Table */}
            <div className="bg-white rounded-[1.5rem] shadow-premium border-2 border-black overflow-hidden relative">
                <div 
                    className="overflow-auto max-h-[70vh] transition-all duration-300 origin-top-right"
                    style={{ zoom: pageScale / 100 }}
                >
                    <table className="w-full border-collapse" ref={tableRef}>
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-[#1e1b4b] text-yellow-300 h-16 font-black text-[11px] uppercase tracking-tighter shadow-md">
                                {columns.map((col, i) => (
                                    <th key={i} className="p-2 border border-slate-700" style={getCellStyle(false, i)}>{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-gray-900 font-bold">
                            {reportData.map((row, idx) => (
                                <tr key={row.id} className={`border-b border-black hover:bg-indigo-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                    <td className="p-2 border border-black" style={getCellStyle(true, 0)}>{idx + 1}</td>
                                    <td className="p-2 border border-black" style={getCellStyle(false, 1)}>{row.customFields?.tile || '-'}</td>
                                    <td className="p-2 border border-black" style={getCellStyle(false, 2)}>{row.customFields?.stand || '-'}</td>
                                    <td className="p-2 border border-black font-mono" style={getCellStyle(true, 3)}>{row.jdeCode || '-'}</td>
                                    <td className="p-2 border border-black font-mono text-indigo-700" style={getCellStyle(true, 4)}>{row.barcode}</td>
                                    <td className="p-2 border border-black text-right pr-4 text-blue-900 font-black text-md" style={getCellStyle(false, 5)}>{row.name}</td>
                                    <td className="p-2 border border-black" style={getCellStyle(false, 6)}>
                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-100 text-[10px] font-black">{row.category}</span>
                                    </td>
                                    <td className="p-2 border border-black" style={getCellStyle(false, 7)}>{row.unit}</td>
                                    
                                    <td className="p-2 border border-black bg-amber-50 font-black text-[14px] text-amber-900" style={getCellStyle(true, 8)}>{val(row.openingWh)}</td>
                                    <td className="p-2 border border-black text-green-700" style={getCellStyle(true, 9)}>{val(row.stats.inbound)}</td>
                                    <td className="p-2 border border-black text-emerald-600" style={getCellStyle(true, 10)}>{val(row.stats.adjIn)}</td>
                                    <td className="p-2 border border-black text-blue-600" style={getCellStyle(true, 11)}>{val(row.stats.whTransfer)}</td>
                                    <td className="p-2 border border-black text-emerald-700 bg-emerald-50/20" style={getCellStyle(true, 12)}>{val(row.stats.returnIn)}</td>
                                    <td className="p-2 border border-black text-rose-700 bg-rose-50/20" style={getCellStyle(true, 13)}>{val(row.stats.returnOut)}</td>
                                    <td className="p-2 border border-black text-red-600" style={getCellStyle(true, 14)}>{val(row.stats.sales)}</td>
                                    <td className="p-2 border border-black text-orange-600" style={getCellStyle(true, 15)}>{val(row.stats.allowedShort)}</td>
                                    <td className="p-2 border border-black text-rose-700" style={getCellStyle(true, 16)}>{val(row.stats.disallowedShort)}</td>
                                    <td className="p-2 border border-black text-red-700" style={getCellStyle(true, 17)}>{val(row.stats.adjOut)}</td>
                                    <td className="p-2 border border-black text-orange-700" style={getCellStyle(true, 18)}>{val(row.stats.issueWh)}</td>
                                    <td className="p-2 border border-black text-indigo-700 bg-indigo-50/30" style={getCellStyle(true, 19)}>{val(row.stats.transFromSilo)}</td>
                                    <td className="p-2 border border-black bg-blue-100 font-black text-lg" style={getCellStyle(true, 20)}>{val(row.whBalance)}</td>
                                    
                                    <td className="p-2 border border-black bg-amber-50 font-black text-[14px] text-amber-900" style={getCellStyle(true, 21)}>{val(row.openingSilo)}</td>
                                    <td className="p-2 border border-black text-green-700" style={getCellStyle(true, 22)}>{val(row.stats.inSilo)}</td>
                                    <td className="p-2 border border-black text-orange-700" style={getCellStyle(true, 23)}>{val(row.stats.controlOut)}</td>
                                    <td className="p-2 border border-black text-emerald-600" style={getCellStyle(true, 24)}>{val(row.stats.adjInSilo)}</td>
                                    <td className="p-2 border border-black text-red-600" style={getCellStyle(true, 25)}>{val(row.stats.adjOutSilo)}</td>
                                    <td className="p-2 border border-black text-indigo-600" style={getCellStyle(true, 26)}>{val(row.stats.transSiloOut)}</td>
                                    <td className="p-2 border border-black bg-amber-100 font-black text-lg" style={getCellStyle(true, 27)}>{val(row.siloBalance)}</td>
                                    
                                    <td className="p-2 border border-black bg-[#1e1b4b] text-yellow-300 text-2xl font-black shadow-inner" style={getCellStyle(true, 28)}>{val(row.totalFactory)}</td>
                                    <td className="p-2 border border-black text-xs text-slate-500" style={getCellStyle(false, 29)}>{row.customFields?.warehouseName || 'مخزن الخامات'}</td>
                                    <td className="p-2 border border-black text-right text-[10px] italic text-slate-400" style={getCellStyle(false, 30)}>{row.notes || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                <SummaryCard label="إجمالي الوارد في الفترة" value={reportData.reduce((s,r) => s + r.stats.inbound, 0)} color="emerald" icon={<Download size={18}/>}/>
                <SummaryCard label="إجمالي المنصرف" value={reportData.reduce((s,r) => s + r.stats.sales + r.stats.issueWh + r.stats.controlOut, 0)} color="rose" icon={<LogOut size={18}/>}/>
                <SummaryCard label="إجمالي التحويلات" value={reportData.reduce((s,r) => s + r.stats.whTransfer + r.stats.transFromSilo, 0)} color="blue" icon={<ArrowRightLeft size={18}/>}/>
                <SummaryCard label="إجمالي رصيد المصنع" value={reportData.reduce((s,r) => s + r.totalFactory, 0)} color="indigo" icon={<Calculator size={18}/>}/>
            </div>
        </div>
    );
};

const SummaryCard = ({ label, value, color, icon }: any) => {
    const colorClasses: any = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100'
    };
    return (
        <GlassCard className={`p-4 border-2 flex items-center justify-between ${colorClasses[color]} shadow-sm rounded-2xl`}>
            <div>
                <p className="text-[10px] font-black uppercase mb-0.5 opacity-70">{label}</p>
                <h3 className="text-xl font-black" style={forceEnNumsStyle}>{value.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
            </div>
            <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
        </GlassCard>
    );
};

// Internal icon for summary
const LogOut = ({ size, className }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
