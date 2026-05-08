
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Product, StockMovement } from '../types';
import { 
    Search, Calendar, Printer, Settings, Eye, EyeOff, 
    FileSpreadsheet, History as HistoryIcon, Layout, Tag, Box, Warehouse, Cylinder, 
    ArrowRightLeft, FileText, ChevronLeft, CalendarDays,
    ChevronRight, ChevronDown, CheckCircle2, Trash2, XCircle, RotateCcw
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
    columnWidth: 120
};

type ReportType = 'sacks' | 'cards' | 'warehouses' | 'silos' | 'general';

export const DailyRawReports: React.FC = () => {
    const { products, settings, t } = useApp();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState<ReportType>('sacks');
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [hideZeroRows, setHideZeroRows] = useState(false);
    const [excludedIds, setExcludedIds] = useState<string[]>([]);
    const tableRef = useRef<HTMLTableElement>(null);

    const excludeItem = (id: string) => {
        setExcludedIds(prev => [...prev, id]);
    };

    const [tableStyles, setTableStyles] = useState(() => {
        const saved = localStorage.getItem('glasspos_daily_raw_styles');
        return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES;
    });

    useEffect(() => {
        localStorage.setItem('glasspos_daily_raw_styles', JSON.stringify(tableStyles));
    }, [tableStyles]);

    const reportData = useMemo(() => {
        // التحقق من صحة التاريخ المختار لمنع RangeError
        const safeDate = selectedDate || new Date().toISOString().split('T')[0];
        const dateObj = new Date(safeDate);
        if (isNaN(dateObj.getTime())) return [];

        const startOfToday = new Date(safeDate); startOfToday.setHours(0,0,0,0);
        const endOfToday = new Date(safeDate); endOfToday.setHours(23,59,59,999);

        const movements = dbService.getMovements().filter(m => m.warehouse === 'raw');

        // دالات مساعدة ذكية للفلترة تبحث في الاسم والتصنيف والمخزن
        const isSack = (p: Product) => {
            const searchStr = `${p.name} ${p.category} ${p.customFields?.warehouseName || ''}`.toLowerCase();
            return searchStr.includes('شكاير') || searchStr.includes('شكارة') || searchStr.includes('sack');
        };
        const isCard = (p: Product) => {
            const searchStr = `${p.name} ${p.category} ${p.customFields?.warehouseName || ''}`.toLowerCase();
            return searchStr.includes('كروت') || searchStr.includes('كارت') || searchStr.includes('card');
        };

        // تصفية المنتجات بناءً على التبويب
        let filteredProducts = products.filter(p => p.warehouse === 'raw' || isSack(p) || isCard(p));
        
        if (activeTab === 'sacks') {
            filteredProducts = filteredProducts.filter(isSack);
        } else if (activeTab === 'cards') {
            filteredProducts = filteredProducts.filter(isCard);
        } else {
            // الخامات العامة والصوامع والمخازن: تستبعد الشكاير والكروت
            filteredProducts = filteredProducts.filter(p => !isSack(p) && !isCard(p));
        }

        // استبعاد الأصناف المختارة يدوياً
        filteredProducts = filteredProducts.filter(p => !excludedIds.includes(p.id));

        let data = filteredProducts.map((p) => {
            const itemMoves = movements.filter(m => (m.items || []).some(i => i.productId === p.id));
            
            const stats = {
                preWh: 0, preSilo: 0,
                inbound: 0, adjIn: 0, transfers: 0, sales: 0, allowedShort: 0, disallowedShort: 0,
                adjOut: 0, issueWh: 0, 
                inSilo: 0, transFromSilo: 0, controlOutPoultry: 0, controlOutDuck: 0, controlOutFish: 0, controlOutPets: 0,
                adjInSilo: 0, adjOutSilo: 0, transSiloOut: 0,
                whTransfer: 0, returnIn: 0, returnOut: 0
            };

            itemMoves.forEach(m => {
                if (!m.date) return;
                const mDate = new Date(m.date);
                if (isNaN(mDate.getTime())) return;

                const item = (m.items || []).find(i => i.productId === p.id);
                if (!item) return;
                const qty = Number(item.quantity) || 0;
                const ctx = m.customFields?.viewContext || '';
                const moveMode = m.customFields?.moveMode || '';

                const isWhImpact = ['raw_in', 'raw_sale', 'wh_adj', 'shortage', 'wh_out', 'wh_transfer', 'raw_return'].includes(ctx);
                const isSiloImpact = ['silo_trans', 'control_out', 'silo_adj'].includes(ctx);

                if (mDate < startOfToday) {
                    let factor = (m.type === 'in' || m.type === 'return' || (m.type === 'adjustment' && !m.reason?.includes('خصم') && !m.reason?.includes('عجز'))) ? 1 : -1;
                    if (isWhImpact) {
                        stats.preWh += (qty * factor);
                        if (ctx === 'wh_out') stats.preSilo += qty;
                    } else if (isSiloImpact) {
                        stats.preSilo += (qty * factor);
                        if (ctx === 'silo_trans' && moveMode === 'in') stats.preWh += qty;
                    }
                }
                else if (mDate <= endOfToday) {
                    const notes = (m.reason || '').toLowerCase();
                    if (ctx === 'wh_out') { stats.issueWh += qty; stats.inSilo += qty; } 
                    else if (ctx === 'wh_transfer') { stats.whTransfer += qty; }
                    else if (ctx === 'silo_trans') {
                        if (moveMode === 'in') stats.transFromSilo += qty; 
                        else if (moveMode === 'out') stats.transSiloOut += qty; 
                        else stats.transfers += qty;
                    }
                    else if (ctx === 'control_out') {
                        if (notes.includes('دواجن') || notes.includes('تسمين')) stats.controlOutPoultry += qty;
                        else if (notes.includes('بط')) stats.controlOutDuck += qty;
                        else if (notes.includes('سمك')) stats.controlOutFish += qty;
                        else if (notes.includes('أليفة') || notes.includes('اليفة')) stats.controlOutPets += qty;
                        else stats.controlOutPoultry += qty;
                    }
                    else if (ctx === 'silo_adj') {
                        if (m.type === 'adjustment' && (m.reason?.includes('خصم') || m.reason?.includes('عجز'))) stats.adjOutSilo += qty;
                        else stats.adjInSilo += qty;
                    }
                    else if (ctx === 'shortage') {
                        if (notes.includes('مسموح')) stats.allowedShort += qty;
                        else stats.disallowedShort += qty;
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
            const closingSilo = openingSilo + stats.inSilo + stats.adjInSilo - (stats.controlOutPoultry + stats.controlOutDuck + stats.controlOutFish + stats.controlOutPets) - stats.adjOutSilo - stats.transSiloOut - stats.transFromSilo;

            return {
                ...p,
                stats,
                openingWh,
                openingSilo,
                closingWh,
                closingSilo,
                totalOpening: openingWh + openingSilo,
                totalClosing: closingWh + closingSilo
            };
        });

        // فلترة الأصفار
        if (hideZeroRows) {
            data = data.filter(r => {
                if (activeTab === 'silos') return Math.abs(r.openingSilo) > 0.001 || Math.abs(r.closingSilo) > 0.001;
                if (activeTab === 'general') return Math.abs(r.totalOpening) > 0.001 || Math.abs(r.totalClosing) > 0.001;
                return Math.abs(r.openingWh) > 0.001 || Math.abs(r.closingWh) > 0.001;
            });
        }

        return data.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [products, selectedDate, activeTab, searchTerm, hideZeroRows, excludedIds]);

    const totals = useMemo(() => {
        const t = {
            opWh: 0, clWh: 0, opSilo: 0, clSilo: 0, opTotal: 0, clTotal: 0,
            in: 0, out: 0, trans: 0, adjIn: 0, adjOut: 0, returns: 0,
            poul: 0, duck: 0, fish: 0, pets: 0, inSilo: 0, whTrans: 0, siloTrans: 0, siloIn: 0, siloOut: 0
        };
        reportData.forEach(r => {
            t.opWh += r.openingWh; t.clWh += r.closingWh;
            t.opSilo += r.openingSilo; t.clSilo += r.closingSilo;
            t.opTotal += r.totalOpening; t.clTotal += r.totalClosing;
            t.in += (r.stats.inbound + r.stats.returnIn);
            t.out += (r.stats.issueWh + r.stats.sales);
            t.adjIn += (r.stats.adjIn + r.stats.adjInSilo);
            t.adjOut += (r.stats.adjOut + r.stats.adjOutSilo + r.stats.allowedShort + r.stats.disallowedShort);
            t.poul += r.stats.controlOutPoultry;
            t.duck += r.stats.controlOutDuck;
            t.fish += r.stats.controlOutFish;
            t.pets += r.stats.controlOutPets;
            t.whTrans += r.stats.whTransfer;
            t.siloTrans += r.stats.transFromSilo;
            t.siloIn += r.stats.inSilo;
            t.siloOut += r.stats.transSiloOut;
        });
        return t;
    }, [reportData]);

    const handleExport = () => {
        if (!tableRef.current) return;
        const ws = XLSX.utils.table_to_sheet(tableRef.current);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DailyReport");
        XLSX.writeFile(wb, `Daily_Raw_Report_${activeTab}_${selectedDate}.xlsx`);
    };

    const getCellStyle = (isNumeric: boolean = false): React.CSSProperties => ({
        fontFamily: isNumeric ? 'Inter, sans-serif' : tableStyles.fontFamily,
        fontSize: isNumeric ? '13px' : `${tableStyles.fontSize}px`,
        fontWeight: tableStyles.isBold ? 'bold' : 'normal',
        textAlign: tableStyles.textAlign,
        verticalAlign: tableStyles.verticalAlign,
        border: '1px solid #000',
        ...(isNumeric ? forceEnNumsStyle : {})
    });

    const val = (n: number) => n === 0 ? '-' : n.toLocaleString('en-US', { minimumFractionDigits: tableStyles.decimals });

    const dayName = new Date(selectedDate || new Date()).toLocaleDateString('ar-EG', { weekday: 'long' });

    return (
        <div className="space-y-6 animate-fade-in font-cairo" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="daily_raw_report" />}
            
            <div className="bg-[#1e1b4b] rounded-[2.5rem] p-8 shadow-2xl border-b-8 border-indigo-500 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-full bg-white/5 blur-3xl pointer-events-none"></div>
                
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md border border-white/20 text-yellow-400">
                            <CalendarDays size={40}/>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white mb-2">سجل التقارير اليومية</h1>
                            <div className="flex items-center gap-3">
                                <span className="bg-indigo-600 text-white px-4 py-1 rounded-xl font-bold text-sm shadow-lg">{dayName}</span>
                                <input 
                                    type="date" 
                                    value={selectedDate} 
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="bg-white/10 text-white font-black p-2 rounded-xl outline-none border border-white/20 text-center"
                                    style={forceEnNumsStyle}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 bg-black/30 p-2 rounded-[2rem] border border-white/10 backdrop-blur-sm shadow-inner">
                        <ReportTab active={activeTab === 'sacks'} onClick={() => setActiveTab('sacks')} icon={<Box size={18}/>} label="تقرير الشكاير"/>
                        <ReportTab active={activeTab === 'cards'} onClick={() => setActiveTab('cards')} icon={<Tag size={18}/>} label="تقرير الكروت"/>
                        <ReportTab active={activeTab === 'warehouses'} onClick={() => setActiveTab('warehouses')} icon={<Warehouse size={18}/>} label="تقرير المخازن"/>
                        <ReportTab active={activeTab === 'silos'} onClick={() => setActiveTab('silos')} icon={<Cylinder size={18}/>} label="تقرير الصوامع"/>
                        <ReportTab active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={<Layout size={18}/>} label="الخامات العام"/>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-4 no-print bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 flex-1 max-w-2xl">
                    <div className="relative flex-1">
                        <input 
                            className="w-full pr-12 pl-4 py-2.5 border-2 border-slate-50 rounded-xl text-sm font-bold bg-slate-50 outline-none focus:ring-4 focus:ring-indigo-100 shadow-inner" 
                            placeholder="بحث في محتوى التقرير..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                        <Search className="absolute right-4 top-3 text-slate-300" size={20}/>
                    </div>
                    
                    <button 
                        onClick={() => setHideZeroRows(!hideZeroRows)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs border transition-all ${hideZeroRows ? 'bg-orange-100 border-orange-200 text-orange-700 shadow-inner' : 'bg-white border-slate-200 text-slate-500'}`}
                    >
                        {hideZeroRows ? <EyeOff size={18}/> : <Eye size={18}/>}
                        {hideZeroRows ? 'إظهار الصفري' : 'إخفاء الصفري'}
                    </button>

                    {excludedIds.length > 0 && (
                        <button 
                            onClick={() => setExcludedIds([])}
                            className="flex items-center gap-2 px-6 py-2.5 bg-rose-50 text-rose-600 rounded-xl font-black text-xs border border-rose-100 hover:bg-rose-100 transition-all shadow-sm"
                        >
                            <RotateCcw size={16}/> استعادة {excludedIds.length} صنف
                        </button>
                    )}
                </div>

                <div className="flex gap-2">
                    <button onClick={() => printService.printWindow(tableRef.current?.parentElement?.innerHTML || '')} className="flex items-center gap-2 px-6 py-2.5 bg-white text-indigo-900 rounded-xl font-black text-xs shadow-xl hover:bg-yellow-400 transition-all border border-slate-100">
                        <Printer size={18}/> طباعة
                    </button>
                    <button onClick={handleExport} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-xl hover:bg-emerald-700 transition-all">
                        <FileSpreadsheet size={18}/> تصدير Excel
                    </button>
                    <button onClick={() => setShowPrintModal(true)} className="p-2.5 bg-white/50 hover:bg-white rounded-xl text-slate-400 transition-all shadow-sm border border-slate-100">
                        <Settings size={20}/>
                    </button>
                </div>
            </div>

            <TableToolbar styles={tableStyles} setStyles={setTableStyles} onReset={() => setTableStyles(DEFAULT_STYLES)} />

            <div className="bg-white rounded-[2rem] shadow-premium border-2 border-black overflow-hidden relative">
                <div className="overflow-auto max-h-[60vh]">
                    <table className="w-full border-collapse" ref={tableRef}>
                        <thead className="sticky top-0 z-20">
                            {activeTab === 'sacks' && <SacksHeader styles={getCellStyle()} />}
                            {activeTab === 'cards' && <CardsHeader styles={getCellStyle()} />}
                            {activeTab === 'general' && <GeneralHeader styles={getCellStyle()} />}
                            {activeTab === 'silos' && <SilosHeader styles={getCellStyle()} />}
                            {activeTab === 'warehouses' && <WarehousesHeader styles={getCellStyle()} />}
                        </thead>
                        <tbody className="text-gray-900 font-bold">
                            {reportData.map((row, idx) => (
                                <tr key={row.id} className={`border-b border-black hover:bg-indigo-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                    {activeTab === 'sacks' && <SacksRow row={row} idx={idx} styles={getCellStyle(true)} format={val} onExclude={() => excludeItem(row.id)}/>}
                                    {activeTab === 'cards' && <CardsRow row={row} idx={idx} styles={getCellStyle(true)} format={val} onExclude={() => excludeItem(row.id)}/>}
                                    {activeTab === 'general' && <GeneralRow row={row} idx={idx} styles={getCellStyle(true)} format={val} onExclude={() => excludeItem(row.id)}/>}
                                    {activeTab === 'silos' && <SilosRow row={row} idx={idx} styles={getCellStyle(true)} format={val} onExclude={() => excludeItem(row.id)}/>}
                                    {activeTab === 'warehouses' && <WarehousesRow row={row} idx={idx} styles={getCellStyle(true)} format={val} onExclude={() => excludeItem(row.id)}/>}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 bg-[#002060] text-yellow-300 font-black border-t-2 border-black h-12">
                             {activeTab === 'sacks' && <SacksFooter totals={totals} styles={getCellStyle(true)} format={val} />}
                             {activeTab === 'cards' && <CardsFooter totals={totals} styles={getCellStyle(true)} format={val} />}
                             {activeTab === 'general' && <GeneralFooter totals={totals} styles={getCellStyle(true)} format={val} />}
                             {activeTab === 'silos' && <SilosFooter totals={totals} styles={getCellStyle(true)} format={val} />}
                             {activeTab === 'warehouses' && <WarehousesFooter totals={totals} styles={getCellStyle(true)} format={val} />}
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- Sub-components for Row Rendering ---

const ReportTab = ({ active, onClick, icon, label }: any) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-6 py-2 rounded-full font-black text-sm transition-all ${active ? 'bg-white text-indigo-900 shadow-xl scale-105' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
        {icon} {label}
    </button>
);

// 1. Sacks Report
const SacksHeader = ({ styles }: any) => (
    <tr className="bg-[#002060] text-yellow-300 h-14 font-black text-[12px] uppercase">
        <th className="p-2" style={styles}>م</th>
        <th className="p-2" style={styles}>كود JDE</th>
        <th className="p-2 text-right pr-6" style={styles}>اسم الصنف</th>
        <th className="p-2 bg-blue-900" style={styles}>رصيد أول اليوم</th>
        <th className="p-2" style={styles}>الوارد</th>
        <th className="p-2" style={styles}>منصرف دواجن</th>
        <th className="p-2" style={styles}>التحويلات</th>
        <th className="p-2" style={styles}>تحويلات الصوامع</th>
        <th className="p-2 bg-indigo-900" style={styles}>رصيد آخر اليوم</th>
        <th className="p-2 no-print" style={styles}>إجراء</th>
    </tr>
);
const SacksRow = ({ row, idx, styles, format, onExclude }: any) => (
    <>
        <td className="p-2" style={styles}>{idx + 1}</td>
        <td className="p-2" style={styles}>{row.jdeCode}</td>
        <td className="p-2 text-right pr-4" style={styles}>{row.name}</td>
        <td className="p-2 bg-blue-50" style={styles}>{format(row.openingWh)}</td>
        <td className="p-2 text-green-700" style={styles}>{format(row.stats.inbound)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.issueWh)}</td>
        <td className="p-2" style={styles}>{format(row.stats.whTransfer)}</td>
        <td className="p-2" style={styles}>{format(row.stats.transFromSilo)}</td>
        <td className="p-2 bg-indigo-50 font-black text-lg" style={styles}>{format(row.closingWh)}</td>
        <td className="p-2 no-print" style={styles}>
            <button onClick={onExclude} className="text-slate-300 hover:text-rose-500 transition-colors" title="استبعاد"><XCircle size={16}/></button>
        </td>
    </>
);
const SacksFooter = ({ totals, styles, format }: any) => (
    <tr>
        <td colSpan={3} className="text-right pr-10" style={styles}>الإجمالي الكلي</td>
        <td style={styles}>{format(totals.opWh)}</td>
        <td style={styles}>{format(totals.in)}</td>
        <td style={styles}>{format(totals.out)}</td>
        <td style={styles}>{format(totals.whTrans)}</td>
        <td style={styles}>{format(totals.siloTrans)}</td>
        <td style={styles} className="text-lg">{format(totals.clWh)}</td>
        <td className="no-print"></td>
    </tr>
);

// 2. Cards Report
const CardsHeader = ({ styles }: any) => (
    <tr className="bg-[#002060] text-yellow-300 h-14 font-black text-[12px] uppercase">
        <th className="p-2" style={styles}>م</th>
        <th className="p-2" style={styles}>كود JDE</th>
        <th className="p-2 text-right pr-6" style={styles}>اسم الصنف</th>
        <th className="p-2" style={styles}>كود التشغيلة</th>
        <th className="p-2 bg-blue-900" style={styles}>رصيد أول اليوم</th>
        <th className="p-2" style={styles}>الوارد</th>
        <th className="p-2" style={styles}>تسويات بالاضافة</th>
        <th className="p-2" style={styles}>المنصرف</th>
        <th className="p-2" style={styles}>التحويلات</th>
        <th className="p-2" style={styles}>تسويات بالخصم</th>
        <th className="p-2 bg-indigo-900" style={styles}>رصيد آخر اليوم</th>
        <th className="p-2 no-print" style={styles}>إجراء</th>
    </tr>
);
const CardsRow = ({ row, idx, styles, format, onExclude }: any) => (
    <>
        <td className="p-2" style={styles}>{idx + 1}</td>
        <td className="p-2 font-mono" style={styles}>{row.jdeCode}</td>
        <td className="p-2 text-right pr-4" style={styles}>{row.name}</td>
        <td className="p-2 text-xs" style={styles}>{row.notes || '-'}</td>
        <td className="p-2 bg-blue-50" style={styles}>{format(row.openingWh)}</td>
        <td className="p-2 text-green-700" style={styles}>{format(row.stats.inbound)}</td>
        <td className="p-2 text-emerald-600" style={styles}>{format(row.stats.adjIn)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.issueWh + row.stats.sales)}</td>
        <td className="p-2" style={styles}>{format(row.stats.whTransfer)}</td>
        <td className="p-2 text-red-700" style={styles}>{format(row.stats.adjOut)}</td>
        <td className="p-2 bg-indigo-50 font-black text-lg" style={styles}>{format(row.closingWh)}</td>
        <td className="p-2 no-print" style={styles}>
            <button onClick={onExclude} className="text-slate-300 hover:text-rose-500 transition-colors" title="استبعاد"><XCircle size={16}/></button>
        </td>
    </>
);
const CardsFooter = ({ totals, styles, format }: any) => (
    <tr>
        <td colSpan={4} className="text-right pr-10" style={styles}>الإجمالي الكلي</td>
        <td style={styles}>{format(totals.opWh)}</td>
        <td style={styles}>{format(totals.in)}</td>
        <td style={styles}>{format(totals.adjIn)}</td>
        <td style={styles}>{format(totals.out)}</td>
        <td style={styles}>{format(totals.whTrans)}</td>
        <td style={styles}>{format(totals.adjOut)}</td>
        <td style={styles} className="text-lg">{format(totals.clWh)}</td>
        <td className="no-print"></td>
    </tr>
);

// 3. General Header
const GeneralHeader = ({ styles }: any) => (
    <tr className="bg-[#002060] text-yellow-300 h-14 font-black text-[11px] uppercase">
        <th className="p-2" style={styles}>م</th>
        <th className="p-2" style={styles}>كود الصنف</th>
        <th className="p-2 text-right pr-6" style={styles}>اسم الصنف</th>
        <th className="p-2 bg-blue-900" style={styles}>رصيد أول اليوم</th>
        <th className="p-2" style={styles}>الوارد</th>
        <th className="p-2" style={styles}>منصرف دواجن</th>
        <th className="p-2" style={styles}>منصرف بط</th>
        <th className="p-2" style={styles}>منصرف سمك</th>
        <th className="p-2" style={styles}>منصرف أليفة</th>
        <th className="p-2" style={styles}>تسويات (+)</th>
        <th className="p-2" style={styles}>تسويات (-)</th>
        <th className="p-2" style={styles}>المبيعات</th>
        <th className="p-2" style={styles}>تحويلات المخازن</th>
        <th className="p-2" style={styles}>تحويلات الصوامع</th>
        <th className="p-2 bg-indigo-900" style={styles}>إجمالي المصنع الآن</th>
        <th className="p-2 no-print" style={styles}>إجراء</th>
    </tr>
);
const GeneralRow = ({ row, idx, styles, format, onExclude }: any) => (
    <>
        <td className="p-2" style={styles}>{idx + 1}</td>
        <td className="p-2 font-mono text-xs" style={styles}>{row.barcode}</td>
        <td className="p-2 text-right pr-4" style={styles}>{row.name}</td>
        <td className="p-2 bg-blue-50" style={styles}>{format(row.totalOpening)}</td>
        <td className="p-2 text-green-700" style={styles}>{format(row.stats.inbound + row.stats.returnIn)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.controlOutPoultry)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.controlOutDuck)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.controlOutFish)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.controlOutPets)}</td>
        <td className="p-2 text-emerald-600" style={styles}>{format(row.stats.adjIn + row.stats.adjInSilo)}</td>
        <td className="p-2 text-red-700" style={styles}>{format(row.stats.adjOut + row.stats.adjOutSilo + row.stats.allowedShort + row.stats.disallowedShort)}</td>
        <td className="p-2 text-blue-600" style={styles}>{format(row.stats.sales)}</td>
        <td className="p-2" style={styles}>{format(row.stats.whTransfer)}</td>
        <td className="p-2" style={styles}>{format(row.stats.transSiloOut)}</td>
        <td className="p-2 bg-[#002060] text-yellow-300 text-lg shadow-inner font-black" style={styles}>{format(row.totalClosing)}</td>
        <td className="p-2 no-print" style={styles}>
            <button onClick={onExclude} className="text-slate-300 hover:text-rose-500 transition-colors" title="استبعاد"><XCircle size={16}/></button>
        </td>
    </>
);
const GeneralFooter = ({ totals, styles, format }: any) => (
    <tr>
        <td colSpan={3} className="text-right pr-10" style={styles}>الإجمالي الكلي</td>
        <td style={styles}>{format(totals.opTotal)}</td>
        <td style={styles}>{format(totals.in)}</td>
        <td style={styles}>{format(totals.poul)}</td>
        <td style={styles}>{format(totals.duck)}</td>
        <td style={styles}>{format(totals.fish)}</td>
        <td style={styles}>{format(totals.pets)}</td>
        <td style={styles}>{format(totals.adjIn)}</td>
        <td style={styles}>{format(totals.adjOut)}</td>
        <td style={styles}>-</td>
        <td style={styles}>{format(totals.whTrans)}</td>
        <td style={styles}>{format(totals.siloOut)}</td>
        <td style={styles} className="text-lg">{format(totals.clTotal)}</td>
        <td className="no-print"></td>
    </tr>
);

// 4. Silos Report
const SilosHeader = ({ styles }: any) => (
    <tr className="bg-[#002060] text-yellow-300 h-14 font-black text-[12px] uppercase">
        <th className="p-2" style={styles}>م</th>
        <th className="p-2" style={styles}>كود JDE</th>
        <th className="p-2 text-right pr-6" style={styles}>اسم الصنف</th>
        <th className="p-2 bg-blue-900" style={styles}>رصيد أول اليوم</th>
        <th className="p-2" style={styles}>الوارد</th>
        <th className="p-2" style={styles}>منصرف دواجن</th>
        <th className="p-2" style={styles}>منصرف بط</th>
        <th className="p-2" style={styles}>منصرف سمك</th>
        <th className="p-2" style={styles}>منصرف أليفة</th>
        <th className="p-2" style={styles}>تسويات صوامع (+)</th>
        <th className="p-2" style={styles}>تسويات صوامع (-)</th>
        <th className="p-2" style={styles}>تحويلات صوامع</th>
        <th className="p-2 bg-indigo-900" style={styles}>رصيد الصوامع</th>
        <th className="p-2 no-print" style={styles}>إجراء</th>
    </tr>
);
const SilosRow = ({ row, idx, styles, format, onExclude }: any) => (
    <>
        <td className="p-2" style={styles}>{idx + 1}</td>
        <td className="p-2 font-mono" style={styles}>{row.jdeCode}</td>
        <td className="p-2 text-right pr-4" style={styles}>{row.name}</td>
        <td className="p-2 bg-blue-50" style={styles}>{format(row.openingSilo)}</td>
        <td className="p-2 text-green-700" style={styles}>{format(row.stats.inSilo)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.controlOutPoultry)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.controlOutDuck)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.controlOutFish)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.controlOutPets)}</td>
        <td className="p-2 text-emerald-600" style={styles}>{format(row.stats.adjInSilo)}</td>
        <td className="p-2 text-red-700" style={styles}>{format(row.stats.adjOutSilo)}</td>
        <td className="p-2" style={styles}>{format(row.stats.transSiloOut)}</td>
        <td className="p-2 bg-indigo-50 font-black text-lg" style={styles}>{format(row.closingSilo)}</td>
        <td className="p-2 no-print" style={styles}>
            <button onClick={onExclude} className="text-slate-300 hover:text-rose-500 transition-colors" title="استبعاد"><XCircle size={16}/></button>
        </td>
    </>
);
const SilosFooter = ({ totals, styles, format }: any) => (
    <tr>
        <td colSpan={3} className="text-right pr-10" style={styles}>الإجمالي الكلي</td>
        <td style={styles}>{format(totals.opSilo)}</td>
        <td style={styles}>{format(totals.siloIn)}</td>
        <td style={styles}>{format(totals.poul)}</td>
        <td style={styles}>{format(totals.duck)}</td>
        <td style={styles}>{format(totals.fish)}</td>
        <td style={styles}>{format(totals.pets)}</td>
        <td style={styles}>{format(totals.adjIn)}</td>
        <td style={styles}>{format(totals.adjOut)}</td>
        <td style={styles}>{format(totals.siloOut)}</td>
        <td style={styles} className="text-lg">{format(totals.clSilo)}</td>
        <td className="no-print"></td>
    </tr>
);

