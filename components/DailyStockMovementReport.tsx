
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Printer, Search, Eye, EyeOff } from 'lucide-react';
import { printService } from '../services/printing';
import { TableToolbar } from './TableToolbar';
import { ReportActionsBar } from './ReportActionsBar';
import { PrintSettingsModal } from './PrintSettingsModal';
import * as XLSX from 'xlsx';

interface Props {
    title?: string;
    filterCategory?: string;
}

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontSize: '12px'
};

const DEFAULT_STYLES = {
    fontFamily: 'Calibri, sans-serif',
    fontSize: 12,
    isBold: true,
    isItalic: false,
    isUnderline: false,
    textAlign: 'center' as 'right' | 'center' | 'left',
    verticalAlign: 'middle' as 'top' | 'middle' | 'bottom',
    decimals: 3
};

export const DailyStockMovementReport: React.FC<Props> = ({ title = 'تقرير حركة الأصناف (شامل)', filterCategory }) => {
    const { settings, products } = useApp();
    const [dateRange, setDateRange] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [hideZeroRows, setHideZeroRows] = useState(false);
    
    // مفتاح فريد للتقرير
    const PRINT_CONTEXT = filterCategory === 'بيوتولوجى' ? 'movement_petrology' : 'movement_finished';

    const [tableStyles, setTableStyles] = useState(() => {
        const saved = localStorage.getItem(`glasspos_stockmove_${filterCategory}_styles`);
        return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES;
    });

    useEffect(() => { localStorage.setItem(`glasspos_stockmove_${filterCategory}_styles`, JSON.stringify(tableStyles)); }, [tableStyles, filterCategory]);

    const availableProducts = useMemo(() => filterCategory ? products.filter(p => p.category === filterCategory) : products, [products, filterCategory]);

    const reportData = useMemo(() => {
        const allSales = dbService.getSales();
        const allMovements = dbService.getMovements();
        const startDate = new Date(dateRange.start); startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end); endDate.setHours(23, 59, 59, 999);

        let data = availableProducts.map(product => {
            const is25kg = (product.name.includes('25') || product.sackWeight === 25);
            const row = { product, open_bulk: 0, open_50: 0, open_25: 0, prod_bulk: 0, prod_50: 0, prod_25: 0, sale_bulk: 0, sale_50: 0, sale_25: 0, with_bulk: 0, with_50: 0, with_25: 0, close_bulk: 0, close_50: 0, close_25: 0 };
            let hBulk = 0, hPacked = 0;
            
            const processImpact = (q: number, qB: number, qP: number, t: string, n: string) => {
                let bulk = qB, packed = qP;
                if (bulk === 0 && packed === 0) { if (product.unit?.includes('صب')) bulk = q; else packed = q; }
                let mult = (t === 'out' || t === 'sale' || (t === 'adjustment' && (n.includes('عجز') || n.includes('خصم')))) ? -1 : 1;
                return { bulk: bulk * mult, packed: packed * mult };
            };

            allSales.forEach(s => {
                const sDate = new Date(s.date);
                const item = s.items.find(i => i.id === product.id);
                if (item) {
                    const impact = processImpact(item.quantity, item.quantityBulk || 0, item.quantityPacked || 0, 'sale', '');
                    if (sDate < startDate) { hBulk += impact.bulk; hPacked += impact.packed; } 
                    else if (sDate <= endDate) { row.sale_bulk += Math.abs(impact.bulk); if (is25kg) row.sale_25 += Math.abs(impact.packed); else row.sale_50 += Math.abs(impact.packed); }
                }
            });
            allMovements.forEach(m => {
                const mDate = new Date(m.date);
                const item = m.items.find(i => i.productId === product.id);
                if (item) {
                    // Correcting the function call from getImpact to processImpact
                    const impact = processImpact(Number(item.quantity), Number(item.quantityBulk || 0), Number(item.quantityPacked || 0), m.type, (m.reason || '') + (item.notes || ''));
                    if (mDate < startDate) { hBulk += impact.bulk; hPacked += impact.packed; } 
                    else if (mDate <= endDate) { 
                        if (impact.bulk > 0) row.prod_bulk += impact.bulk; else if (impact.bulk < 0) row.with_bulk += Math.abs(impact.bulk); 
                        if (impact.packed > 0) { if (is25kg) row.prod_25 += impact.packed; else row.prod_50 += impact.packed; } else if (impact.packed < 0) { if (is25kg) row.with_25 += Math.abs(impact.packed); else row.with_50 += Math.abs(impact.packed); } 
                    }
                }
            });
            row.open_bulk = (product.stockBulk || 0) + hBulk; 
            if (is25kg) row.open_25 = (product.stockPacked || 0) + hPacked; else row.open_50 = (product.stockPacked || 0) + hPacked;
            row.close_bulk = row.open_bulk + row.prod_bulk - row.sale_bulk - row.with_bulk; 
            row.close_50 = row.open_50 + row.prod_50 - row.sale_50 - row.with_50; 
            row.close_25 = row.open_25 + row.prod_25 - row.sale_25 - row.with_25;
            return row;
        });

        if (hideZeroRows) {
            data = data.filter(row => 
                Math.abs(row.close_bulk) > 0.001 || Math.abs(row.close_50) > 0.001 || Math.abs(row.close_25) > 0.001 ||
                Math.abs(row.prod_bulk) > 0.001 || Math.abs(row.prod_50) > 0.001 || Math.abs(row.prod_25) > 0.001 ||
                Math.abs(row.sale_bulk) > 0.001 || Math.abs(row.sale_50) > 0.001 || Math.abs(row.sale_25) > 0.001
            );
        }

        return data.filter(r => r.product.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [availableProducts, dateRange, searchTerm, hideZeroRows]);

    const handleExport = () => {
        const headers = ['الصنف', 'بداية صب', 'بداية 50', 'بداية 25', 'نهاية صب', 'نهاية 50', 'نهاية 25'];
        const data = reportData.map(row => [row.product.name, row.open_bulk, row.open_50, row.open_25, row.close_bulk, row.close_50, row.close_25]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, "StockMovement");
        XLSX.writeFile(wb, `stock_movement_${dateRange.end}.xlsx`);
    };

    const handlePrint = () => {
        const config = settings.printConfigs[PRINT_CONTEXT] || settings.printConfigs['default'];
        const htmlContent = document.getElementById('stock-move-print')?.innerHTML || '';
        printService.printHtmlContent(config.reportTitle || title, htmlContent, PRINT_CONTEXT, settings, `الفترة من ${dateRange.start} إلى ${dateRange.end}`);
    };

    const getCellStyle = (isNumeric: boolean = false): React.CSSProperties => ({
        fontFamily: isNumeric ? 'Inter, sans-serif' : tableStyles.fontFamily,
        fontSize: isNumeric ? '12px' : `${tableStyles.fontSize}px`,
        fontWeight: tableStyles.isBold ? 'bold' : 'normal',
        fontStyle: tableStyles.isItalic ? 'italic' : 'normal',
        textDecoration: tableStyles.isUnderline ? 'underline' : 'none',
        textAlign: tableStyles.textAlign,
        verticalAlign: tableStyles.verticalAlign,
        ...(isNumeric ? forceEnNumsStyle : {})
    });

    const val = (n: any) => {
        if (n === null || n === undefined || isNaN(n) || Number(n) === 0) return "-";
        return Number(n).toLocaleString('en-US', { minimumFractionDigits: tableStyles.decimals, maximumFractionDigits: tableStyles.decimals });
    };

    return (
        <div className="space-y-4 animate-fade-in" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context={PRINT_CONTEXT} />}
            
            <TableToolbar styles={tableStyles} setStyles={setTableStyles} onReset={() => setTableStyles(DEFAULT_STYLES)} />
            
            <div className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 no-print mb-4 shadow-sm">
                <div className="flex gap-2 flex-1 max-w-2xl">
                    <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-2 border rounded font-bold h-[42px]"/>
                    <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-2 border rounded font-bold h-[42px]"/>
                    <div className="relative flex-1">
                        <input className="w-full px-10 py-2 border rounded font-bold h-[42px]" placeholder="بحث عن صنف..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search className="absolute right-3 top-3 text-gray-400" size={18}/>
                    </div>
                    <button 
                        onClick={() => setHideZeroRows(!hideZeroRows)}
                        className={`px-4 rounded-lg font-bold border transition-all flex items-center gap-2 text-sm ${hideZeroRows ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-white border-gray-200 text-gray-600'}`}
                    >
                        {hideZeroRows ? <EyeOff size={18}/> : <Eye size={18}/>}
                        <span className="hidden md:inline">{hideZeroRows ? 'إظهار الصفري' : 'إخفاء الصفري'}</span>
                    </button>
                </div>
                <ReportActionsBar 
                    onPrint={handlePrint}
                    onExport={handleExport}
                    onSettings={() => setShowPrintModal(true)}
                    hideImport={true}
                />
            </div>

            <div id="stock-move-print" className="bg-white p-2 rounded-xl shadow-lg border border-gray-300 overflow-x-auto">
                <table className="w-full text-center whitespace-nowrap border-collapse border-2 border-black">
                    <thead>
                        <tr className="bg-[#b4c6e7]">
                            <th rowSpan={2} className="p-2 border border-black" style={getCellStyle()}>الصنف</th>
                            <th colSpan={3} className="p-2 border border-black" style={getCellStyle()}>رصيد البداية</th>
                            <th colSpan={3} className="p-2 border border-black" style={getCellStyle()}>إنتاج / وارد</th>
                            <th colSpan={3} className="p-2 border border-black" style={getCellStyle()}>المبيعات</th>
                            <th colSpan={3} className="p-2 border border-black bg-blue-100" style={getCellStyle()}>رصيد النهاية</th>
                        </tr>
                        <tr className="bg-[#b4c6e7]">
                            <th className="p-1 border border-black" style={getCellStyle()}>صب</th><th className="p-1 border border-black" style={getCellStyle()}>50</th><th className="p-1 border border-black" style={getCellStyle()}>25</th>
                            <th className="p-1 border border-black" style={getCellStyle()}>صب</th><th className="p-1 border border-black" style={getCellStyle()}>50</th><th className="p-1 border border-black" style={getCellStyle()}>25</th>
                            <th className="p-1 border border-black" style={getCellStyle()}>صب</th><th className="p-1 border border-black" style={getCellStyle()}>50</th><th className="p-1 border border-black" style={getCellStyle()}>25</th>
                            <th className="p-1 border border-black bg-blue-100" style={getCellStyle()}>صب</th><th className="p-1 border border-black bg-blue-100" style={getCellStyle()}>50</th><th className="p-1 border border-black bg-blue-100" style={getCellStyle()}>25</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-[#d6e3bc]' : 'bg-[#ebf1de]'}>
                                <td className="p-2 border border-black text-right pr-4 font-bold" style={getCellStyle()}>{row.product.name}</td>
                                <td className="p-1 border border-black" style={getCellStyle(true)}>{val(row.open_bulk)}</td>
                                <td className="p-1 border border-black" style={getCellStyle(true)}>{val(row.open_50)}</td>
                                <td className="p-1 border border-black" style={getCellStyle(true)}>{val(row.open_25)}</td>
                                <td className="p-1 border border-black" style={getCellStyle(true)}>{val(row.prod_bulk)}</td>
                                <td className="p-1 border border-black" style={getCellStyle(true)}>{val(row.prod_50)}</td>
                                <td className="p-1 border border-black" style={getCellStyle(true)}>{val(row.prod_25)}</td>
                                <td className="p-1 border border-black" style={getCellStyle(true)}>{val(row.sale_bulk)}</td>
                                <td className="p-1 border border-black" style={getCellStyle(true)}>{val(row.sale_50)}</td>
                                <td className="p-1 border border-black" style={getCellStyle(true)}>{val(row.sale_25)}</td>
                                <td className="p-1 border border-black bg-blue-50/50" style={getCellStyle(true)}>{val(row.close_bulk)}</td>
                                <td className="p-1 border border-black bg-blue-50/50" style={getCellStyle(true)}>{val(row.close_50)}</td>
                                <td className="p-1 border border-black bg-blue-50/50" style={getCellStyle(true)}>{val(row.close_25)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
