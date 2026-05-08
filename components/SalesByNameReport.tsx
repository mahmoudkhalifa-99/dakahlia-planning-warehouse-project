
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Search, Eye, EyeOff, LayoutList } from 'lucide-react';
import { printService } from '../services/printing';
import { TableToolbar } from './TableToolbar';
import { ReportActionsBar } from './ReportActionsBar';
import { PrintSettingsModal } from './PrintSettingsModal';
import { excelService } from '../services/excelExport';
import * as XLSX from 'xlsx';

interface Props {
    filterCategory?: string;
    title?: string;
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

export const SalesByNameReport: React.FC<Props> = ({ filterCategory, title }) => {
    const { settings, products } = useApp();
    const [dateFilter, setDateFilter] = useState({ date: new Date().toISOString().split('T')[0] });
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [hideZeroRows, setHideZeroRows] = useState(false);
    
    const PRINT_CONTEXT = filterCategory === 'بيوتولوجى' ? 'sales_petrology' : 'sales_finished_products';

    const [tableStyles, setTableStyles] = useState(() => {
        const saved = localStorage.getItem(`glasspos_salesbyname_${filterCategory}_styles`);
        return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES;
    });

    useEffect(() => { localStorage.setItem(`glasspos_salesbyname_${filterCategory}_styles`, JSON.stringify(tableStyles)); }, [tableStyles, filterCategory]);

    const sales = dbService.getSales();

    const reportData = useMemo(() => {
        const targetDate = new Date(dateFilter.date); targetDate.setHours(0,0,0,0);
        let data = sales.filter(s => { 
            const d = new Date(s.date); 
            d.setHours(0,0,0,0); 
            return d.getTime() === targetDate.getTime(); 
        }).flatMap(sale => {
            // تصفية صارمة: فصل مبيعات الأعلاف عن البيوتولوجى
            const filteredItems = sale.items.filter(item => {
                if (!filterCategory) return true;
                
                const itemCat = (item.category || '').trim();
                const targetCat = filterCategory.trim();

                if (targetCat === 'بيوتولوجى') {
                    return itemCat === 'بيوتولوجى';
                }
                
                if (targetCat === 'أعلاف') {
                    // الأعلاف هي الأساس ولكن نستبعد البيوتولوجى صراحة
                    return itemCat === 'أعلاف' || (itemCat !== 'بيوتولوجى' && itemCat !== 'خامات');
                }

                return itemCat === targetCat;
            });

            return filteredItems.map(item => ({
                shift: sale.shift || 'الأولى', 
                invoiceId: sale.id, 
                customerName: sale.customer || 'نقدي', 
                customerCode: sale.customerCode || '-',
                itemName: item.name, 
                qtyPacked: item.quantityPacked || 0, 
                qtyBulk: item.quantityBulk || 0, 
                prodDate: item.productionDate || '-', 
                transport: sale.transportMethod || 'وصال',
                feedType: item.feedType || '-',
                salesType: item.salesType || 'عادي',
                jdeCode: item.jdeCode || item.jdeCodePacked || item.jdeCodeBulk || '-'
            }));
        }).filter(r => r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || r.itemName.toLowerCase().includes(searchTerm.toLowerCase()));

        if (hideZeroRows) {
            data = data.filter(row => row.qtyPacked !== 0 || row.qtyBulk !== 0);
        }
        return data;
    }, [sales, dateFilter, searchTerm, filterCategory, hideZeroRows]);

    const summaryBuckets = useMemo(() => {
        const isPetrology = filterCategory === 'بيوتولوجى';
        
        // تجهيز الدلاء (Buckets) بناءً على القطاع
        const buckets: any = {
            clients: { p: [], b: [], total: 0, label: isPetrology ? 'مبيعات بيوتولوجى (عملاء)' : 'مبيعات العملاء' },
            farms: { p: [], b: [], total: 0, label: isPetrology ? 'مبيعات بيوتولوجى (مزارع)' : 'مبيعات المزارع' }
        };

        // إضافة دلاء خاصة بالأعلاف فقط إذا لم نكن في وضع البيوتولوجى
        if (!isPetrology) {
            buckets.outlets = { p: [], b: [], total: 0, label: 'تحويلات منافذ', isYellow: true };
            buckets.aqua = { p: [], b: [], total: 0, label: 'مبيعات العملاء اكوا' };
        }

        reportData.forEach(row => {
            const name = (row.itemName || '').toLowerCase();
            const type = (row.salesType || '').toLowerCase();
            const customer = (row.customerName || '').toLowerCase();

            let target = 'clients';
            
            if (!isPetrology && name.includes('اكوا')) target = 'aqua';
            else if (!isPetrology && (type.includes('منافذ') || type.includes('منفذ') || customer.includes('منفذ') || customer.includes('منافذ'))) target = 'outlets';
            else if (type.includes('مزارع')) target = 'farms';

            if (buckets[target]) {
                if (row.qtyPacked > 0) buckets[target].p.push(row);
                if (row.qtyBulk > 0) buckets[target].b.push(row);
                buckets[target].total += (row.qtyPacked + row.qtyBulk);
            } else {
                // Fallback to clients if bucket missing
                if (row.qtyPacked > 0) buckets.clients.p.push(row);
                if (row.qtyBulk > 0) buckets.clients.b.push(row);
                buckets.clients.total += (row.qtyPacked + row.qtyBulk);
            }
        });

        return Object.fromEntries(Object.entries(buckets).filter(([_, b]: any) => b.total > 0 || b.label.includes('مبيعات')));
    }, [reportData, filterCategory]);

    const totals = useMemo(() => reportData.reduce((acc, r) => ({ p: acc.p + r.qtyPacked, b: acc.b + r.qtyBulk }), { p: 0, b: 0 }), [reportData]);

    const handleExport = () => {
        const headers = ['الوردية', 'رقم الفاتورة', 'العميل', 'الصنف', 'نوع العلف', 'معبأ', 'صب', 'ت. الانتاج', 'طريقة النقل'];
        const data = reportData.map(row => [row.shift, row.invoiceId, row.customerName, row.itemName, row.feedType, row.qtyPacked, row.qtyBulk, row.prodDate, row.transport]);
        
        // Add total row
        data.push([
            'إجمالي مبيعات ' + (filterCategory || 'الكل'), '', '', '', '', totals.p, totals.b, '', ''
        ]);

        excelService.exportStyledTable(title || `تقرير مبيعات ${filterCategory || 'الكل'}`, headers, data, `Sales_${filterCategory || 'All'}_${dateFilter.date}`);
    };

    const handlePrint = () => {
        const config = settings.printConfigs[PRINT_CONTEXT] || settings.printConfigs['default'];
        const htmlContent = document.getElementById('sales-by-name-area')?.innerHTML || '';
        printService.printHtmlContent(config.reportTitle || title || 'تقرير المبيعات التفصيلي', htmlContent, PRINT_CONTEXT, settings, `التاريخ: ${dateFilter.date}`);
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
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context={PRINT_CONTEXT} />}
            
            <TableToolbar styles={tableStyles} setStyles={setTableStyles} onReset={() => setTableStyles(DEFAULT_STYLES)} />
            
            <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 no-print mb-4 shadow-sm">
                <div className="flex gap-2 flex-1 max-w-2xl">
                    <input type="date" value={dateFilter.date} onChange={e => setDateFilter({date: e.target.value})} className="p-2 border rounded font-bold h-[42px]"/>
                    <div className="relative flex-1">
                        <input className="w-full px-10 py-2 border rounded font-bold h-[42px]" placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search className="absolute right-3 top-3 text-gray-400" size={18}/>
                    </div>
                </div>
                <ReportActionsBar onPrint={handlePrint} onExport={handleExport} onSettings={() => setShowPrintModal(true)} hideImport={true}/>
            </div>

            <div id="sales-by-name-area" className="space-y-12">
                <div className="bg-white p-2 rounded-xl shadow-lg border border-gray-300 overflow-x-auto">
                    <table className="w-full border-collapse border-2 border-black" dir="rtl">
                        <thead className="bg-[#b4c6e7]">
                            <tr>
                                <th className="p-2 border border-black" style={getCellStyle()}>الوردية</th>
                                <th className="p-2 border border-black" style={getCellStyle()}>رقم الفاتورة</th>
                                <th className="p-2 border border-black" style={getCellStyle()}>العميل</th>
                                <th className="p-2 border border-black" style={getCellStyle()}>الصنف</th>
                                <th className="p-2 border border-black" style={getCellStyle()}>نوع العلف</th>
                                <th className="p-2 border border-black" style={getCellStyle()}>معبأ</th>
                                <th className="p-2 border border-black" style={getCellStyle()}>صب</th>
                                <th className="p-2 border border-black" style={getCellStyle()}>ت. الانتاج</th>
                                <th className="p-2 border border-black" style={getCellStyle()}>طريقة النقل</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-blue-50 border-b border-black">
                                    <td className="p-2 border-l border-black" style={getCellStyle()}>{row.shift}</td>
                                    <td className="p-2 border-l border-black text-blue-800" style={getCellStyle(true)}>{row.invoiceId.slice(-6)}</td>
                                    <td className="p-2 border-l border-black text-right pr-4" style={getCellStyle()}>{row.customerName}</td>
                                    <td className="p-2 border-l border-black text-right pr-4" style={getCellStyle()}>{row.itemName}</td>
                                    <td className="p-2 border-l border-black" style={getCellStyle()}>{row.feedType}</td>
                                    <td className="p-2 border-l border-black" style={getCellStyle(true)}>{row.qtyPacked > 0 ? formatEng(row.qtyPacked) : '-'}</td>
                                    <td className="p-2 border-l border-black" style={getCellStyle(true)}>{row.qtyBulk > 0 ? formatEng(row.qtyBulk) : '-'}</td>
                                    <td className="p-2 border-l border-black" style={getCellStyle(true)}>{row.prodDate}</td>
                                    <td className="p-2" style={getCellStyle()}>{row.transport}</td>
                                </tr>
                            ))}
                            {reportData.length > 0 && (
                                <tr className="bg-[#b4c6e7] font-bold border-t-2 border-black">
                                    <td colSpan={5} className="p-3 text-center" style={getCellStyle()}>إجمالي مبيعات {filterCategory || 'الكل'}</td>
                                    <td className="p-2 border-l border-black" style={getCellStyle(true)}>{formatEng(totals.p)}</td>
                                    <td className="p-2 border-l border-black" style={getCellStyle(true)}>{formatEng(totals.b)}</td>
                                    <td colSpan={2} className="p-2"></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white p-2 rounded-xl shadow-2xl border border-black overflow-x-auto">
                    <table className="w-full border-collapse border-2 border-black text-center" dir="rtl">
                        <thead className="bg-[#002060] text-white">
                            <tr className="h-10">
                                <th colSpan={3} className="border border-black">صب</th>
                                <th rowSpan={2} className="border border-black w-48 min-w-[180px] font-black bg-[#4472c4]">بيان تفصيلي لـ {filterCategory}</th>
                                <th colSpan={3} className="border border-black">معبأ</th>
                            </tr>
                            <tr className="bg-[#b4c6e7] text-black text-[11px] font-black h-10 uppercase tracking-tighter">
                                <th className="border border-black w-24">كود JDE</th><th className="border border-black min-w-[120px]">الصنف</th><th className="border border-black w-24">الكمية</th>
                                <th className="border border-black w-24">كود JDE</th><th className="border border-black min-w-[120px]">الصنف</th><th className="border border-black w-24">الكمية</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-900 font-bold">
                            {Object.entries(summaryBuckets).map(([key, bucket]: [string, any]) => {
                                const rowsCount = Math.max(bucket.p.length, bucket.b.length, 1);
                                return Array.from({ length: rowsCount }).map((_, idx) => {
                                    const pRow = bucket.p[idx]; const bRow = bucket.b[idx]; const isYellow = bucket.isYellow;
                                    return (
                                        <tr key={`${key}-${idx}`} className={`border-b border-black h-10 ${isYellow ? 'bg-yellow-300' : ''}`}>
                                            <td className="border-l border-black font-mono text-[10px]" style={getCellStyle(true)}>{bRow ? bRow.jdeCode : ''}</td>
                                            <td className="border-l border-black text-right pr-3 text-xs" style={getCellStyle()}>{bRow ? bRow.itemName : ''}</td>
                                            <td className="border-l border-black bg-blue-50/20" style={getCellStyle(true)}>{bRow ? formatEng(bRow.qtyBulk) : '-'}</td>
                                            {idx === 0 ? (
                                                <td rowSpan={rowsCount} className={`border-l border-black font-black bg-[#d9e1f2] text-blue-900 ${isYellow ? 'bg-yellow-400' : ''}`}>
                                                    <div className="flex flex-col gap-1 items-center justify-center">
                                                        <span>{bucket.label}</span>
                                                        <span className="text-[14px] bg-white/50 px-2 rounded border border-blue-200" style={forceEnNumsStyle}>{formatEng(bucket.total)}</span>
                                                    </div>
                                                </td>
                                            ) : null}
                                            <td className="border-l border-black font-mono text-[10px]" style={getCellStyle(true)}>{pRow ? pRow.jdeCode : ''}</td>
                                            <td className="border-l border-black text-right pr-3 text-xs" style={getCellStyle()}>{pRow ? pRow.itemName : ''}</td>
                                            <td className="border-l border-black bg-blue-50/20" style={getCellStyle(true)}>{pRow ? formatEng(pRow.qtyPacked) : '-'}</td>
                                        </tr>
                                    );
                                });
                            })}
                            <tr className="bg-[#002060] text-yellow-300 h-14 font-black border-t-4 border-black">
                                <td colSpan={2} className="text-right pr-10 text-xl border-l border-black">إجمالي صب</td>
                                <td className="p-0 border-l border-black" style={getCellStyle(true)}><span className="text-2xl">{formatEng(totals.b)}</span></td>
                                <td className="bg-white text-black border-l border-black text-2xl">إجمالي القطاع</td>
                                <td colSpan={2} className="text-right pr-10 text-xl border-l border-black">إجمالي معبأ</td>
                                <td className="p-0 border-l border-black" style={getCellStyle(true)}><span className="text-2xl">{formatEng(totals.p)}</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
