
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Search, Printer, Settings, Calendar, Layout, ZoomIn, ChevronDown } from 'lucide-react';
import { printService } from '../services/printing';
import { TableToolbar } from './TableToolbar';
import { ReportActionsBar } from './ReportActionsBar';
import { PrintSettingsModal } from './PrintSettingsModal';
import { WarehouseType } from '../types';
import * as XLSX from 'xlsx';

const DEFAULT_STYLES = {
    fontFamily: 'Calibri, sans-serif',
    fontSize: 12,
    isBold: true,
    isItalic: false,
    textAlign: 'center' as 'right' | 'center' | 'left',
    verticalAlign: 'middle' as 'top' | 'middle' | 'bottom',
    decimals: 2,
    rowHeight: 45,
    columnWidth: 140
};

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontSize: '12px'
};

interface WarehousePeriodReportProps {
    warehouse: WarehouseType;
}

export const WarehousePeriodReport: React.FC<WarehousePeriodReportProps> = ({ warehouse }) => {
    const { settings, products, user } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [pageScale, setPageScale] = useState(100); 
    const [dateFilter, setDateFilter] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const tableRef = useRef<HTMLTableElement>(null);

    const [columnWidths, setColumnWidths] = useState<Record<number, number>>(() => {
        const saved = localStorage.getItem(`glasspos_${warehouse}_period_widths`);
        return saved ? JSON.parse(saved) : {};
    });

    const [tableStyles, setTableStyles] = useState(() => {
        const saved = localStorage.getItem(`glasspos_${warehouse}_period_styles`);
        return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES;
    });

    useEffect(() => {
        localStorage.setItem(`glasspos_${warehouse}_period_widths`, JSON.stringify(columnWidths));
        localStorage.setItem(`glasspos_${warehouse}_period_styles`, JSON.stringify(tableStyles));
    }, [columnWidths, tableStyles, warehouse]);

    const resizingCol = useRef<{ index: number, startX: number, startWidth: number } | null>(null);
    const onMouseMoveResizeCol = useCallback((e: MouseEvent) => {
        const current = resizingCol.current;
        if (!current) return;
        const delta = current.startX - e.pageX; 
        const newWidth = Math.max(50, current.startWidth + delta);
        setColumnWidths(prev => ({ ...prev, [current.index]: newWidth }));
    }, []);

    const onMouseUpResize = useCallback(() => {
        resizingCol.current = null;
        document.removeEventListener('mousemove', onMouseMoveResizeCol);
        document.removeEventListener('mouseup', onMouseUpResize);
        document.body.style.cursor = 'default';
    }, [onMouseMoveResizeCol]);

    const onMouseDownResizeCol = (index: number, e: React.MouseEvent) => {
        e.preventDefault();
        const th = (e.target as HTMLElement).closest('th');
        if (!th) return;
        resizingCol.current = { index, startX: e.pageX, startWidth: th.offsetWidth };
        document.addEventListener('mousemove', onMouseMoveResizeCol);
        document.addEventListener('mouseup', onMouseUpResize);
        document.body.style.cursor = 'col-resize';
    };

    const movements = dbService.getMovements().filter(m => m.warehouse === warehouse);
    const sales = dbService.getSales();

    const reportData = useMemo(() => {
        const warehouseItems = products.filter(p => p.warehouse === warehouse);
        const startDate = new Date(dateFilter.start); startDate.setHours(0,0,0,0);
        const endDate = new Date(dateFilter.end); endDate.setHours(23,59,59,999);

        const itemsWithActivity = new Set<string>();
        movements.forEach(m => {
            if (new Date(m.date) >= startDate && new Date(m.date) <= endDate) {
                (m.items || []).forEach(i => itemsWithActivity.add(i.productId));
            }
        });
        sales.forEach(s => {
            if (new Date(s.date) >= startDate && new Date(s.date) <= endDate) {
                (s.items || []).forEach(i => { if (warehouseItems.some(p => p.id === i.id)) itemsWithActivity.add(i.id); });
            }
        });

        const activeProducts = warehouseItems.filter(p => itemsWithActivity.has(p.id));

        let data = activeProducts.map(p => {
            const row = {
                id: p.id, code: p.barcode, name: p.name, unit: p.unit || 'عدد', 
                opening: 0, inbound: 0, adjIn: 0, issue: 0, sales: 0, adjOut: 0, 
                transfers: 0, returns: 0, closing: 0, 
                warehouseName: p.customFields?.warehouseName || (warehouse === 'parts' ? 'قطع الغيار الرئيسية' : 'مخزن الإعاشة الرئيسي'),
                department: p.customFields?.department || (warehouse === 'catering' ? 'الإدارة العامة' : '-')
            };

            let netChangeFromStartToNow = 0;
            
            const allItemMovements = movements.filter(m => (m.items || []).some(i => i.productId === p.id));
            allItemMovements.forEach(m => {
                const item = (m.items || []).find(i => i.productId === p.id);
                if (!item) return;
                const qty = Number(item.quantity);
                const mDate = new Date(m.date);

                if (mDate >= startDate && mDate <= endDate) {
                    if (m.type === 'in') { if (m.reason?.includes('مرتجع')) row.returns += qty; else row.inbound += qty; } 
                    else if (m.type === 'out') row.issue += qty;
                    else if (m.type === 'transfer') row.transfers += qty;
                    else if (m.type === 'adjustment') { if (m.reason?.includes('عجز') || m.reason?.includes('خصم')) row.adjOut += qty; else row.adjIn += qty; }
                }

                if (mDate >= startDate) {
                    const factor = (m.type === 'in' || (m.type === 'adjustment' && !m.reason?.includes('خصم'))) ? 1 : -1;
                    netChangeFromStartToNow += (qty * factor);
                }
            });

            const allItemSales = sales.filter(s => (s.items || []).some(i => i.id === p.id));
            allItemSales.forEach(s => {
                const item = (s.items || []).find(i => i.id === p.id);
                if (!item) return;
                const qty = Number(item.quantity);
                const sDate = new Date(s.date);
                if (sDate >= startDate && sDate <= endDate) row.sales += qty;
                if (sDate >= startDate) netChangeFromStartToNow -= qty;
            });

            row.opening = p.stock - netChangeFromStartToNow;
            row.closing = row.opening + row.inbound + row.adjIn + row.returns - row.issue - row.sales - row.adjOut - row.transfers;

            return row;
        });

        return data.filter(r => r.name.includes(searchTerm) || r.code.includes(searchTerm));
    }, [products, movements, sales, dateFilter, searchTerm, warehouse]);

    const getCellStyle = (isNumeric: boolean = false, colIdx?: number): React.CSSProperties => ({
        fontFamily: isNumeric ? 'Inter, sans-serif' : tableStyles.fontFamily,
        fontSize: isNumeric ? '12px' : `${tableStyles.fontSize}px`,
        fontWeight: tableStyles.isBold ? 'bold' : 'normal',
        textAlign: tableStyles.textAlign,
        verticalAlign: tableStyles.verticalAlign,
        width: colIdx !== undefined && columnWidths[colIdx] ? `${columnWidths[colIdx]}px` : `${tableStyles.columnWidth}px`,
        minWidth: colIdx !== undefined && columnWidths[colIdx] ? `${columnWidths[colIdx]}px` : `${tableStyles.columnWidth}px`,
        ...(isNumeric ? forceEnNumsStyle : {})
    });

    const formatVal = (n: any) => {
        if (n === null || n === undefined || isNaN(n) || Number(n) === 0) return "-";
        return Number(n).toLocaleString('en-US', { minimumFractionDigits: tableStyles.decimals, maximumFractionDigits: tableStyles.decimals });
    };

    const headers = [
        "م", "كود الصنف", "اسم الصنف", "الوحدة", "رصيد أول للمخازن", "الوارد", 
        "تسوية بالاضافة", "صرف المخازن", "مبيعات", "تسوية بالعجز", 
        "تحويلات المخازن", "المرتجع", "اجمالى رصيد المصنع الان", "اسم المخزن", "الادارة"
    ];

    return (
        <div className="space-y-4 animate-fade-in font-cairo" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="warehouse_period_report" />}
            
            <div className="bg-[#002060] rounded-xl overflow-hidden border-4 border-black shadow-2xl no-print">
                <div className="flex items-stretch h-32">
                    <div className="w-1/3 bg-[#00ffff] border-l-4 border-black flex flex-col items-stretch">
                        <div className="flex-1 flex border-b-2 border-black">
                            <div className="w-1/2 flex items-center justify-center font-black text-xl border-l-2 border-black text-black">التاريخ من</div>
                            <div className="w-1/2 p-2">
                                <input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="w-full h-full bg-transparent border-none text-center font-black text-2xl outline-none text-black" style={forceEnNumsStyle}/>
                            </div>
                        </div>
                        <div className="flex-1 flex">
                            <div className="w-1/2 flex items-center justify-center font-black text-xl border-l-2 border-black text-black">التاريخ الى</div>
                            <div className="w-1/2 p-2">
                                <input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="w-full h-full bg-transparent border-none text-center font-black text-2xl outline-none text-black" style={forceEnNumsStyle}/>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center px-8 relative bg-[#002060]">
                        <h1 className="text-5xl font-black text-yellow-300 drop-shadow-2xl tracking-widest uppercase">التقرير عن مدة {new Date(dateFilter.end).getFullYear()}</h1>
                        <div className="absolute top-4 left-6 flex gap-3">
                             <button onClick={() => setShowPrintModal(true)} className="p-3 bg-white/20 hover:bg-white/40 rounded-xl text-white transition-all shadow-lg"><Settings size={24}/></button>
                             <button onClick={() => printService.printWindow(tableRef.current?.parentElement?.innerHTML || '')} className="p-3 bg-white/20 hover:bg-white/40 rounded-xl text-white transition-all shadow-lg"><Printer size={24}/></button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-300 shadow-sm flex items-center gap-4 no-print">
                <div className="relative flex-1">
                    <input className="w-full pr-12 pl-4 py-3 border-2 border-slate-200 rounded-2xl text-md outline-none focus:ring-4 focus:ring-blue-500/20 font-black bg-slate-50 shadow-inner" placeholder="بحث في الأصناف التي تمت عليها حركة..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute right-4 top-3.5 text-slate-400" size={22}/>
                </div>
                
                {/* Scale Control Button */}
                <div className="relative group">
                    <button className="px-4 h-[52px] rounded-2xl font-black border bg-white border-slate-300 text-slate-700 transition-all flex items-center gap-2 text-xs hover:bg-slate-50 shadow-sm">
                        <ZoomIn size={20}/>
                        <span>حجم العرض: {pageScale}%</span>
                        <ChevronDown size={14}/>
                    </button>
                    <div className="absolute top-full right-0 mt-2 bg-white border rounded-xl shadow-2xl z-[500] hidden group-hover:block p-2 w-32 animate-fade-in">
                        {[100, 90, 80, 70, 60, 50].map(s => (
                            <button key={s} onClick={() => setPageScale(s)} className={`w-full text-center p-2 rounded-lg font-bold text-xs hover:bg-blue-50 mb-1 last:mb-0 ${pageScale === s ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{s}%</button>
                        ))}
                    </div>
                </div>

                <div className="bg-blue-50 px-6 py-3 rounded-2xl border-2 border-blue-200 text-blue-800 font-black shadow-sm flex items-center gap-3">
                    <Layout size={18}/> عدد الأصناف النشطة في الفترة: {reportData.length}
                </div>
            </div>

            <TableToolbar styles={tableStyles} setStyles={setTableStyles} onReset={() => setTableStyles(DEFAULT_STYLES)} />

            <div className="bg-white rounded-[2rem] shadow-premium border-4 border-black overflow-hidden">
                <div 
                    className="overflow-auto max-h-[65vh] transition-all duration-300 origin-top-right"
                    style={{ zoom: pageScale / 100 }}
                >
                    <table className="w-full border-collapse min-w-[3200px]" ref={tableRef}>
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-[#002060] text-yellow-300 font-black h-16 text-lg border-b-2 border-black">
                                {headers.map((h, i) => (
                                    <th key={i} className="p-3 border-x border-black whitespace-nowrap relative group" style={getCellStyle(false, i)}>
                                        {h}
                                        <div 
                                            onMouseDown={(e) => onMouseDownResizeCol(i, e)}
                                            className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-yellow-400/50 transition-colors z-50"
                                        />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-gray-900 font-black">
                            {reportData.map((row, idx) => (
                                <tr key={row.id} className={`h-14 border-b-2 border-black hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                    <td className="p-2 border-x border-black" style={getCellStyle(true, 0)}>{idx + 1}</td>
                                    <td className="p-2 border-x border-black font-mono text-md" style={getCellStyle(true, 1)}>{row.code}</td>
                                    <td className="p-2 border-x border-black text-right pr-8 font-black text-blue-900 text-lg" style={getCellStyle(false, 2)}>{row.name}</td>
                                    <td className="p-2 border-x border-black" style={getCellStyle(false, 3)}>{row.unit}</td>
                                    <td className="p-2 border-x border-black bg-yellow-50/50" style={getCellStyle(true, 4)}>{formatVal(row.opening)}</td>
                                    <td className="p-2 border-x border-black text-green-700 text-lg" style={getCellStyle(true, 5)}>{formatVal(row.inbound)}</td>
                                    <td className="p-2 border-x border-black text-emerald-700 text-lg" style={getCellStyle(true, 6)}>{formatVal(row.adjIn)}</td>
                                    <td className="p-2 border-x border-black text-orange-700 text-lg" style={getCellStyle(true, 7)}>{formatVal(row.issue)}</td>
                                    <td className="p-2 border-x border-black text-blue-600 text-lg" style={getCellStyle(true, 8)}>{formatVal(row.sales)}</td>
                                    <td className="p-2 border-x border-black text-red-600 text-lg" style={getCellStyle(true, 9)}>{formatVal(row.adjOut)}</td>
                                    <td className="p-2 border-x border-black text-indigo-600 text-lg" style={getCellStyle(true, 10)}>{formatVal(row.transfers)}</td>
                                    <td className="p-2 border-x border-black text-rose-600 text-lg" style={getCellStyle(true, 11)}>{formatVal(row.returns)}</td>
                                    <td className="p-2 border-x border-black bg-[#002060] text-yellow-300 text-xl font-black shadow-inner" style={getCellStyle(true, 12)}>{formatVal(row.closing)}</td>
                                    <td className="p-2 border-x border-black text-md text-slate-500" style={getCellStyle(false, 13)}>{row.warehouseName}</td>
                                    <td className="p-2 border-x border-black text-md text-slate-500" style={getCellStyle(false, 14)}>{row.department}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
