
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Search, Eye, EyeOff } from 'lucide-react';
import { printService } from '../services/printing';
import * as XLSX from 'xlsx';
import { PrintSettingsModal } from './PrintSettingsModal';
import { TableToolbar } from './TableToolbar';
import { ReportActionsBar } from './ReportActionsBar';

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

const forceEnNumsStyle = {
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontSize: '12px'
};

export const SalesByItemReport: React.FC = () => {
    const { settings, products } = useApp();
    const [dateFilter, setDateFilter] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [hideZeroRows, setHideZeroRows] = useState(false);
    
    const [tableStyles, setTableStyles] = useState(() => {
        const saved = localStorage.getItem('glasspos_itemrep_styles');
        return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES;
    });

    useEffect(() => { localStorage.setItem('glasspos_itemrep_styles', JSON.stringify(tableStyles)); }, [tableStyles]);

    const sales = dbService.getSales();

    const reportData = useMemo(() => {
        const start = new Date(dateFilter.start); start.setHours(0,0,0,0);
        const end = new Date(dateFilter.end); end.setHours(23,59,59,999);
        const productMap: Record<string, any> = {};

        sales.filter(s => { const d = new Date(s.date); return d >= start && d <= end; })
             .forEach(sale => {
                (sale.items || []).forEach(item => {
                    if (!productMap[item.id]) {
                        const productDef = products.find(p => p.id === item.id) || { barcode: item.barcode, name: item.name };
                        productMap[item.id] = { id: item.id, code: productDef.barcode, name: item.name, bulk_clients: 0, bulk_farms: 0, bulk_total: 0, packed_clients: 0, packed_company: 0, packed_sadat: 0, packed_gifts: 0, packed_total: 0, grand_total: 0 };
                    }
                    const entry = productMap[item.id];
                    const qtyBulk = Number(item.quantityBulk || 0);
                    const qtyPacked = Number(item.quantityPacked || 0);
                    const type = (item.salesType || '').toLowerCase();
                    const customer = (sale.customer || '').toLowerCase();
                    if (qtyBulk > 0) {
                        if (type.includes('مزارع')) entry.bulk_farms += qtyBulk; else entry.bulk_clients += qtyBulk;
                        entry.bulk_total += qtyBulk;
                    }
                    if (qtyPacked > 0) {
                        if (type.includes('مزارع')) entry.packed_company += qtyPacked;
                        else if (type.includes('هدايا')) entry.packed_gifts += qtyPacked;
                        else if (type.includes('منافذ') || type.includes('منفذ') || customer.includes('منفذ') || customer.includes('منافذ')) entry.packed_sadat += qtyPacked;
                        else entry.packed_clients += qtyPacked;
                        entry.packed_total += qtyPacked;
                    }
                    entry.grand_total += (qtyBulk + qtyPacked);
                });
             });

        let data = Object.values(productMap);

        if (hideZeroRows) {
            data = data.filter((row: any) => row.grand_total !== 0);
        }

        return data
            .filter((row: any) => row.name.toLowerCase().includes(searchTerm.toLowerCase()) || row.code.includes(searchTerm))
            .sort((a: any, b: any) => (a.code || '').localeCompare(b.code || ''));
    }, [sales, products, dateFilter, searchTerm, hideZeroRows]);

    const totals = useMemo(() => {
        const t = { bulk_clients: 0, bulk_farms: 0, bulk_total: 0, packed_clients: 0, packed_company: 0, packed_sadat: 0, packed_gifts: 0, packed_total: 0, grand_total: 0 };
        reportData.forEach((row: any) => { t.bulk_clients += row.bulk_clients; t.bulk_farms += row.bulk_farms; t.bulk_total += row.bulk_total; t.packed_clients += row.packed_clients; t.packed_company += row.packed_company; t.packed_sadat += row.packed_sadat; t.packed_gifts += row.packed_gifts; t.packed_total += row.packed_total; t.grand_total += row.grand_total; });
        return t;
    }, [reportData]);

    const handleExport = () => {
        const headers = ['كود الصنف', 'الصنف', 'إجمالي المبيعات', 'إجمالي صب', 'إجمالي معبأ'];
        const data = reportData.map((row: any) => [row.code, row.name, row.grand_total, row.bulk_total, row.packed_total]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, "SalesByItem");
        XLSX.writeFile(wb, `sales_by_item_${dateFilter.end}.xlsx`);
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

    const formatEng = (val: any) => {
        if (val === null || val === undefined || isNaN(val) || Number(val) === 0) return "-";
        return Number(val).toLocaleString('en-US', { minimumFractionDigits: tableStyles.decimals, maximumFractionDigits: tableStyles.decimals });
    };

    return (
        <div className="space-y-4 animate-fade-in" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="sales" />}
            
            <TableToolbar styles={tableStyles} setStyles={setTableStyles} onReset={() => setTableStyles(DEFAULT_STYLES)} />

            <div className="bg-white p-4 rounded-xl border border-blue-100 flex flex-col md:flex-row items-end justify-between gap-4 shadow-sm no-print">
                <div className="flex gap-4 items-end flex-wrap flex-1">
                    <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500">من</label><input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="p-2 border rounded-lg h-[42px]"/></div>
                    <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500">إلى</label><input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="p-2 border rounded-lg h-[42px]"/></div>
                    <div className="relative flex-1"><input className="w-full p-2 pr-8 border rounded-lg h-[42px]" placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/><Search className="absolute right-2 top-3 text-gray-400" size={16}/></div>
                    <button 
                        onClick={() => setHideZeroRows(!hideZeroRows)}
                        className={`px-4 h-[42px] rounded-lg font-bold border transition-all flex items-center gap-2 text-sm ${hideZeroRows ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-white border-gray-200 text-gray-600'}`}
                    >
                        {hideZeroRows ? <EyeOff size={18}/> : <Eye size={18}/>}
                        <span className="hidden md:inline">{hideZeroRows ? 'إظهار الصفري' : 'إخفاء الصفري'}</span>
                    </button>
                </div>
                <ReportActionsBar 
                    onPrint={() => printService.printWindow(document.getElementById('item-rep-print')?.innerHTML || '')}
                    onExport={handleExport}
                    onSettings={() => setShowPrintModal(true)}
                    hideImport={true}
                />
            </div>

            <div id="item-rep-print" className="overflow-x-auto rounded-xl border-2 border-gray-800 shadow-xl bg-white">
                <table className="w-full text-center whitespace-nowrap border-collapse">
                    <thead className="bg-[#1f497d] text-white font-bold">
                        <tr>
                            <th rowSpan={2} className="p-2 border border-white" style={getCellStyle()}>كود الصنف</th>
                            <th rowSpan={2} className="p-2 border border-white" style={getCellStyle()}>الصنف</th>
                            <th rowSpan={2} className="p-2 border border-white bg-[#366092]" style={getCellStyle()}>إجمالي المبيعات</th>
                            <th rowSpan={2} className="p-2 border border-white bg-[#366092]" style={getCellStyle()}>إجمالي الصب</th>
                            <th colSpan={2} className="p-2 border border-white bg-[#366092]" style={getCellStyle()}>تفاصيل الصب</th>
                            <th rowSpan={2} className="p-2 border border-white bg-[#366092]" style={getCellStyle()}>إجمالي المعبأ</th>
                            <th colSpan={5} className="p-2 border border-white bg-[#366092]" style={getCellStyle()}>تفاصيل المعبأ</th>
                        </tr>
                        <tr className="bg-[#538dd5]">
                            <th className="p-2 border border-white" style={getCellStyle()}>عملاء</th><th className="p-2 border border-white" style={getCellStyle()}>مزارع</th>
                            <th className="p-2 border border-white" style={getCellStyle()}>عملاء</th><th className="p-2 border border-white" style={getCellStyle()}>منافذ</th><th className="p-2 border border-white" style={getCellStyle()}>مزارع شركة</th><th className="p-2 border border-white" style={getCellStyle()}>هدايا</th><th className="p-2 border border-white" style={getCellStyle()}>أخرى</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((row: any, idx: number) => (
                            <tr key={idx} className="border-b border-gray-300">
                                <td className="p-2 border-r border-gray-200" style={getCellStyle(true)}>{row.code}</td>
                                <td className="p-2 border-r border-gray-200" style={{...getCellStyle(), textAlign:'right'}}>{row.name}</td>
                                <td className="p-2 border-r border-gray-200 bg-[#e2efda]" style={getCellStyle(true)}>{formatEng(row.grand_total)}</td>
                                <td className="p-2 border-r border-gray-300 bg-[#fff2cc]" style={getCellStyle(true)}>{formatEng(row.bulk_total)}</td>
                                <td className="p-2 border-r border-gray-200" style={getCellStyle(true)}>{row.bulk_clients > 0 ? formatEng(row.bulk_clients) : '-'}</td>
                                <td className="p-2 border-r border-gray-300" style={getCellStyle(true)}>{row.bulk_farms > 0 ? formatEng(row.bulk_farms) : '-'}</td>
                                <td className="p-2 border-r border-gray-300 bg-[#fff2cc]" style={getCellStyle(true)}>{formatEng(row.packed_total)}</td>
                                <td className="p-2 border-r border-gray-300" style={getCellStyle(true)}>{row.packed_clients > 0 ? formatEng(row.packed_clients) : '-'}</td>
                                <td className="p-2 border-r border-gray-300" style={getCellStyle(true)}>{row.packed_sadat > 0 ? formatEng(row.packed_sadat) : '-'}</td>
                                <td className="p-2 border-r border-gray-300" style={getCellStyle(true)}>{row.packed_company > 0 ? formatEng(row.packed_company) : '-'}</td>
                                <td className="p-2 border-r border-gray-300" style={getCellStyle(true)}>{row.packed_gifts > 0 ? formatEng(row.packed_gifts) : '-'}</td>
                                <td className="p-2 border-r border-gray-300">-</td>
                            </tr>
                        ))}
                        <tr className="bg-[#1f497d] text-yellow-300 font-bold text-sm">
                            <td colSpan={2} className="p-2 border border-white" style={getCellStyle()}>الإجمالي الكلي</td>
                            <td className="p-2 border border-white" style={getCellStyle(true)}>{formatEng(totals.grand_total)}</td>
                            <td className="p-2 border border-white" style={getCellStyle(true)}>{formatEng(totals.bulk_total)}</td>
                            <td className="p-2 border border-white" style={getCellStyle(true)}>{formatEng(totals.bulk_clients)}</td>
                            <td className="p-2 border border-white" style={getCellStyle(true)}>{formatEng(totals.bulk_farms)}</td>
                            <td className="p-2 border border-white" style={getCellStyle(true)}>{formatEng(totals.packed_total)}</td>
                            <td className="p-2 border border-white" style={getCellStyle(true)}>{formatEng(totals.packed_clients)}</td>
                            <td className="p-2 border border-white" style={getCellStyle(true)}>{formatEng(totals.packed_sadat)}</td>
                            <td className="p-2 border border-white" style={getCellStyle(true)}>{formatEng(totals.packed_company)}</td>
                            <td className="p-2 border border-white" style={getCellStyle(true)}>{formatEng(totals.packed_gifts)}</td>
                            <td className="p-2 border border-white" style={getCellStyle(true)}>0.000</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