// 5. Warehouses Report
const WarehousesHeader = ({ styles }: any) => (
    <tr className="bg-[#002060] text-yellow-300 h-14 font-black text-[12px] uppercase">
        <th className="p-2" style={styles}>م</th>
        <th className="p-2" style={styles}>كود JDE</th>
        <th className="p-2 text-right pr-6" style={styles}>اسم الصنف</th>
        <th className="p-2 bg-blue-900" style={styles}>رصيد أول اليوم</th>
        <th className="p-2" style={styles}>الوارد</th>
        <th className="p-2" style={styles}>تسوية بالاضافة</th>
        <th className="p-2" style={styles}>المنصرف كنترول</th>
        <th className="p-2" style={styles}>تسوية بالعجز</th>
        <th className="p-2" style={styles}>تحويلات المخازن</th>
        <th className="p-2" style={styles}>المبيعات</th>
        <th className="p-2 bg-indigo-900" style={styles}>رصيد المخازن</th>
        <th className="p-2 no-print" style={styles}>إجراء</th>
    </tr>
);
const WarehousesRow = ({ row, idx, styles, format, onExclude }: any) => (
    <>
        <td className="p-2" style={styles}>{idx + 1}</td>
        <td className="p-2 font-mono" style={styles}>{row.jdeCode}</td>
        <td className="p-2 text-right pr-4" style={styles}>{row.name}</td>
        <td className="p-2 bg-blue-50" style={styles}>{format(row.openingWh)}</td>
        <td className="p-2 text-green-700" style={styles}>{format(row.stats.inbound + row.stats.returnIn)}</td>
        <td className="p-2 text-emerald-600" style={styles}>{format(row.stats.adjIn)}</td>
        <td className="p-2 text-red-600" style={styles}>{format(row.stats.issueWh)}</td>
        <td className="p-2 text-red-700" style={styles}>{format(row.stats.adjOut + row.stats.allowedShort + row.stats.disallowedShort)}</td>
        <td className="p-2" style={styles}>{format(row.stats.whTransfer)}</td>
        <td className="p-2 text-blue-600" style={styles}>{format(row.stats.sales)}</td>
        <td className="p-2 bg-indigo-50 font-black text-lg" style={styles}>{format(row.closingWh)}</td>
        <td className="p-2 no-print" style={styles}>
            <button onClick={onExclude} className="text-slate-300 hover:text-rose-500 transition-colors" title="استبعاد"><XCircle size={16}/></button>
        </td>
    </>
);
const WarehousesFooter = ({ totals, styles, format }: any) => (
    <tr>
        <td colSpan={3} className="text-right pr-10" style={styles}>الإجمالي الكلي</td>
        <td style={styles}>{format(totals.opWh)}</td>
        <td style={styles}>{format(totals.in)}</td>
        <td style={styles}>{format(totals.adjIn)}</td>
        <td style={styles}>{format(totals.out)}</td>
        <td style={styles}>{format(totals.adjOut)}</td>
        <td style={styles}>{format(totals.whTrans)}</td>
        <td style={styles}>-</td>
        <td style={styles} className="text-lg">{format(totals.clWh)}</td>
        <td className="no-print"></td>
    </tr>
);
