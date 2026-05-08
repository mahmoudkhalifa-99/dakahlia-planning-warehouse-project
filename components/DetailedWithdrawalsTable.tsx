
import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Sale } from '../types';
import { FileDown, Printer, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
    sales: Sale[];
    title: string;
    loadingSiteFilter?: string;
    reportDate?: string;
    headerColor?: string;
    filterFeedOnly?: boolean;
}

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
};

export const DetailedWithdrawalsTable: React.FC<Props> = ({ sales = [], title, loadingSiteFilter, reportDate: initialReportDate, headerColor = 'bg-blue-900', filterFeedOnly = false }) => {
    const [localReportDate, setLocalReportDate] = useState(initialReportDate || format(new Date(), 'yyyy-MM-dd'));

    const isFeedProduct = (name: string, cat: string) => {
        const n = (name || '').toLowerCase();
        const c = (cat || '').toLowerCase();
        if (n.includes('ذرة') || n.includes('صويا') || n.includes('كسب') || n.includes('نصف') || n.includes('مركز')) {
            if (!n.includes('علف') && !c.includes('علف')) return false;
        }
        const feedKeywords = ['علف', 'داجني', 'تسمين', 'بادي', 'نامي', 'ناهي', 'بياض', 'ماش', 'بط', 'سمك', 'مواشي', 'حلاب', 'مدر', 'بروتين', 'نسيص', 'مركزات'];
        return feedKeywords.some(kw => n.includes(kw) || c.includes(kw)) || n.includes('feed') || c.includes('feed');
    };

    // Sync with prop if it changes
    React.useEffect(() => {
        if (initialReportDate) setLocalReportDate(initialReportDate);
    }, [initialReportDate]);

    // Robust normalization for feedType display
    const normalizeFeedTypeDisplay = (name: string, type: string, cat: string) => {
        const n = (name || '').toLowerCase();
        const t = (type || '').toString().toLowerCase();
        const c = (cat || '').toString().toLowerCase();
        const all = `${n} ${t} ${c}`;
        
        if (all.includes('سمك') || all.includes('أسمماك') || all.includes('طاف') || all.includes('غاطس')) return 'السمك';
        if (all.includes('بط')) return 'البط';
        if (all.includes('بياض') || all.includes('بيض') || all.includes('دواجن')) return 'بياض';
        if (all.includes('عجول') || all.includes('عجل') || all.includes('حلاب') || all.includes('مواشي')) return 'المواشي';
        if (all.includes('أغنام') || all.includes('غنم') || (all.includes('ماش') && !all.includes('بياض') && !all.includes('تسمين'))) return 'الماش';
        if (all.includes('ساسو')) return 'ساسو';
        if (all.includes('مخصوص')) return 'مخصوص';
        if (all.includes('تسمين') || all.includes('بادي') || all.includes('نامي') || all.includes('ناهي') ||
            all.includes('بادى') || all.includes('نامى') || all.includes('ناهى') ||
            all.includes('رومى') || all.includes('رومي') || all.includes('أمھات') || all.includes('أمهات') ||
            all.includes('علف')) return 'التسمين';
        
        return 'التسمين';
    };

    const tableData = useMemo(() => {
        // Flatten sales and items
        const flatData: any[] = [];
        
        sales.forEach(sale => {
            // Only include sales from the finished product warehouse
            const warehouseId = (sale.warehouseId || '').toLowerCase();
            const isFinishedWH = warehouseId.includes('finished') || warehouseId.includes('تام') || warehouseId.includes('منتج');
            const gTypeOverall = (sale.goodsType || '').toLowerCase();
            const isFinishedGoodsVal = gTypeOverall.includes('منتج تام') || gTypeOverall.includes('تام');
            
            if (!isFinishedWH && !isFinishedGoodsVal) return;

            // Filter by date
            if (localReportDate && sale.date !== localReportDate) return;

            // Filter by loading site
            const siteInfo = (sale.loadingSite || sale.warehouseId || sale.warehouse || '').toLowerCase();
            const dmasKeywords = ['دماص', 'damas', '601', 'shakika dmas'];
            const sadatKeywords = ['سادات', 'sadat', '602', 'shakika sadat'];
            
            const isDmas = dmasKeywords.some(k => siteInfo.includes(k));
            const isSadat = sadatKeywords.some(k => siteInfo.includes(k));
            
            if (loadingSiteFilter) {
                const filter = loadingSiteFilter.toLowerCase();
                const isSadatFilter = filter.includes('سادات') || filter.includes('sadat');
                const isDmasFilter = filter.includes('دماص') || filter.includes('damas');
                
                if (isSadatFilter && !isSadat) return;
                if (isDmasFilter && !isDmas) return;
                if (!isSadatFilter && !isDmasFilter && !siteInfo.includes(filter)) return;
            }

            (sale.items || []).forEach(item => {
                const itemCat = (item.feedType || item.category || '').toLowerCase();
                if (filterFeedOnly && !isFeedProduct(item.name, itemCat)) return;

                // Categorize sales type (Shared logic)
                const rawSalesType = (item.salesType || sale.paymentMethod || 'عملاء').toLowerCase();
                const customerName = (sale.customerName || sale.clientName || sale.customer || '').toLowerCase();
                let categorizedSalesType = 'مبيعات العملاء';

                if (rawSalesType.includes('منافذ') || rawSalesType.includes('منفذ') || customerName.includes('منفذ') || customerName.includes('منافذ')) {
                    categorizedSalesType = 'تحويلات النوافذ';
                } else if (customerName.includes('الدقهليه') || customerName.includes('الدقهلية') || customerName.includes('مزارع') || customerName.includes('مزرعة')) {
                    categorizedSalesType = 'الشركات الشقيقة';
                } else if (rawSalesType.includes('عملاء')) {
                    categorizedSalesType = 'مبيعات العملاء';
                } else {
                    categorizedSalesType = 'الشركات الشقيقة';
                }

                flatData.push({
                    id: sale.id,
                    date: sale.date,
                    createdAt: sale.createdAt,
                    customerName: sale.customerName || sale.customer || 'نقدي',
                    customerCode: sale.customerCode || '-',
                    itemName: item.name,
                    feedType: normalizeFeedTypeDisplay(item.name, item.feedType, item.category),
                    itemCode: item.jdeCode || item.id,
                    qtyPacked: item.quantityPacked || 0,
                    qtyBulk: item.quantityBulk || 0,
                    salesType: categorizedSalesType,
                    productionDate: item.productionDate || '-',
                    shift: sale.shift || 'الأولى',
                    loadingOfficer: sale.loadingOfficer || sale.cashierName || '-',
                    transportMethod: sale.transportMethod || '-',
                    category: item.category || '-',
                });
            });
        });

        // Sort by date descending
        return flatData.sort((a, b) => b.date.localeCompare(a.date));
    }, [sales, loadingSiteFilter, localReportDate]);

    const formatNum = (n: number) => n === 0 ? '-' : n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });

    const totals = useMemo(() => {
        return tableData.reduce((acc, row) => ({
            packed: acc.packed + row.qtyPacked,
            bulk: acc.bulk + row.qtyBulk
        }), { packed: 0, bulk: 0 });
    }, [tableData]);

    const handleExport = () => {
        const headers = ['م', 'التاريخ', 'رقم الفاتورة', 'العميل', 'الصنف', 'نوع العلف', 'معبأ', 'صب', 'نوع المبيعات', 'الوردية', 'مسئول التحميل'];
        const data = tableData.map((row, idx) => [
            idx + 1, row.date, row.id, row.customerName, row.itemName, row.feedType, row.qtyPacked, row.qtyBulk, row.salesType, row.shift, row.loadingOfficer
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Withdrawals");
        XLSX.writeFile(wb, `${title}_${localReportDate}.xlsx`);
    };

    return (
        <div className="space-y-4 animate-fade-in" dir="rtl">
            <div className={`p-4 rounded-t-3xl ${headerColor} text-white flex flex-wrap gap-4 justify-between items-center shadow-lg no-print`}>
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black">{title}</h2>
                    <div className="flex gap-4 text-xs font-bold bg-white/10 px-4 py-2 rounded-xl">
                        <span>إجمالي معبأ: {formatNum(totals.packed)} طن</span>
                        <span className="w-[1px] bg-white/20"></span>
                        <span>إجمالي صب: {formatNum(totals.bulk)} طن</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="date" 
                            value={localReportDate} 
                            onChange={e => setLocalReportDate(e.target.value)}
                            className="bg-white/10 text-white text-xs font-bold py-2 pr-9 pl-3 rounded-lg border border-white/20 outline-none focus:bg-white/20 transition-all"
                        />
                    </div>
                    <button onClick={handleExport} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
                        <FileDown size={14} /> تصدير
                    </button>
                    <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-black px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
                        <Printer size={14} /> طباعة
                    </button>
                </div>
            </div>
            
            <div className="bg-white rounded-b-[2rem] shadow-premium border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-[10px] whitespace-nowrap">
                        <thead className="bg-[#0f172a] text-white">
                            <tr className="h-10 text-[10px]">
                                <th className="border border-slate-700 p-1 w-8">م</th>
                                <th className="border border-slate-700 p-1">تاريخ فعلي</th>
                                <th className="border border-slate-700 p-1">التاريخ</th>
                                <th className="border border-slate-700 p-1">رقم الفاتورة</th>
                                <th className="border border-slate-700 p-1">كود العميل</th>
                                <th className="border border-slate-700 p-1">اسم العميل</th>
                                <th className="border border-slate-700 p-1">كود الصنف</th>
                                <th className="border border-slate-700 p-1">اسم الصنف</th>
                                <th className="border border-slate-700 p-1">نوع العلف</th>
                                <th className="border border-slate-700 p-1">الكمية معبأ</th>
                                <th className="border border-slate-700 p-1">الكمية صب</th>
                                <th className="border border-slate-700 p-1">نوع المبيعات</th>
                                <th className="border border-slate-700 p-1">تاريخ الانتاج</th>
                                <th className="border border-slate-700 p-1">الوردية</th>
                                <th className="border border-slate-700 p-1">مسئول التحميل</th>
                                <th className="border border-slate-700 p-1">طريقة النقل</th>
                                <th className="border border-slate-700 p-1">النوع</th>
                            </tr>
                        </thead>
                        <tbody className="font-bold text-slate-700">
                            {tableData.map((row, idx) => (
                                <tr key={idx} className={`h-8 hover:bg-blue-50 border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                    <td className="border border-slate-200 p-1 bg-slate-50">{idx + 1}</td>
                                    <td className="border border-slate-200 p-1" style={forceEnNumsStyle}>
                                        {row.createdAt ? format(parseISO(row.createdAt), 'dd/MM HH:mm') : '-'}
                                    </td>
                                    <td className="border border-slate-200 p-1" style={forceEnNumsStyle}>
                                        {format(parseISO(row.date), 'dd/MM/yyyy')}
                                    </td>
                                    <td className="border border-slate-200 p-1 font-mono text-blue-700">{row.id.replace('INV-', '')}</td>
                                    <td className="border border-slate-200 p-1">{row.customerCode}</td>
                                    <td className="border border-slate-200 p-1 text-right pr-2 max-w-[150px] truncate">{row.customerName}</td>
                                    <td className="border border-slate-200 p-1">{row.itemCode}</td>
                                    <td className="border border-slate-200 p-1 text-right pr-2 max-w-[150px] truncate">{row.itemName}</td>
                                    <td className="border border-slate-200 p-1">{row.feedType}</td>
                                    <td className="border border-slate-200 p-1 font-black text-emerald-700" style={forceEnNumsStyle}>{formatNum(row.qtyPacked)}</td>
                                    <td className="border border-slate-200 p-1 font-black text-amber-700" style={forceEnNumsStyle}>{formatNum(row.qtyBulk)}</td>
                                    <td className="border border-slate-200 p-1">{row.salesType}</td>
                                    <td className="border border-slate-200 p-1">{row.productionDate}</td>
                                    <td className="border border-slate-200 p-1">{row.shift}</td>
                                    <td className="border border-slate-200 p-1">{row.loadingOfficer}</td>
                                    <td className="border border-slate-200 p-1">{row.transportMethod}</td>
                                    <td className="border border-slate-200 p-1 text-[9px]">{row.category}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
